import AppError from "../../errors/AppError";
import { readState } from "./state";

export type MessagingMode = "off" | "simulation" | "test" | "production";
export interface SendPolicy {
  origin?: string;
  sentByUserId?: number | null;
  outboundId?: string;
  allowPausedBot?: boolean;
  expectedQueueId?: number | null;
  ticketId?: number;
  idempotencyKey?: string;
  cleanupMediaPath?: boolean;
  proactive?: boolean;
  internalReport?: boolean;
  appointmentNotice?: boolean;
  bot?: boolean;
  botEventId?: string;
  expiresAt?: string;
  appointmentId?: string;
  scheduleFingerprint?: string;
  allowCancelledAppointment?: boolean;
  allowNoShowAppointment?: boolean;
  allowConfirmedAppointment?: boolean;
  allowSameDayRescheduledAppointment?: boolean;
  allowAppointmentPhoneVariants?: boolean;
  sendOnlyOnWeekday?: number;
  template?: { name: string; language: string; parameters: string[] };
}
export const modeFrom = (value = process.env.MESSAGING_MODE): MessagingMode => {
  if (!value) return "simulation";
  if (!["off", "simulation", "test", "production"].includes(value))
    throw new AppError("ERR_INVALID_MESSAGING_MODE", 503);
  return value as MessagingMode;
};
export const messagingStatus = async () => {
  const official = process.env.WHATSAPP_PROVIDER === "cloud";
  return {
    mode: modeFrom(),
    paused: await readState("messaging:paused", false),
    provider: process.env.WHATSAPP_PROVIDER || "wwebjs",
    official,
    appointmentNoticesRequireOptIn:
      official &&
      process.env.QUARK_APPOINTMENT_NOTICES_REQUIRE_OPT_IN === "true"
  };
};
export const assertExecution = async (
  phone?: string,
  quark = false
): Promise<void> => {
  const { mode, paused } = await messagingStatus();
  if (paused || mode === "off" || mode === "simulation")
    throw new AppError("ERR_MESSAGING_PAUSED", 409);
  if (mode === "test") {
    const allowlist = (process.env.MESSAGING_TEST_ALLOWLIST || "")
      .split(",")
      .map(v => v.replace(/\D/g, ""))
      .filter(Boolean);
    if (!phone || !allowlist.includes(phone))
      throw new AppError("ERR_TEST_RECIPIENT_NOT_ALLOWED", 409);
  }
  if (quark) {
    if (
      process.env.QUARK_INTEGRATION_ENABLED !== "true" ||
      process.env.QUARK_DRY_RUN !== "false"
    )
      throw new AppError("ERR_QUARK_SIMULATION", 409);
    const allowed = (process.env.QUARK_TEST_ALLOWLIST || "")
      .split(",")
      .map(v => v.replace(/\D/g, ""))
      .filter(Boolean);
    if (allowed.length && (!phone || !allowed.includes(phone)))
      throw new AppError("ERR_TEST_RECIPIENT_NOT_ALLOWED", 409);
  }
};
export const appointmentStatusesForPolicy = (policy: SendPolicy): string[] =>
  policy.allowCancelledAppointment
    ? ["CANCELADO", "CANCELADO_VIA_SMS", "EXCLUIDO"]
    : policy.allowNoShowAppointment
    ? ["FALTOU", "NAO_COMPARECEU", "NÃO_COMPARECEU", "AUSENTE"]
    : policy.allowSameDayRescheduledAppointment
    ? ["AGENDADO", "CONFIRMADO", "AGUARDANDO_ATENDIMENTO"]
    : policy.allowConfirmedAppointment
    ? ["AGENDADO", "CONFIRMADO"]
    : ["AGENDADO"];
export const inServiceWindow = (
  lastInboundAt: string | null,
  now = Date.now()
): boolean => {
  const time = lastInboundAt ? new Date(lastInboundAt).getTime() : NaN;
  return Number.isFinite(time) && time <= now && now - time < 24 * 60 * 60000;
};
