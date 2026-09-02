import { hostname } from "os";
import { Op, Transaction } from "sequelize";
import sequelize from "../../database";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import QuarkAppointmentRecipient from "../../models/QuarkAppointmentRecipient";
import QuarkAppointmentResponse from "../../models/QuarkAppointmentResponse";
import QuarkSyncState from "../../models/QuarkSyncState";
import { logger } from "../../utils/logger";
import { assertNotShuttingDown } from "../../utils/shutdownState";
import {
  AppointmentSnapshot,
  appointmentCanBeConfirmed,
  appointmentIsCancelled,
  buildAppointmentSnapshot,
  quarkPhoneKey
} from "./appointmentUtils";
import { QuarkConfig } from "./config";
import {
  listQuarkAppointments,
  getQuarkAppointment
} from "./QuarkClinicClient";
import { createQuarkNotificationOnce } from "./notificationLedger";
import {
  cancelledAppointmentMessage,
  confirmationReplyInstructions,
  appointmentNoticeOptOut,
  reminderAppointmentMessage
} from "./messageTemplates";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import RecordQuarkAppointmentEventService from "./RecordQuarkAppointmentEventService";
import { clinicDay, dateParts } from "./clinicTime";
import { withLease, readState, writeState } from "../MessagingServices/state";
import {
  canReceiveAppointmentNotices,
  getPreference
} from "../MessagingServices/preferences";
import { dueReminder } from "./reminderTiming";
// Version 5 adds the historical appointment baseline. Bumping the version
// makes existing installations perform a safe, notification-free two-pass
// import after deployment.
const FINGERPRINT_VERSION = 5;
const SYNC_STATE_KEY = "appointments";
const OPERATION_RECONCILIATION_DELAY_MS = 5 * 60 * 1000;
const syncWorkerId = `${hostname()}-${process.pid}`.slice(0, 64);
const formatApiDate = (date: Date) => {
  const p = dateParts(date);
  return `${String(p.day).padStart(2, "0")}-${String(p.month).padStart(
    2,
    "0"
  )}-${p.year}`;
};
const valuesForPersistence = (
  snapshot: AppointmentSnapshot,
  baselineImported: boolean,
  now = new Date()
) => ({
  appointmentId: snapshot.appointmentId,
  patientId: snapshot.patientId,
  phone: snapshot.phone,
  phones: JSON.stringify(snapshot.phones.map(item => item.phone)),
  patientName: snapshot.patientName,
  status: snapshot.status,
  scheduledAt: snapshot.scheduledAt,
  scheduleFingerprint: snapshot.scheduleFingerprint,
  snapshotFingerprint: snapshot.snapshotFingerprint,
  snapshot: JSON.stringify({
    dataAgendamento: snapshot.raw.dataAgendamento || null,
    horaAgendamento: snapshot.raw.horaAgendamento || null,
    clinicaId: snapshot.raw.clinicaId || null,
    clinicaNome: snapshot.raw.clinicaNome || null,
    profissionalId: snapshot.raw.profissionalId || null,
    profissionalNome: snapshot.raw.profissional?.nome || null,
    procedimentoId: snapshot.raw.procedimentoId || null,
    procedimentoNome: snapshot.raw.procedimento?.nome || null,
    procedimentoValor:
      snapshot.raw.procedimento?.valor ??
      snapshot.raw.valorProcedimento ??
      snapshot.raw.procedimento?.preco ??
      snapshot.raw.precoProcedimento ??
      snapshot.raw.procedimento?.valorParticular ??
      null,
    statusMarcacao: snapshot.status,
    cpf: snapshot.cpf,
    phones: snapshot.phones
  }),
  lastSeenAt: now,
  firstSeenAt: now,
  lastChangedAt: now,
  baselineImported,
  fingerprintVersion: FINGERPRINT_VERSION
});

const queueNotice = async (
  snapshot: AppointmentSnapshot,
  key: string,
  eventType: string,
  body: string,
  transaction: Transaction,
  suppressed = false,
  sendOnlyOnWeekday?: number
): Promise<boolean> => {
  const recipient =
    snapshot.phones.find(item => item.isPrimary) || snapshot.phones[0];
  if (!recipient) return false;
  const preference = await getPreference(recipient.phone);
  const asks = appointmentCanBeConfirmed(snapshot.status);
  const completeBody = `${body}${
    asks ? `\n\n${confirmationReplyInstructions}` : ""
  }\n\n${appointmentNoticeOptOut}`;
  const notificationKey = `${key}:to:${quarkPhoneKey(recipient.phone)}`;
  const notificationStatus =
    suppressed || !canReceiveAppointmentNotices(preference)
      ? "SUPPRESSED"
      : "PENDING";
  if (notificationStatus === "PENDING" && eventType === "REMINDER") {
    const manualReminder = await QuarkAppointmentNotification.findOne({
      where: {
        appointmentId: snapshot.appointmentId,
        recipientPhone: recipient.phone,
        eventType: "MANUAL_REMINDER",
        status: {
          [Op.in]: ["PENDING", "PROCESSING", "FAILED_RETRY", "SENT", "UNKNOWN"]
        },
        payload: { [Op.like]: `%${snapshot.scheduleFingerprint}%` }
      },
      transaction
    });
    if (manualReminder) return false;
  }
  const created = await createQuarkNotificationOnce(
    snapshot.appointmentId,
    notificationKey,
    eventType,
    {
      phone: recipient.phone,
      patientName: snapshot.patientName,
      body: completeBody,
      requestsConfirmation: asks,
      validUntil: snapshot.scheduledAt?.toISOString() || null,
      scheduleFingerprint: snapshot.scheduleFingerprint,
      sendOnlyOnWeekday
    },
    notificationStatus,
    transaction
  );
  if (
    !created &&
    notificationStatus === "PENDING" &&
    eventType === "REMINDER"
  ) {
    const existing = await QuarkAppointmentNotification.findOne({
      where: { appointmentId: snapshot.appointmentId, notificationKey },
      transaction,
      lock: transaction.LOCK.UPDATE
    } as any);
    if (existing?.status === "SUPPRESSED" && !existing.lastError) {
      const competing = await QuarkAppointmentNotification.findOne({
        where: {
          appointmentId: snapshot.appointmentId,
          recipientPhone: recipient.phone,
          id: { [Op.ne]: existing.id },
          eventType: { [Op.in]: ["REMINDER", "MANUAL_REMINDER"] },
          status: {
            [Op.in]: [
              "PENDING",
              "PROCESSING",
              "FAILED_RETRY",
              "SENT",
              "UNKNOWN"
            ]
          },
          payload: { [Op.like]: `%${snapshot.scheduleFingerprint}%` }
        },
        transaction
      });
      if (!competing)
        await existing.update(
          {
            status: "PENDING",
            attempts: 0,
            nextAttemptAt: new Date(),
            priorityAt: snapshot.scheduledAt,
            lastError: null
          },
          { transaction }
        );
    }
  }
  return created;
};

interface QuarkOperationState {
  status: string;
  desired?: "CONFIRMADO" | "CANCELADO";
  auditId?: number;
  startedAt?: string;
  updatedAt?: string;
}

const reconcileStaleOperation = async (
  config: QuarkConfig,
  snapshot: AppointmentSnapshot,
  operation: QuarkOperationState
): Promise<{
  snapshot: AppointmentSnapshot;
  operation: QuarkOperationState;
}> => {
  if (!["UNKNOWN", "PROCESSING"].includes(operation.status))
    return { snapshot, operation };
  const audit = operation.auditId
    ? await QuarkAppointmentResponse.findByPk(operation.auditId)
    : null;
  const timestamp = Date.parse(
    operation.updatedAt ||
      operation.startedAt ||
      audit?.receivedAt?.toISOString() ||
      ""
  );
  if (
    !Number.isFinite(timestamp) ||
    Date.now() - timestamp < OPERATION_RECONCILIATION_DELAY_MS
  )
    return { snapshot, operation };
  if (!operation.desired) return { snapshot, operation };

  let authoritative: AppointmentSnapshot;
  try {
    authoritative = buildAppointmentSnapshot(
      await getQuarkAppointment(config, snapshot.appointmentId),
      config
    );
  } catch (error) {
    logger.warn({
      info: "Stale Quark operation could not be reconciled",
      appointmentId: snapshot.appointmentId,
      err: error
    });
    return { snapshot, operation };
  }

  const applied = authoritative.status === operation.desired;
  const next: QuarkOperationState = {
    status: applied ? "APPLIED" : "FAILED",
    desired: operation.desired,
    auditId: operation.auditId,
    updatedAt: new Date().toISOString()
  };
  await writeState(`quark-operation:${snapshot.appointmentId}`, next);
  if (audit)
    await audit.update(
      applied
        ? {
            status: "SUCCESS",
            newQuarkStatus: operation.desired,
            appliedAt: new Date(),
            errorCode: null
          }
        : {
            status: "FAILED",
            newQuarkStatus: authoritative.status,
            errorCode: "QUARK_OPERATION_NOT_APPLIED"
          }
    );
  if (applied)
    await QuarkAppointmentNotification.update(
      { status: "SUPPRESSED", lastError: "Appointment decision reconciled" },
      {
        where: {
          appointmentId: snapshot.appointmentId,
          status: { [Op.in]: ["PENDING", "FAILED_RETRY"] }
        }
      }
    );
  logger.warn({
    info: "Stale Quark operation reconciled from authoritative status",
    appointmentId: snapshot.appointmentId,
    desired: operation.desired,
    remoteStatus: authoritative.status,
    applied
  });
  return { snapshot: authoritative, operation: next };
};

const processSnapshot = async (
  config: QuarkConfig,
  incoming: AppointmentSnapshot,
  baseline: boolean
) =>
  withLease(`quark-appointment:${incoming.appointmentId}`, async () => {
    assertNotShuttingDown();
    let snapshot = incoming;
    const record = await QuarkAppointment.findOne({
      where: { appointmentId: snapshot.appointmentId }
    });
    let operation = await readState<QuarkOperationState>(
      `quark-operation:${snapshot.appointmentId}`,
      { status: "READY" }
    );
    ({ snapshot, operation } = await reconcileStaleOperation(
      config,
      snapshot,
      operation
    ));
    if (["UNKNOWN", "PROCESSING"].includes(operation.status)) return;
    // The sweep may have started before a patient's decision. Do not restore that stale snapshot.
    if (
      record &&
      operation.status === "APPLIED" &&
      record.status !== snapshot.status
    )
      snapshot = buildAppointmentSnapshot(
        await getQuarkAppointment(config, snapshot.appointmentId),
        config
      );
    const oldStatus = record?.status;
    const scheduleChanged =
      !!record && record.scheduleFingerprint !== snapshot.scheduleFingerprint;
    const changed =
      !!record && (scheduleChanged || record.phone !== snapshot.phone);
    const cancelled =
      !!record &&
      !appointmentIsCancelled(record.status) &&
      appointmentIsCancelled(snapshot.status);
    const reminder = dueReminder(config, snapshot);
    await sequelize.transaction(async transaction => {
      const fields = valuesForPersistence(
        snapshot,
        baseline || !!record?.baselineImported
      );
      if (record)
        await record.update(
          {
            ...fields,
            firstSeenAt: record.firstSeenAt,
            lastChangedAt:
              record.snapshotFingerprint === snapshot.snapshotFingerprint
                ? record.lastChangedAt
                : new Date(),
            ...(baseline ||
            changed ||
            !appointmentCanBeConfirmed(snapshot.status)
              ? { awaitingConfirmation: false, confirmationRequestedAt: null }
              : {})
          },
          { transaction }
        );
      else
        await QuarkAppointment.create(
          {
            ...fields,
            awaitingConfirmation: false,
            confirmationRequestedAt: null
          },
          { transaction }
        );
      if (
        !baseline &&
        (!record || changed || cancelled || oldStatus !== snapshot.status)
      )
        await RecordQuarkAppointmentEventService({
          snapshot,
          eventType: cancelled
            ? "CANCELLED"
            : !record
            ? "CREATED"
            : scheduleChanged
            ? "RESCHEDULED"
            : "UPDATED",
          source: "QUARK_EXTERNAL",
          transaction
        });
      if (!baseline && cancelled) {
        await queueNotice(
          snapshot,
          `cancelled:${snapshot.snapshotFingerprint.slice(0, 24)}`,
          "CANCELLED",
          cancelledAppointmentMessage(snapshot),
          transaction
        );
      }
      // A baseline must not reserve the deterministic reminder key. The next
      // active sweep must still be able to create and send that reminder.
      if (reminder && !baseline)
        await queueNotice(
          snapshot,
          `reminder:${reminder.hours}:${snapshot.scheduleFingerprint.slice(
            0,
            24
          )}`,
          "REMINDER",
          reminderAppointmentMessage(
            snapshot,
            reminder.hours,
            config.clinicAddress,
            reminder.mondayAdvance
          ),
          transaction,
          false,
          reminder.sendOnlyOnWeekday
        );
      await QuarkAppointmentRecipient.update(
        { active: false },
        { where: { appointmentId: snapshot.appointmentId }, transaction }
      );
      for (const recipient of snapshot.phones) {
        const [row] = await QuarkAppointmentRecipient.findOrCreate({
          where: {
            appointmentId: snapshot.appointmentId,
            phone: recipient.phone
          },
          defaults: {
            appointmentId: snapshot.appointmentId,
            ...recipient,
            active: true
          },
          transaction
        });
        await row.update(
          {
            active: true,
            source: recipient.source,
            isPrimary: recipient.isPrimary
          },
          { transaction }
        );
      }
    });
  });
const fetchSnapshots = async (
  config: QuarkConfig,
  horizon: number,
  lookback: number
) => {
  const values = new Map<string, AppointmentSnapshot>();
  const today = clinicDay();
  const firstOffset = -Math.max(0, lookback);
  const firstDay = clinicDay(today, firstOffset);
  const horizonDay = clinicDay(today, horizon);
  for (let offset = firstOffset; offset < horizon; offset += 30) {
    assertNotShuttingDown();
    const endOffset = Math.min(offset + 29, horizon - 1);
    const appointments = await listQuarkAppointments(
      config,
      formatApiDate(clinicDay(today, offset)),
      formatApiDate(clinicDay(today, endOffset))
    );
    for (const appointment of appointments) {
      if (appointment.id === undefined || appointment.id === null) continue;
      const snapshot = buildAppointmentSnapshot(appointment, config);
      if (
        snapshot.scheduledAt &&
        snapshot.scheduledAt >= firstDay &&
        snapshot.scheduledAt < horizonDay
      )
        values.set(snapshot.appointmentId, snapshot);
    }
    await QuarkSyncState.update(
      { syncLockUntil: new Date(Date.now() + 3600000) },
      { where: { key: SYNC_STATE_KEY, syncWorkerId } }
    );
  }
  return Array.from(values.values());
};

const reconcileMissingKnownAppointments = async (
  config: QuarkConfig,
  snapshots: AppointmentSnapshot[],
  horizon: number
): Promise<AppointmentSnapshot[]> => {
  const fetchedIds = snapshots.map(snapshot => snapshot.appointmentId);
  const today = clinicDay();
  const knownMissing = await QuarkAppointment.findAll({
    attributes: ["appointmentId"],
    where: {
      scheduledAt: {
        [Op.gte]: today,
        [Op.lt]: clinicDay(today, horizon)
      },
      status: { [Op.in]: ["AGENDADO", "CONFIRMADO"] },
      ...(fetchedIds.length
        ? { appointmentId: { [Op.notIn]: fetchedIds } }
        : {})
    },
    order: [["lastSeenAt", "ASC"]],
    limit: 50
  });
  if (!knownMissing.length) return snapshots;

  const reconciled = [...snapshots];
  for (const record of knownMissing) {
    assertNotShuttingDown();
    try {
      reconciled.push(
        buildAppointmentSnapshot(
          await getQuarkAppointment(config, record.appointmentId),
          config
        )
      );
    } catch (error) {
      logger.warn({
        info: "Known Quark appointment missing from sweep could not be reconciled",
        appointmentId: record.appointmentId,
        err: error
      });
    }
  }
  return reconciled;
};

export const SyncQuarkAppointmentsService = async (
  config: QuarkConfig
): Promise<void> => {
  const [state] = await QuarkSyncState.findOrCreate({
    where: { key: SYNC_STATE_KEY },
    defaults: {
      key: SYNC_STATE_KEY,
      status: "BASELINING",
      baselineStartedAt: new Date(),
      fingerprintVersion: FINGERPRINT_VERSION
    }
  });
  const [claimed] = await QuarkSyncState.update(
    { syncWorkerId, syncLockUntil: new Date(Date.now() + 3600000) },
    {
      where: {
        key: SYNC_STATE_KEY,
        [Op.or]: [
          { syncLockUntil: null },
          { syncLockUntil: { [Op.lt]: new Date() } }
        ]
      }
    }
  );
  if (!claimed) return;
  const baseline =
    state.status !== "ACTIVE" ||
    state.fingerprintVersion !== FINGERPRINT_VERSION;
  try {
    const lastFull = await readState<string | null>(
      "quark:last-full-sweep",
      null
    );
    const full =
      baseline || !lastFull || Date.now() - Date.parse(lastFull) > 24 * 3600000;
    const horizon = full
      ? config.syncHorizonDays
      : Math.min(30, config.syncHorizonDays);
    const lookback = full
      ? config.syncLookbackDays
      : Math.min(30, config.syncLookbackDays);
    const today = clinicDay();
    let snapshots = await fetchSnapshots(config, horizon, lookback);
    snapshots = await reconcileMissingKnownAppointments(
      config,
      snapshots,
      horizon
    );
    for (const snapshot of snapshots)
      await processSnapshot(
        config,
        snapshot,
        baseline || (!!snapshot.scheduledAt && snapshot.scheduledAt < today)
      );
    if (baseline) {
      snapshots = await fetchSnapshots(config, horizon, lookback);
      snapshots = await reconcileMissingKnownAppointments(
        config,
        snapshots,
        horizon
      );
      for (const snapshot of snapshots)
        await processSnapshot(config, snapshot, true);
    }
    await QuarkSyncState.update(
      {
        status: "ACTIVE",
        baselineCompletedAt: baseline ? new Date() : state.baselineCompletedAt,
        lastSuccessfulSyncAt: new Date(),
        fingerprintVersion: FINGERPRINT_VERSION
      },
      { where: { key: SYNC_STATE_KEY, syncWorkerId } }
    );
    if (full)
      await writeState("quark:last-full-sweep", new Date().toISOString());
    emitQuarkDashboardUpdate("sync", SYNC_STATE_KEY);
    logger.info({
      info: "Quark synchronization completed",
      count: snapshots.length,
      baseline,
      horizon,
      lookback
    });
  } finally {
    await QuarkSyncState.update(
      { syncWorkerId: null, syncLockUntil: null },
      { where: { key: SYNC_STATE_KEY, syncWorkerId } }
    );
  }
};
