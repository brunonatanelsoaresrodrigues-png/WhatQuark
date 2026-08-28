import { createHash } from "crypto";
import { QuarkConfig } from "./config";
import { QuarkAppointmentDto } from "./types";
import { clinicTimezone, dateParts, zonedDate } from "./clinicTime";

export interface AppointmentSnapshot {
  appointmentId: string;
  patientId: string | null;
  phone: string | null;
  phones: AppointmentPhone[];
  patientName: string;
  status: string;
  scheduledAt: Date | null;
  scheduleFingerprint: string;
  snapshotFingerprint: string;
  raw: QuarkAppointmentDto;
}

export interface AppointmentPhone {
  phone: string;
  source:
    | "telefoneComDDI"
    | "telefone"
    | "telefoneOutroComDDI"
    | "telefoneOutro"
    | "LEGACY";
  isPrimary: boolean;
}

const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const quarkPhoneKey = (phone: string): string =>
  hash(phone).slice(0, 16);

const digitsOnly = (value: string | undefined): string =>
  (value || "").replace(/\D/g, "");

export const normalizeQuarkPhone = (
  value: string | undefined,
  defaultCountryCode = "55",
  alreadyHasCountryCode = false
): string | null => {
  const digits = digitsOnly(value).replace(/^00/, "");
  if (!digits) return null;

  if (alreadyHasCountryCode) return digits;

  if (digits.length === 10 || digits.length === 11) {
    return `${defaultCountryCode}${digits}`;
  }

  return digits;
};

export const parseQuarkScheduledAt = (
  dateValue?: string,
  timeValue?: string,
  timezone = clinicTimezone()
): Date | null => {
  const dateMatch = (dateValue || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!dateMatch) return null;

  const timeMatch = (timeValue || "").match(
    /(?:T|^)(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!timeMatch) return null;

  const [, day, month, year] = dateMatch;
  const [, hour, minute, second = "0"] = timeMatch;
  return zonedDate(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    timezone
  );
};

export const selectQuarkPhones = (
  appointment: QuarkAppointmentDto,
  config: QuarkConfig
): AppointmentPhone[] => {
  const candidates: Array<Omit<AppointmentPhone, "isPrimary"> | null> = [
    appointment.telefoneComDDI
      ? {
          phone:
            normalizeQuarkPhone(
              appointment.telefoneComDDI,
              config.defaultCountryCode,
              true
            ) || "",
          source: "telefoneComDDI"
        }
      : appointment.telefone
      ? {
          phone:
            normalizeQuarkPhone(
              appointment.telefone,
              config.defaultCountryCode
            ) || "",
          source: "telefone"
        }
      : null,
    appointment.telefoneOutroComDDI
      ? {
          phone:
            normalizeQuarkPhone(
              appointment.telefoneOutroComDDI,
              config.defaultCountryCode,
              true
            ) || "",
          source: "telefoneOutroComDDI"
        }
      : appointment.telefoneOutro
      ? {
          phone:
            normalizeQuarkPhone(
              appointment.telefoneOutro,
              config.defaultCountryCode
            ) || "",
          source: "telefoneOutro"
        }
      : null
  ];
  const seen = new Set<string>();
  const phones: AppointmentPhone[] = [];
  candidates.forEach(candidate => {
    if (!candidate?.phone || seen.has(candidate.phone)) return;
    seen.add(candidate.phone);
    phones.push({ ...candidate, isPrimary: phones.length === 0 });
  });
  return phones;
};

export const buildAppointmentSnapshot = (
  appointment: QuarkAppointmentDto,
  config: QuarkConfig
): AppointmentSnapshot => {
  const scheduledAt = parseQuarkScheduledAt(
    appointment.dataAgendamento,
    appointment.horaAgendamento,
    config.timezone
  );
  const phones = selectQuarkPhones(appointment, config);

  const scheduleIdentity = {
    dataAgendamento: appointment.dataAgendamento || "",
    horaAgendamento: appointment.horaAgendamento || "",
    agendaId: appointment.agendaId || "",
    clinicaId: appointment.clinicaId || "",
    clinicaNome: appointment.clinicaNome || "",
    profissionalId: appointment.profissionalId || "",
    profissionalNome: appointment.profissional?.nome || "",
    procedimentoId: appointment.procedimentoId || "",
    procedimentoNome: appointment.procedimento?.nome || ""
  };

  return {
    appointmentId: String(appointment.id),
    patientId:
      appointment.pacienteId === undefined
        ? null
        : String(appointment.pacienteId),
    phone: phones[0]?.phone || null,
    phones,
    patientName: appointment.nomePaciente || "Paciente",
    status: appointment.statusMarcacao || "DESCONHECIDO",
    scheduledAt,
    scheduleFingerprint: hash(scheduleIdentity),
    snapshotFingerprint: hash({
      ...scheduleIdentity,
      status: appointment.statusMarcacao || "DESCONHECIDO",
      phones: phones.map(item => item.phone)
    }),
    raw: appointment
  };
};

export const formatAppointmentDateTime = (
  scheduledAt: Date | null
): { date: string; time: string } => {
  if (!scheduledAt) return { date: "data a confirmar", time: "" };
  const parts = dateParts(scheduledAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`
  };
};

export const appointmentIsCancelled = (status: string): boolean =>
  ["CANCELADO", "CANCELADO_VIA_SMS", "EXCLUIDO"].includes(status);

export const appointmentCanBeConfirmed = (status: string): boolean =>
  status === "AGENDADO";

export interface ConfirmationReply {
  choice: 1 | 2;
  appointmentReference?: string;
  confirmedCancellation?: boolean;
  appointmentOption?: number;
}

export const appointmentReference = (
  appointmentId: string,
  fingerprint: string,
  phone: string
): string =>
  hash(`${appointmentId}:${fingerprint}:${phone}`).slice(0, 8).toUpperCase();

export const parseConfirmationReply = (
  body: string
): ConfirmationReply | null => {
  const normalized = body
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (normalized === "SIM") return { choice: 1 };
  if (normalized === "NAO") return { choice: 2 };
  const command = normalized.match(
    /^(CONFIRMAR|CANCELAR|CONFIRMO CANCELAMENTO) ([A-F0-9]{8})$/
  );
  if (!command) return null;
  return {
    choice: command[1] === "CONFIRMAR" ? 1 : 2,
    appointmentReference: command[2],
    confirmedCancellation: command[1] === "CONFIRMO CANCELAMENTO"
  };
};

export const parseConfirmationChoice = (body: string): 1 | 2 | null =>
  parseConfirmationReply(body)?.choice || null;
