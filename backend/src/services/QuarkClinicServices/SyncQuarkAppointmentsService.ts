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
  changedAppointmentMessage,
  reminderAppointmentMessage
} from "./messageTemplates";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import RecordQuarkAppointmentEventService from "./RecordQuarkAppointmentEventService";
import { dueReminder } from "./reminderTiming";

const SYNC_STATE_KEY = "appointments";
const FINGERPRINT_VERSION = 2;
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
  baselineMode: boolean
): Promise<void> => {
  if (baselineMode) {
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

  // Encontrar um registro novo na sincronização não significa que o paciente
  // deve ser contatado imediatamente. O único envio automático de confirmação
  // acontece quando a consulta entra em uma janela de lembrete configurada.
  await createDueReminder(config, snapshot);
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
  const phoneChanged =
    record.phone !== snapshot.phone ||
    (record.fingerprintVersion >= FINGERPRINT_VERSION && phoneListChanged);
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
  baselineMode: boolean
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
      await processNewAppointment(config, snapshot, baselineMode);
    }
    await syncRecipients(snapshot);
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
  const today = startOfToday();
  let count = 0;

  try {
    const firstSweep = await fetchSnapshots(config, today);
    await processSnapshots(config, firstSweep, baselineMode);
    count = firstSweep.length;

    if (baselineMode) {
      const verificationSweep = await fetchSnapshots(config, today);
      await processSnapshots(config, verificationSweep, true);
      count = verificationSweep.length;
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
