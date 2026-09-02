import crypto from "crypto";
import Ticket from "../../models/Ticket";

export type IntakeSpecialty = "PSYCHIATRY" | "PSYCHOLOGY" | "REPORT";

export interface IntakeProfessionalOption {
  professionalId: string;
  name: string;
  agendaIds: string[];
  specialtyId?: string;
}

export interface IntakeSlotOption {
  agendaId: string;
  date: string;
  time: string;
  interval: string;
}

export interface IntakeDateOption {
  date: string;
  label: string;
  slots: IntakeSlotOption[];
}

export interface IntakeAppointmentOption {
  appointmentId: string;
  patientId: string;
  patientName: string;
  professionalName: string;
  date: string;
  time: string;
  status: "AGENDADO" | "CONFIRMADO";
  scheduleFingerprint: string;
}

export interface PatientIntakeContext {
  menuVersion?: number;
  coverageInfo?: "HAPVIDA" | "PRIVATE";
  cpf?: string;
  patientName?: string;
  birthDate?: string;
  specialty?: IntakeSpecialty;
  payment?: "PRIVATE" | "INSURANCE";
  insurance?: string;
  professionalOptions?: IntakeProfessionalOption[];
  selectedProfessional?: IntakeProfessionalOption;
  dateOptions?: IntakeDateOption[];
  selectedDate?: IntakeDateOption;
  timeOptions?: IntakeSlotOption[];
  selectedSlot?: IntakeSlotOption;
  timePage?: number;
  appointmentOptions?: IntakeAppointmentOption[];
  selectedAppointment?: IntakeAppointmentOption;
  appointmentAction?: "CONFIRM" | "RESCHEDULE";
}

const ttlMilliseconds = (): number => {
  const configured = Number(process.env.PATIENT_INTAKE_CONTEXT_TTL_MINUTES);
  const minutes =
    Number.isFinite(configured) && configured > 0 ? configured : 240;
  return minutes * 60 * 1000;
};

const encryptionKey = (): Buffer => {
  const secret =
    process.env.PATIENT_INTAKE_CONTEXT_SECRET ||
    process.env.JWT_SECRET ||
    "patient-intake-development-key";
  if (
    process.env.NODE_ENV === "production" &&
    secret === "patient-intake-development-key"
  ) {
    throw new Error("Missing PATIENT_INTAKE_CONTEXT_SECRET or JWT_SECRET");
  }
  return crypto.createHash("sha256").update(secret).digest();
};

const encode = (value: Buffer): string =>
  value
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const decode = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64");
};

export const encryptIntakeContext = (context: PatientIntakeContext): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(context), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${encode(iv)}.${encode(tag)}.${encode(encrypted)}`;
};

export const decryptIntakeContext = (
  encrypted: string | null | undefined
): PatientIntakeContext => {
  if (!encrypted) return {};
  try {
    const [version, ivValue, tagValue, payloadValue] = encrypted.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !payloadValue) return {};
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      decode(ivValue)
    );
    decipher.setAuthTag(decode(tagValue));
    const decrypted = Buffer.concat([
      decipher.update(decode(payloadValue)),
      decipher.final()
    ]).toString("utf8");
    return JSON.parse(decrypted) as PatientIntakeContext;
  } catch {
    return {};
  }
};

export const loadIntakeContext = (ticket: Ticket): PatientIntakeContext => {
  if (
    ticket.intakeContextExpiresAt &&
    ticket.intakeContextExpiresAt.getTime() <= Date.now()
  ) {
    return {};
  }
  return decryptIntakeContext(ticket.intakeContext);
};

export const saveIntakeContext = async (
  ticket: Ticket,
  context: PatientIntakeContext,
  additionalFields: Record<string, unknown> = {}
): Promise<void> => {
  await ticket.update({
    ...additionalFields,
    intakeContext: encryptIntakeContext(context),
    intakeContextExpiresAt: new Date(Date.now() + ttlMilliseconds())
  });
};

export const clearIntakeContextFields = {
  intakeContext: null,
  intakeContextExpiresAt: null
};
