import { Op } from "sequelize";
import { randomBytes } from "crypto";
import AutomationState from "../../models/AutomationState";
import OutboundMessage from "../../models/OutboundMessage";
import QuarkAppointmentNotification from "../../models/QuarkAppointmentNotification";
import { readState, withLease, writeState } from "./state";

export interface MessagingPreference {
  consent: "UNKNOWN" | "GRANTED" | "REVOKED";
  changedAt: string | null;
  source: string | null;
  actorUserId: number | null;
  relationship: string | null;
  version: string;
}
const empty: MessagingPreference = {
  consent: "UNKNOWN",
  changedAt: null,
  source: null,
  actorUserId: null,
  relationship: null,
  version: "appointment-notices-v1"
};
export const getPreference = (phone: string) =>
  readState(`preference:${phone}`, empty);
export const setPreference = async (
  phone: string,
  consent: "GRANTED" | "REVOKED",
  source: string,
  actorUserId: number | null = null,
  relationship = "Próprio paciente"
) =>
  withLease(`preference:${phone}`, async () => {
    const next = {
      consent,
      source,
      actorUserId,
      relationship,
      version: empty.version,
      changedAt: new Date().toISOString()
    };
    await AutomationState.create({
      id: `consent-audit:${randomBytes(16).toString("hex")}`,
      data: JSON.stringify({ phone, ...next })
    });
    await writeState(`preference:${phone}`, next);
    if (consent === "REVOKED") {
      await QuarkAppointmentNotification.update(
        { status: "SUPPRESSED", lastError: "Recipient opted out" },
        {
          where: {
            recipientPhone: phone,
            status: { [Op.in]: ["PENDING", "FAILED_RETRY"] }
          }
        }
      );
      // Dispatcher checks the preference again for every send, including rows already claimed.
      const pending = await OutboundMessage.findAll({
        where: { recipient: phone, status: "PENDING" }
      });
      for (const row of pending)
        if (JSON.parse(row.payload).options?.policy?.proactive)
          await row.update({
            status: "BLOCKED",
            errorCode: "ERR_RECIPIENT_OPTED_OUT"
          });
    }
    return next;
  });
export const preferenceCommand = (
  body: string
): "GRANTED" | "REVOKED" | null => {
  const value = body
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (/^(PARAR|SAIR|STOP|CANCELAR AVISOS)$/.test(value)) return "REVOKED";
  return value === "AUTORIZO AVISOS DE CONSULTA" ? "GRANTED" : null;
};
export const recordInbound = async (
  phone: string,
  whatsappId: number,
  timestamp: number
): Promise<void> => {
  const millis = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  if (!Number.isFinite(millis) || millis > Date.now() + 60000) return;
  const id = `inbound-time:${whatsappId}:${phone}`;
  await withLease(`record:${id}`, async () => {
    const previous = await readState<string | null>(id, null);
    if (!previous || new Date(previous).getTime() < millis)
      await writeState(id, new Date(millis).toISOString());
  });
};
