import { hostname } from "os";
import { Op } from "sequelize";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import QuarkAppointmentRecipient from "../../models/QuarkAppointmentRecipient";
import QuarkSyncState from "../../models/QuarkSyncState";
import { logger } from "../../utils/logger";
import {
  AppointmentSnapshot,
  appointmentCanBeConfirmed,
  appointmentIsCancelled,
  buildAppointmentSnapshot,
  quarkPhoneKey
} from "./appointmentUtils";
import { QuarkConfig } from "./config";
import { listQuarkAppointments } from "./QuarkClinicClient";
import { createQuarkNotificationOnce } from "./notificationLedger";
import {
  cancelledAppointmentMessage,
  changedAppointmentMessage,
  newAppointmentMessage,
  recoveredAppointmentMessage,
  reminderAppointmentMessage
} from "./messageTemplates";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import RecordQuarkAppointmentEventService from "./RecordQuarkAppointmentEventService";
import { dueReminder } from "./reminderTiming";

const SYNC_STATE_KEY = "appointments";
const FINGERPRINT_VERSION = 3;
const COVERAGE_NOTIFICATION_VERSION = 3;
const COVERING_NOTIFICATION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "FAILED_RETRY",
  "SENT"
];
const COVERAGE_DEAD_LETTER_RETRY_MS = 6 * 60 * 60 * 1000;
const syncWorkerId = `${hostname()}-${process.pid}`.slice(0, 64);

const pad = (value: number): string =>
  value < 10 ? `0${value}` : String(value);

const formatApiDate = (date: Date): string =>
  `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;

const startOfToday = (): Date => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const addDays = (date: Date, days: number): Date => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
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
    phones: snapshot.phones
  }),
  lastSeenAt: now,
  firstSeenAt: now,
  lastChangedAt: now,
  baselineImported,
  fingerprintVersion: FINGERPRINT_VERSION,
  awaitingConfirmation: false,
  confirmationRequestedAt: null
});

const createOutbox = async (
  snapshot: AppointmentSnapshot,
  notificationKey: string,
  eventType: string,
  body: string,
  status: "PENDING" | "SUPPRESSED" = "PENDING",
  sendOnlyOnWeekday?: number
): Promise<boolean> => {
  let created = false;
  for (const recipient of snapshot.phones) {
    const recipientCreated = await createQuarkNotificationOnce(
      snapshot.appointmentId,
      `${notificationKey}:to:${quarkPhoneKey(recipient.phone)}`,
      eventType,
      {
        phone: recipient.phone,
        patientName: snapshot.patientName,
        body,
        requestsConfirmation: appointmentCanBeConfirmed(snapshot.status),
        validUntil: snapshot.scheduledAt
          ? snapshot.scheduledAt.toISOString()
          : null,
        sendOnlyOnWeekday
      },
      status
    );
    created = recipientCreated || created;
  }
  return created;
};

const syncRecipients = async (snapshot: AppointmentSnapshot): Promise<void> => {
  const phones = snapshot.phones.map(item => item.phone);
  await QuarkAppointmentRecipient.update(
    { active: false },
    {
      where: {
        appointmentId: snapshot.appointmentId,
        ...(phones.length ? { phone: { [Op.notIn]: phones } } : {})
      }
    }
  );

  for (const recipient of snapshot.phones) {
    const [record] = await QuarkAppointmentRecipient.findOrCreate({
      where: {
        appointmentId: snapshot.appointmentId,
        phone: recipient.phone
      },
      defaults: {
        appointmentId: snapshot.appointmentId,
        phone: recipient.phone,
        source: recipient.source,
        isPrimary: recipient.isPrimary,
        active: true
      }
    });
    await record.update({
      source: recipient.source,
      isPrimary: recipient.isPrimary,
      active: true
    });
  }
};

const suppressQueuedNotifications = async (
  appointmentId: string,
  reason: string
): Promise<void> => {
  await QuarkAppointmentNotification.update(
    {
      status: "SUPPRESSED",
      processingStartedAt: null,
      workerId: null,
      lastError: reason
    },
    {
      where: {
        appointmentId,
        status: { [Op.in]: ["PENDING", "FAILED_RETRY"] }
      }
    }
  );
};

const createDueReminder = async (
  config: QuarkConfig,
  snapshot: AppointmentSnapshot,
  suppress = false
): Promise<void> => {
  const reminder = dueReminder(config, snapshot);
  if (!reminder) return;
  await createOutbox(
    snapshot,
    `reminder:${reminder.hours}:${snapshot.scheduleFingerprint.slice(0, 24)}`,
    "REMINDER",
    reminderAppointmentMessage(
      snapshot,
      reminder.hours,
      config.clinicAddress,
      reminder.mondayAdvance
    ),
    suppress ? "SUPPRESSED" : "PENDING",
    reminder.sendOnlyOnWeekday
  );
};

const processNewAppointment = async (
  config: QuarkConfig,
  snapshot: AppointmentSnapshot,
  baselineMode: boolean,
  safeDiscoveryMode: boolean
): Promise<void> => {
  if (baselineMode || safeDiscoveryMode) {
    const [, created] = await QuarkAppointment.findOrCreate({
      where: { appointmentId: snapshot.appointmentId },
      defaults: valuesForPersistence(snapshot, true)
    });
    if (!created) return;
    await createDueReminder(config, snapshot, true);
    return;
  }

  await RecordQuarkAppointmentEventService({
    snapshot,
    eventType: appointmentIsCancelled(snapshot.status)
      ? "CANCELLED"
      : "CREATED",
    source: "QUARK_EXTERNAL"
  });

  await QuarkAppointment.findOrCreate({
    where: { appointmentId: snapshot.appointmentId },
    defaults: valuesForPersistence(snapshot, false)
  });

  // A consulta pode ter sido criada e cancelada entre duas varreduras. Como o
  // baseline completo já foi importado, uma consulta cancelada vista pela
  // primeira vez em modo ativo é um evento novo, não um cancelamento antigo.
  if (appointmentIsCancelled(snapshot.status)) {
    await createOutbox(
      snapshot,
      `cancelled:${snapshot.scheduleFingerprint.slice(0, 24)}`,
      "CANCELLED",
      cancelledAppointmentMessage(snapshot)
    );
    return;
  }

  if (!appointmentCanBeConfirmed(snapshot.status)) return;

  // Se a consulta foi criada já dentro de uma janela de lembrete, registre esse
  // lembrete como suprimido. A confirmação de criação abaixo já contém todos os
  // dados e as opções SIM/NÃO, evitando duas mensagens seguidas ao paciente.
  await createDueReminder(config, snapshot, true);
  await createOutbox(
    snapshot,
    `created:${snapshot.scheduleFingerprint.slice(0, 24)}`,
    "CREATED",
    newAppointmentMessage(snapshot, config.clinicAddress)
  );
};

const processExistingAppointment = async (
  config: QuarkConfig,
  record: QuarkAppointment,
  snapshot: AppointmentSnapshot,
  baselineMode: boolean
): Promise<void> => {
  const now = new Date();
  const becameCancelled =
    !appointmentIsCancelled(record.status) &&
    appointmentIsCancelled(snapshot.status);
  const scheduleChanged =
    record.scheduleFingerprint !== snapshot.scheduleFingerprint;
  let storedPhones: string[] = record.phone ? [record.phone] : [];
  try {
    storedPhones = JSON.parse(record.phones || "[]") as string[];
  } catch {
    // Legacy rows fall back to the former primary phone column.
  }
  const phoneListChanged =
    JSON.stringify(storedPhones) !==
    JSON.stringify(snapshot.phones.map(item => item.phone));
  const phoneChanged = record.phone !== snapshot.phone || phoneListChanged;
  const relevantChanged = scheduleChanged || phoneChanged;

  if (
    !baselineMode &&
    record.snapshotFingerprint !== snapshot.snapshotFingerprint
  ) {
    await RecordQuarkAppointmentEventService({
      record,
      snapshot,
      eventType: becameCancelled
        ? "CANCELLED"
        : scheduleChanged
        ? "RESCHEDULED"
        : "UPDATED",
      source: "QUARK_EXTERNAL",
      metadata: { phoneChanged }
    });
  }

  if (baselineMode) {
    await record.update({
      ...valuesForPersistence(snapshot, true, now),
      firstSeenAt: record.firstSeenAt,
      awaitingConfirmation: false,
      confirmationRequestedAt: null
    });
    await createDueReminder(config, snapshot, true);
    return;
  }

  if (becameCancelled || relevantChanged) {
    await suppressQueuedNotifications(
      snapshot.appointmentId,
      becameCancelled
        ? "Appointment was cancelled before delivery"
        : "Appointment details changed before delivery"
    );
  }

  await record.update({
    ...valuesForPersistence(snapshot, record.baselineImported, now),
    firstSeenAt: record.firstSeenAt,
    lastChangedAt:
      record.snapshotFingerprint === snapshot.snapshotFingerprint
        ? record.lastChangedAt
        : now,
    awaitingConfirmation:
      becameCancelled || !appointmentCanBeConfirmed(snapshot.status)
        ? false
        : record.awaitingConfirmation,
    confirmationRequestedAt:
      becameCancelled || !appointmentCanBeConfirmed(snapshot.status)
        ? null
        : record.confirmationRequestedAt
  });

  if (becameCancelled) {
    await createOutbox(
      snapshot,
      `cancelled:${snapshot.scheduleFingerprint.slice(0, 24)}`,
      "CANCELLED",
      cancelledAppointmentMessage(snapshot)
    );
    return;
  }

  if (scheduleChanged && !becameCancelled) {
    // A remarcação já comunica os dados atuais da consulta. Se ela coincidir
    // com uma janela de lembrete, grave esse lembrete como suprimido antes do
    // aviso de alteração para evitar duas mensagens em sequência.
    await createDueReminder(config, snapshot, true);
    await createOutbox(
      snapshot,
      `rescheduled:${snapshot.scheduleFingerprint.slice(0, 24)}`,
      "RESCHEDULED",
      changedAppointmentMessage(snapshot, config.clinicAddress)
    );
    return;
  }

  await createDueReminder(config, snapshot);
};

const fetchSnapshots = async (
  config: QuarkConfig,
  today: Date
): Promise<AppointmentSnapshot[]> => {
  const byId = new Map<string, AppointmentSnapshot>();

  for (let offset = 0; offset < config.syncHorizonDays; offset += 30) {
    const windowStart = addDays(today, offset);
    const windowEnd = addDays(
      today,
      Math.min(offset + 29, config.syncHorizonDays - 1)
    );
    const appointments = await listQuarkAppointments(
      config,
      formatApiDate(windowStart),
      formatApiDate(windowEnd)
    );
    appointments
      .filter(
        appointment => appointment.id !== undefined && appointment.id !== null
      )
      .map(appointment => buildAppointmentSnapshot(appointment, config))
      .filter(
        snapshot =>
          !snapshot.scheduledAt ||
          snapshot.scheduledAt.getTime() >= today.getTime()
      )
      .forEach(snapshot => byId.set(snapshot.appointmentId, snapshot));

    logger.info({
      info: "QuarkClinic synchronization window read",
      startDate: formatApiDate(windowStart),
      endDate: formatApiDate(windowEnd),
      count: appointments.length
    });
  }

  return Array.from(byId.values());
};

const processSnapshots = async (
  config: QuarkConfig,
  snapshots: AppointmentSnapshot[],
  baselineMode: boolean,
  safeDiscoveryMode = false
): Promise<void> => {
  const ids = snapshots.map(snapshot => snapshot.appointmentId);
  const existingRecords = ids.length
    ? await QuarkAppointment.findAll({
        where: { appointmentId: { [Op.in]: ids } }
      })
    : [];
  const recordsById = new Map(
    existingRecords.map(record => [record.appointmentId, record])
  );

  for (const snapshot of snapshots) {
    const record = recordsById.get(snapshot.appointmentId);
    if (record) {
      await processExistingAppointment(config, record, snapshot, baselineMode);
    } else {
      await processNewAppointment(
        config,
        snapshot,
        baselineMode,
        safeDiscoveryMode
      );
    }
    await syncRecipients(snapshot);
  }

  const persistedCount = ids.length
    ? await QuarkAppointment.count({
        where: { appointmentId: { [Op.in]: ids } }
      })
    : 0;
  if (persistedCount !== ids.length) {
    throw new Error(
      `QuarkClinic persistence coverage mismatch: fetched=${ids.length}, persisted=${persistedCount}`
    );
  }
};

const notificationCoversSnapshot = (
  notification: QuarkAppointmentNotification,
  snapshot: AppointmentSnapshot
): boolean => {
  try {
    const payload = JSON.parse(notification.payload) as {
      phone?: string | null;
      validUntil?: string | null;
      requestsConfirmation?: boolean;
    };
    const scheduledAt = snapshot.scheduledAt?.toISOString() || null;
    return (
      payload.requestsConfirmation === true &&
      payload.validUntil === scheduledAt &&
      !!payload.phone &&
      snapshot.phones.some(recipient => recipient.phone === payload.phone)
    );
  } catch {
    return false;
  }
};

const deadLetterCanBeRetried = (
  notification: QuarkAppointmentNotification,
  now: number
): boolean => {
  const error = notification.lastError || "";
  const permanentlyUnsendable =
    error.includes("QUARK_PERMANENT_INVALID_PHONE") ||
    error.includes("ERR_NUMBER_NOT_ON_WHATSAPP") ||
    error.includes("Unexpected outbox payload");
  return (
    !permanentlyUnsendable &&
    notification.updatedAt.getTime() <= now - COVERAGE_DEAD_LETTER_RETRY_MS
  );
};

const ensureNotificationCoverage = async (
  config: QuarkConfig,
  snapshots: AppointmentSnapshot[]
): Promise<void> => {
  const now = Date.now();
  const confirmable = snapshots.filter(
    snapshot =>
      appointmentCanBeConfirmed(snapshot.status) &&
      !!snapshot.scheduledAt &&
      snapshot.scheduledAt.getTime() > now
  );
  const withPhone = confirmable.filter(snapshot => snapshot.phones.length > 0);
  const withoutPhone = confirmable.length - withPhone.length;
  const ids = withPhone.map(snapshot => snapshot.appointmentId);
  const notifications = ids.length
    ? await QuarkAppointmentNotification.findAll({
        where: {
          appointmentId: { [Op.in]: ids },
          status: {
            [Op.in]: [...COVERING_NOTIFICATION_STATUSES, "DEAD_LETTER"]
          }
        },
        attributes: [
          "appointmentId",
          "eventType",
          "recipientPhone",
          "payload",
          "status",
          "lastError",
          "updatedAt",
          "notificationKey"
        ]
      })
    : [];
  const snapshotsById = new Map(
    withPhone.map(snapshot => [snapshot.appointmentId, snapshot])
  );
  const covered = new Set<string>();
  const deadLettersByAppointment = new Map<
    string,
    QuarkAppointmentNotification[]
  >();

  notifications.forEach(notification => {
    const snapshot = snapshotsById.get(notification.appointmentId);
    if (!snapshot || !notificationCoversSnapshot(notification, snapshot)) {
      return;
    }
    if (COVERING_NOTIFICATION_STATUSES.includes(notification.status)) {
      covered.add(notification.appointmentId);
      return;
    }
    if (
      notification.status === "DEAD_LETTER" &&
      notification.notificationKey.startsWith(
        `coverage-recovery:${COVERAGE_NOTIFICATION_VERSION}:`
      )
    ) {
      const current =
        deadLettersByAppointment.get(notification.appointmentId) || [];
      current.push(notification);
      deadLettersByAppointment.set(notification.appointmentId, current);
    }
  });

  const uncovered = withPhone
    .filter(snapshot => !covered.has(snapshot.appointmentId))
    .sort(
      (left, right) =>
        (left.scheduledAt?.getTime() || Number.MAX_SAFE_INTEGER) -
        (right.scheduledAt?.getTime() || Number.MAX_SAFE_INTEGER)
    );
  let created = 0;
  let revived = 0;
  let unresolved = 0;
  for (const snapshot of uncovered) {
    const notificationCreated = await createOutbox(
      snapshot,
      `coverage-recovery:${COVERAGE_NOTIFICATION_VERSION}:${snapshot.scheduleFingerprint.slice(
        0,
        24
      )}`,
      "COVERAGE_RECOVERY",
      recoveredAppointmentMessage(snapshot, config.clinicAddress)
    );
    if (notificationCreated) {
      created += 1;
      continue;
    }

    const retryableDeadLetters = (
      deadLettersByAppointment.get(snapshot.appointmentId) || []
    ).filter(notification => deadLetterCanBeRetried(notification, now));
    if (retryableDeadLetters.length === 0) {
      unresolved += 1;
      continue;
    }
    for (const notification of retryableDeadLetters) {
      await notification.update({
        status: "FAILED_RETRY",
        attempts: 0,
        nextAttemptAt: new Date(),
        processingStartedAt: null,
        workerId: null,
        lastError: "Requeued by appointment coverage audit"
      });
    }
    revived += 1;
  }

  if (created > 0 || revived > 0 || withoutPhone > 0 || unresolved > 0) {
    logger[withoutPhone > 0 || unresolved > 0 ? "error" : "warn"]({
      info: "QuarkClinic appointment notification coverage repaired",
      confirmableAppointments: confirmable.length,
      alreadyCovered: covered.size,
      recoveryAppointmentsQueued: created,
      deadLetterAppointmentsRequeued: revived,
      appointmentsWithoutPhone: withoutPhone,
      unresolvedAppointments: unresolved
    });
  }
};

const acquireSyncLock = async (): Promise<QuarkSyncState | undefined> => {
  const now = new Date();
  await QuarkSyncState.findOrCreate({
    where: { key: SYNC_STATE_KEY },
    defaults: {
      key: SYNC_STATE_KEY,
      status: "BASELINING",
      baselineStartedAt: now,
      baselineCompletedAt: null,
      lastSuccessfulSyncAt: null,
      syncLockUntil: null,
      syncWorkerId: null,
      fingerprintVersion: FINGERPRINT_VERSION
    }
  });

  const [updated] = await QuarkSyncState.update(
    {
      syncLockUntil: new Date(Date.now() + 60 * 60 * 1000),
      syncWorkerId
    },
    {
      where: {
        key: SYNC_STATE_KEY,
        [Op.or]: [
          { syncLockUntil: null },
          { syncLockUntil: { [Op.lt]: now } },
          { syncWorkerId }
        ]
      }
    }
  );
  if (updated === 0) return undefined;
  return (await QuarkSyncState.findByPk(SYNC_STATE_KEY)) || undefined;
};

export const SyncQuarkAppointmentsService = async (
  config: QuarkConfig
): Promise<void> => {
  const state = await acquireSyncLock();
  if (!state) {
    logger.info("QuarkClinic synchronization skipped because the lock is held");
    return;
  }

  const baselineMode = state.status !== "ACTIVE";
  const coverageRepairMode =
    !baselineMode &&
    Number(state.fingerprintVersion || 1) < FINGERPRINT_VERSION;
  const today = startOfToday();
  let count = 0;

  try {
    const firstSweep = await fetchSnapshots(config, today);
    await processSnapshots(
      config,
      firstSweep,
      baselineMode,
      coverageRepairMode
    );
    count = firstSweep.length;

    if (baselineMode) {
      const verificationSweep = await fetchSnapshots(config, today);
      await processSnapshots(config, verificationSweep, true);
      count = verificationSweep.length;
    } else {
      await ensureNotificationCoverage(config, firstSweep);
    }

    await state.update({
      status: "ACTIVE",
      baselineCompletedAt: baselineMode
        ? new Date()
        : state.baselineCompletedAt,
      lastSuccessfulSyncAt: new Date(),
      syncLockUntil: null,
      syncWorkerId: null,
      fingerprintVersion: FINGERPRINT_VERSION
    });

    logger.info({
      info: "QuarkClinic appointments synchronized",
      count,
      baselineMode,
      coverageRepairMode,
      horizonDays: config.syncHorizonDays
    });
    emitQuarkDashboardUpdate("sync", SYNC_STATE_KEY);
  } catch (error) {
    await state
      .update({ syncLockUntil: null, syncWorkerId: null })
      .catch(() => undefined);
    throw error;
  }
};
