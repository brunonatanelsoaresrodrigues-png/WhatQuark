import { hostname } from "os";
import { Op, Transaction } from "sequelize";
import sequelize from "../../database";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentRecipient from "../../models/QuarkAppointmentRecipient";
import QuarkSyncState from "../../models/QuarkSyncState";
import { logger } from "../../utils/logger";
import { assertNotShuttingDown } from "../../utils/shutdownState";
import {
  AppointmentSnapshot,
  appointmentCanBeConfirmed,
  appointmentIsCancelled,
  buildAppointmentSnapshot,
  quarkPhoneKey,
  appointmentReference
} from "./appointmentUtils";
import { QuarkConfig } from "./config";
import {
  listQuarkAppointments,
  getQuarkAppointment
} from "./QuarkClinicClient";
import { createQuarkNotificationOnce } from "./notificationLedger";
import {
  cancelledAppointmentMessage,
  changedAppointmentMessage,
  newAppointmentMessage,
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
const FINGERPRINT_VERSION = 4;
const SYNC_STATE_KEY = "appointments";
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
) => {
  const recipient =
    snapshot.phones.find(item => item.isPrimary) || snapshot.phones[0];
  if (!recipient) return;
  const preference = await getPreference(recipient.phone);
  const ref = appointmentReference(
    snapshot.appointmentId,
    snapshot.scheduleFingerprint,
    recipient.phone
  );
  const asks = appointmentCanBeConfirmed(snapshot.status);
  const completeBody = `${body}${
    asks
      ? `\n\nPara confirmar: CONFIRMAR ${ref}\nPara solicitar cancelamento: CANCELAR ${ref}`
      : ""
  }\n\nPara deixar de receber avisos, responda PARAR.`;
  await createQuarkNotificationOnce(
    snapshot.appointmentId,
    `${key}:to:${quarkPhoneKey(recipient.phone)}`,
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
    suppressed || !canReceiveAppointmentNotices(preference)
      ? "SUPPRESSED"
      : "PENDING",
    transaction
  );
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
    const operation = await readState(
      `quark-operation:${snapshot.appointmentId}`,
      { status: "READY" }
    );
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
      let notified = false;
      if (!baseline && cancelled) {
        await queueNotice(
          snapshot,
          `cancelled:${snapshot.snapshotFingerprint.slice(0, 24)}`,
          "CANCELLED",
          cancelledAppointmentMessage(snapshot),
          transaction
        );
        notified = true;
      } else if (
        !baseline &&
        (appointmentCanBeConfirmed(snapshot.status) ||
          (scheduleChanged && snapshot.status === "CONFIRMADO")) &&
        (!record || changed)
      ) {
        await queueNotice(
          snapshot,
          !record
            ? "created"
            : `changed:${snapshot.snapshotFingerprint.slice(0, 24)}`,
          !record ? "CREATED" : scheduleChanged ? "RESCHEDULED" : "UPDATED",
          !record
            ? newAppointmentMessage(snapshot)
            : changedAppointmentMessage(snapshot),
          transaction
        );
        notified = true;
      }
      if (reminder)
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
            "",
            reminder.mondayAdvance
          ),
          transaction,
          baseline || notified,
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
const fetchSnapshots = async (config: QuarkConfig, horizon: number) => {
  const values = new Map<string, AppointmentSnapshot>();
  const today = clinicDay();
  for (let offset = 0; offset < horizon; offset += 30) {
    assertNotShuttingDown();
    const appointments = await listQuarkAppointments(
      config,
      formatApiDate(clinicDay(today, offset)),
      formatApiDate(clinicDay(today, Math.min(offset + 29, horizon - 1)))
    );
    for (const appointment of appointments) {
      if (appointment.id === undefined || appointment.id === null) continue;
      const snapshot = buildAppointmentSnapshot(appointment, config);
      if (snapshot.scheduledAt && snapshot.scheduledAt >= today)
        values.set(snapshot.appointmentId, snapshot);
    }
    await QuarkSyncState.update(
      { syncLockUntil: new Date(Date.now() + 3600000) },
      { where: { key: SYNC_STATE_KEY, syncWorkerId } }
    );
  }
  return Array.from(values.values());
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
    let snapshots = await fetchSnapshots(config, horizon);
    for (const snapshot of snapshots)
      await processSnapshot(config, snapshot, baseline);
    if (baseline) {
      snapshots = await fetchSnapshots(config, horizon);
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
      horizon
    });
  } finally {
    await QuarkSyncState.update(
      { syncWorkerId: null, syncLockUntil: null },
      { where: { key: SYNC_STATE_KEY, syncWorkerId } }
    );
  }
};
