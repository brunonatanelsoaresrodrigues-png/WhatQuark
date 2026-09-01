import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import {
  AppointmentPhone,
  AppointmentSnapshot,
  appointmentCanBeConfirmed,
  appointmentReference,
  quarkPhoneKey
} from "./appointmentUtils";
import { getQuarkConfig } from "./config";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";
import { manualReminderAppointmentMessage } from "./messageTemplates";
import { createQuarkNotificationOnce } from "./notificationLedger";
import { QuarkAppointmentDto } from "./types";

import { assertExecution } from "../MessagingServices/policy";
import {
  canReceiveAppointmentNotices,
  getPreference
} from "../MessagingServices/preferences";
import { withLease } from "../MessagingServices/state";

interface Request {
  appointmentId: string;
  fingerprint?: string;
  phone?: string;
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
  cpf?: string | null;
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

export const appointmentSnapshotFrom = (
  record: QuarkAppointment
): AppointmentSnapshot => {
  const stored = parseStoredSnapshot(record.snapshot);
  let storedPhones: string[] = record.phone ? [record.phone] : [];
  try {
    const parsed = JSON.parse(record.phones || "[]");
    if (Array.isArray(parsed)) {
      storedPhones = parsed.filter(phone => typeof phone === "string");
    }
  } catch {
    // Legacy rows keep using the primary phone.
  }
  const phones: AppointmentPhone[] = storedPhones.map((phone, index) => ({
    phone,
    source: "LEGACY",
    isPrimary: index === 0
  }));
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
    statusMarcacao: record.status,
    cpf: stored.cpf || undefined
  };

  return {
    appointmentId: record.appointmentId,
    patientId: record.patientId,
    phone: record.phone,
    phones,
    patientName: record.patientName,
    cpf: stored.cpf || null,
    status: record.status,
    scheduledAt: record.scheduledAt,
    scheduleFingerprint: record.scheduleFingerprint,
    snapshotFingerprint: record.snapshotFingerprint,
    raw
  };
};

const EnqueueManualQuarkReminderService = async ({
  appointmentId,
  fingerprint,
  phone
}: Request): Promise<{ queued: true; recipients: number }> =>
  withLease(`quark-appointment:${appointmentId}`, async () => {
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
    if (
      (fingerprint && fingerprint !== record.scheduleFingerprint) ||
      (phone && phone !== record.phone)
    )
      throw new AppError("ERR_APPOINTMENT_CHANGED", 409);
    const snapshot = appointmentSnapshotFrom(record);
    if (snapshot.phones.length === 0) {
      throw new AppError("O paciente não possui telefone válido.", 409);
    }
    if (!record.scheduledAt || record.scheduledAt.getTime() <= Date.now()) {
      throw new AppError(
        "A consulta já ocorreu ou não possui horário válido.",
        409
      );
    }

    const config = getQuarkConfig();
    const notificationKey = `manual-reminder:${localDateKey(
      new Date(),
      config.timezone
    )}:${record.scheduleFingerprint.slice(0, 24)}`;
    let recipients = 0;
    if (!record.phone) throw new AppError("ERR_INVALID_RECIPIENT", 409);
    await assertExecution(record.phone, true);
    const preference = await getPreference(record.phone);
    if (!canReceiveAppointmentNotices(preference))
      throw new AppError(
        preference.consent === "REVOKED"
          ? "ERR_RECIPIENT_OPTED_OUT"
          : "ERR_CONSENT_REQUIRED",
        409
      );
    const existingAutomatic = await QuarkAppointmentNotification.findOne({
      where: {
        appointmentId: record.appointmentId,
        recipientPhone: record.phone,
        eventType: "REMINDER",
        status: {
          [Op.in]: [
            "PENDING",
            "PROCESSING",
            "FAILED_RETRY",
            "SENT",
            "UNKNOWN"
          ]
        },
        payload: { [Op.like]: `%${record.scheduleFingerprint}%` }
      }
    });
    if (existingAutomatic)
      throw new AppError(
        "Um lembrete automático já foi enviado ou está na fila para esta consulta.",
        409
      );
    for (const recipient of snapshot.phones
      .filter(p => p.phone === record.phone)
      .slice(0, 1)) {
      const queued = await createQuarkNotificationOnce(
        record.appointmentId,
        `${notificationKey}:to:${quarkPhoneKey(recipient.phone)}`,
        "MANUAL_REMINDER",
        {
          phone: recipient.phone,
          patientName: record.patientName,
          body: `${manualReminderAppointmentMessage(
            snapshot,
            config.clinicAddress
          )}\n\nPara confirmar, responda:\n*CONFIRMAR ${appointmentReference(
            record.appointmentId,
            record.scheduleFingerprint,
            recipient.phone
          )}*\n\nPara solicitar o cancelamento, responda:\n*CANCELAR ${appointmentReference(
            record.appointmentId,
            record.scheduleFingerprint,
            recipient.phone
          )}*\n\nPara deixar de receber avisos, responda *PARAR*.`,
          scheduleFingerprint: record.scheduleFingerprint,
          requestsConfirmation: true,
          validUntil: record.scheduledAt.toISOString()
        }
      );
      if (queued) recipients += 1;
    }

    if (recipients === 0) {
      throw new AppError(
        "Um lembrete manual já foi solicitado hoje para esta consulta.",
        409
      );
    }

    emitQuarkDashboardUpdate("notification", record.appointmentId);
    return { queued: true, recipients };
  });

export default EnqueueManualQuarkReminderService;
