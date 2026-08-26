import { createHash } from "crypto";
import { QuarkConfig } from "./config";
import { QuarkAppointmentDto } from "./types";

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
  timezone = "America/Sao_Paulo"
): Date | null => {
  const dateMatch = (dateValue || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!dateMatch) return null;

  const timeMatch = (timeValue || "").match(
    /(?:T|^)(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!timeMatch) return null;

  const [, day, month, year] = dateMatch;
  const [, hour, minute, second = "0"] = timeMatch;
  const target = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second)
  };
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const partsInTimezone = (value: Date) => {
    const parts = formatter.formatToParts(value);
    const part = (type: string): number =>
      Number(parts.find(item => item.type === type)?.value || "0");
    return {
      year: part("year"),
      month: part("month"),
      day: part("day"),
      hour: part("hour"),
      minute: part("minute"),
      second: part("second")
    };
  };

  // Converte o horário de parede informado pelo Quark para um instante UTC,
  // sem depender do fuso horário configurado no servidor ou na CI.
  let timestamp = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rendered = partsInTimezone(new Date(timestamp));
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second
    );
    const adjustment = targetAsUtc - renderedAsUtc;
    timestamp += adjustment;
    if (adjustment === 0) break;
  }

  const parsed = new Date(timestamp);
  const rendered = partsInTimezone(parsed);
  const matchesTarget = Object.keys(target).every(
    key =>
      rendered[key as keyof typeof rendered] ===
      target[key as keyof typeof target]
  );

  return Number.isNaN(parsed.getTime()) || !matchesTarget ? null : parsed;
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
  scheduledAt: Date | null,
  timezone = "America/Sao_Paulo"
): { date: string; time: string } => {
  if (!scheduledAt) return { date: "data a confirmar", time: "" };
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(scheduledAt);
  const part = (type: string): string =>
    parts.find(item => item.type === type)?.value || "";

  return {
    date: `${part("day")}/${part("month")}/${part("year")}`,
    time: `${part("hour")}:${part("minute")}`
  };
};

export const appointmentIsCancelled = (status: string): boolean =>
  ["CANCELADO", "CANCELADO_VIA_SMS", "EXCLUIDO"].includes(status);

export const appointmentCanBeConfirmed = (status: string): boolean =>
  status === "AGENDADO";

export interface ConfirmationReply {
  choice: 1 | 2;
  appointmentOption?: number;
}

export const confirmationReplyRequiresExactContext = (body: string): boolean => {
  const normalized = body
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Respostas curtas tambem aparecem com frequencia em conversas comuns.
  // Exigimos que elas estejam imediatamente ligadas ao lembrete para evitar
  // confirmar/cancelar uma consulta quando o paciente respondia ao atendente.
  return /^(?:1|2|sim|nao)(?: [1-9]\d*)?$/.test(normalized);
};

export const parseConfirmationReply = (
  body: string
): ConfirmationReply | null => {
  const normalized = body
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const numeric = normalized.match(/^([12])(?:\D|$)/);
  if (numeric) return { choice: Number(numeric[1]) as 1 | 2 };

  const optionMatch = normalized.match(/(?:^|\s)(\d+)\s*$/);
  const decisionText = optionMatch
    ? normalized.slice(0, optionMatch.index).trim()
    : normalized;
  const positivePhrases = new Set([
    "sim",
    "sim confirmo",
    "confirmo",
    "comfirmo",
    "confirmar",
    "confirmar consulta",
    "pode confirmar",
    "pode confirmar minha consulta",
    "eu vou",
    "vou sim",
    "estarei presente",
    "ok eu vou"
  ]);
  const negativePhrases = new Set([
    "nao",
    "cancelar",
    "cancelar consulta",
    "pode cancelar",
    "pode cancelar minha consulta",
    "nao vou",
    "nao poderei ir",
    "nao poderei comparecer"
  ]);
  const positive = positivePhrases.has(decisionText);
  const negative = negativePhrases.has(decisionText);
  if (!positive && !negative) return null;

  const option = optionMatch ? Number(optionMatch[1]) : undefined;
  return {
    choice: negative ? 2 : 1,
    appointmentOption:
      option && Number.isSafeInteger(option) && option > 0 ? option : undefined
  };
};

export const parseConfirmationChoice = (body: string): 1 | 2 | null =>
  parseConfirmationReply(body)?.choice || null;
