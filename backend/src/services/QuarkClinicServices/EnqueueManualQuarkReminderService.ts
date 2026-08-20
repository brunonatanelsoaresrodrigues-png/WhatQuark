import AppError from "../../errors/AppError";
import QuarkAppointment from "../../models/QuarkAppointment";
import { AppointmentSnapshot, appointmentCanBeConfirmed } from "./appointmentUtils";
import { getQuarkConfig } from "./config";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import { manualReminderAppointmentMessage } from "./messageTemplates";
import { createQuarkNotificationOnce } from "./notificationLedger";
import { QuarkAppointmentDto } from "./types";

interface Request {
  appointmentId: string;
}

interface StoredSnapshot {
  dataAgendamento?: string | null;
  horaAgendamento?: string | null;
  clinicaId?: number | string | null;
  clinicaNome?: string | null;
  profissionalId?: number | string | null;
  profissionalNome?: string | null;
  procedimentoId?: number | string | null;
  procedimentoNome?: string | null;
}

const parseStoredSnapshot = (value: string): StoredSnapshot => {
  try {
    return JSON.parse(value) as StoredSnapshot;
  } catch {
    return {};
  }
};

const localDateKey = (date: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: string): string =>
    parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const appointmentSnapshotFrom = (
  record: QuarkAppointment
): AppointmentSnapshot => {
  const stored = parseStoredSnapshot(record.snapshot);
  const raw: QuarkAppointmentDto = {
    id: record.appointmentId,
    pacienteId: record.patientId || undefined,
    nomePaciente: record.patientName,
    telefoneComDDI: record.phone || undefined,
    dataAgendamento: stored.dataAgendamento || undefined,
    horaAgendamento: stored.horaAgendamento || undefined,
    clinicaId: stored.clinicaId || undefined,
    clinicaNome: stored.clinicaNome || undefined,
    profissionalId: stored.profissionalId || undefined,
    profissional: stored.profissionalNome
      ? {
          id: stored.profissionalId || undefined,
          nome: stored.profissionalNome
        }
      : undefined,
    procedimentoId: stored.procedimentoId || undefined,
    procedimento: stored.procedimentoNome
      ? {
          id: stored.procedimentoId || undefined,
          nome: stored.procedimentoNome
        }
      : undefined,
    statusMarcacao: record.status
  };

  return {
    appointmentId: record.appointmentId,
    patientId: record.patientId,
    phone: record.phone,
    patientName: record.patientName,
    status: record.status,
    scheduledAt: record.scheduledAt,
    scheduleFingerprint: record.scheduleFingerprint,
    snapshotFingerprint: record.snapshotFingerprint,
    raw
  };
};

const EnqueueManualQuarkReminderService = async ({
  appointmentId
}: Request): Promise<{ queued: true }> => {
  const record = await QuarkAppointment.findOne({ where: { appointmentId } });

  if (!record) {
    throw new AppError("Agendamento não encontrado.", 404);
  }
  if (!appointmentCanBeConfirmed(record.status)) {
    throw new AppError(
      "Só é possível enviar lembretes para consultas agendadas.",
      409
    );
  }
  if (!record.phone) {
    throw new AppError("O paciente não possui telefone válido.", 409);
  }
  if (!record.scheduledAt || record.scheduledAt.getTime() <= Date.now()) {
    throw new AppError("A consulta já ocorreu ou não possui horário válido.", 409);
  }

  const config = getQuarkConfig();
  const snapshot = appointmentSnapshotFrom(record);
  const notificationKey = `manual-reminder:${localDateKey(
    new Date(),
    config.timezone
  )}:${record.scheduleFingerprint.slice(0, 24)}`;
  const queued = await createQuarkNotificationOnce(
    record.appointmentId,
    notificationKey,
    "MANUAL_REMINDER",
    {
      phone: record.phone,
      patientName: record.patientName,
      body: manualReminderAppointmentMessage(snapshot, config.clinicAddress),
      requestsConfirmation: true,
      validUntil: record.scheduledAt.toISOString()
    }
  );

  if (!queued) {
    throw new AppError(
      "Um lembrete manual já foi solicitado hoje para esta consulta.",
      409
    );
  }

  emitQuarkDashboardUpdate("notification", record.appointmentId);
  return { queued: true };
};

export default EnqueueManualQuarkReminderService;
