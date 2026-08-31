import AutomationState from "../../models/AutomationState";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import HandleQuarkConfirmationReply from "../QuarkClinicServices/HandleQuarkConfirmationReply";
import { parseConfirmationReply } from "../QuarkClinicServices/appointmentUtils";
import PatientIntakeService from "../PatientIntakeServices/PatientIntakeService";
import PausePatientIntakeService from "../PatientIntakeServices/PausePatientIntakeService";
import { digest, readState, writeState, withLease } from "./state";
import { assertExecution } from "./policy";
import { preferenceCommand, setPreference } from "./preferences";
import { logger } from "../../utils/logger";

interface Input {
  ticketId: number;
  whatsappId: number;
  phone: string;
  body: string;
  messageId: string;
}
export const HandleInboundAutomation = async (input: Input): Promise<void> => {
  const eventId = `incoming:${digest(
    `${input.whatsappId}:${input.messageId}`
  )}`;
  await AutomationState.findOrCreate({
    where: { id: eventId },
    defaults: { id: eventId, data: JSON.stringify({ status: "PENDING" }) }
  });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await withLease(`bot-session:${input.ticketId}`, async () => {
        const event = await readState(eventId, { status: "UNKNOWN" });
        if (event.status !== "PENDING") return;
        await writeState(eventId, { status: "PROCESSING" });
        await writeState(`bot-current-event:${input.ticketId}`, eventId);
        const ticket = await ShowTicketService(input.ticketId);
        const reply = (body: string, suffix: string, bot = true) =>
          SendWhatsAppMessage({
            body,
            ticket,
            origin: "BOT",
            policy: {
              bot,
              botEventId: bot ? eventId : undefined,
              allowPausedBot: suffix === "handoff",
              ...(suffix === "menu" || suffix === "clarify"
                ? { expectedQueueId: ticket.queueId || null }
                : {}),
              idempotencyKey: `${eventId}:${suffix}`,
              expiresAt: new Date(Date.now() + 5 * 60000).toISOString()
            }
          }).catch(error => {
            if (
              error instanceof Error &&
              error.message === "ERR_MESSAGE_QUEUED"
            )
              return undefined;
            throw error;
          });
        try {
          const preference = preferenceCommand(input.body);
          if (preference) {
            await setPreference(
              input.phone,
              preference,
              "Comando explícito recebido no WhatsApp"
            );
            await reply(
              preference === "REVOKED"
                ? "Os avisos automáticos foram desativados. Você continua podendo falar com nossa equipe por aqui."
                : "Autorização registrada para avisos de consulta. Para desativar, responda PARAR.",
              "preference",
              false
            ).catch(() => undefined);
          } else if (!ticket.userId && ticket.status !== "closed") {
            const botPaused = await readState(
              `bot-pause:${ticket.id}`,
              false
            );
            const human =
              /^(atendente|humano|ajuda|falar com atendente)$/i.test(
                input.body.trim()
              );
            const appointmentReply = parseConfirmationReply(input.body);
            const handled =
              !human &&
              (!botPaused || !!appointmentReply) &&
              (await HandleQuarkConfirmationReply({
                ...input,
                ticket
              }));
            if (!handled && !botPaused) {
              await assertExecution(input.phone);
            }
            if (!handled && !botPaused && !ticket.queueId) {
              const whatsapp = await ShowWhatsAppService(input.whatsappId);
              if (!human) {
                const priorStatus = ticket.intakeStatus;
                const attemptsKey = `intake-attempts:${ticket.id}`;
                const attempts = await readState(attemptsKey, {
                  status: priorStatus,
                  count: 0
                });
                if (attempts.status === priorStatus && attempts.count >= 2) {
                  await PausePatientIntakeService(ticket);
                  await writeState(`bot-pause:${ticket.id}`, true);
                  const queue =
                    whatsapp.queues.find(
                      q => q.id === Number(process.env.BOT_FALLBACK_QUEUE_ID)
                    ) || whatsapp.queues[0];
                  if (queue)
                    await UpdateTicketService({
                      ticketId: ticket.id,
                      ticketData: { queueId: queue.id }
                    });
                  await reply(
                    "Vou encaminhar sua mensagem para nossa equipe. Você não precisa repetir as informações.",
                    "handoff"
                  );
                  await writeState(eventId, {
                    status: "APPLIED",
                    ticketId: ticket.id
                  });
                  return;
                }
                const intake = await PatientIntakeService(
                  ticket,
                  input.body,
                  eventId
                );
                await writeState(attemptsKey, {
                  status: ticket.intakeStatus,
                  count:
                    priorStatus &&
                    priorStatus === ticket.intakeStatus &&
                    !/^(MENU|0)$/i.test(input.body.trim())
                      ? (attempts.status === priorStatus ? attempts.count : 0) +
                        1
                      : 0
                });
                if (intake.showQueueMenu) {
                  const queue =
                    whatsapp.queues.find(
                      q => q.id === Number(process.env.BOT_FALLBACK_QUEUE_ID)
                    ) || whatsapp.queues[0];
                  await writeState(`bot-pause:${ticket.id}`, true);
                  if (queue)
                    await UpdateTicketService({
                      ticketId: ticket.id,
                      ticketData: { queueId: queue.id }
                    });
                  await writeState(eventId, {
                    status: "APPLIED",
                    ticketId: ticket.id
                  });
                  return;
                }
                if (intake.handled && !intake.showQueueMenu) {
                  await writeState(eventId, {
                    status: "APPLIED",
                    ticketId: ticket.id
                  });
                  return;
                }
              }
              const menuKey = `menu:${ticket.id}`;
              const state = await readState(menuKey, {
                shown: false,
                attempts: 0
              });
              const option = /^\d+$/.test(input.body.trim())
                ? Number(input.body.trim())
                : 0;
              const selected = state.shown
                ? whatsapp.queues[option - 1]
                : undefined;
              if (
                selected ||
                human ||
                whatsapp.queues.length === 1 ||
                state.attempts >= 1
              ) {
                const queue =
                  selected ||
                  whatsapp.queues.find(
                    q => q.id === Number(process.env.BOT_FALLBACK_QUEUE_ID)
                  ) ||
                  whatsapp.queues[0];
                await writeState(`bot-pause:${ticket.id}`, true);
                await PausePatientIntakeService(ticket);
                if (queue)
                  await UpdateTicketService({
                    ticketId: ticket.id,
                    ticketData: { queueId: queue.id }
                  });
                await reply(
                  "Vou encaminhar sua mensagem para nossa equipe. Você não precisa repetir as informações.",
                  "handoff"
                );
              } else if (whatsapp.queues.length) {
                await writeState(menuKey, {
                  shown: true,
                  attempts: state.shown ? state.attempts + 1 : 0
                });
                const options = whatsapp.queues
                  .map((q, i) => `${i + 1} — ${q.name}`)
                  .join("\n");
                await reply(
                  state.shown
                    ? "Não entendi a opção. Você pode responder com o número do setor ou escrever ATENDENTE."
                    : `Olá! Sou o assistente de atendimento. Como podemos ajudar?\n\n${options}\n\nEscreva ATENDENTE para falar com a equipe.`,
                  state.shown ? "clarify" : "menu"
                );
              }
            }
          }
          await writeState(eventId, { status: "APPLIED", ticketId: ticket.id });
        } catch (error) {
          const code =
            error instanceof Error ? error.message : "ERR_AUTOMATION_FAILED";
          await writeState(eventId, {
            status: "REVIEW",
            ticketId: ticket.id,
            errorCode: code
          });
          if (
            ![
              "ERR_MESSAGING_PAUSED",
              "ERR_QUARK_SIMULATION",
              "ERR_TEST_RECIPIENT_NOT_ALLOWED"
            ].includes(code)
          )
            await writeState(`bot-pause:${ticket.id}`, true);
          await writeState(`bot-review:${ticket.id}`, {
            errorCode: code,
            createdAt: new Date().toISOString()
          });
          logger.warn({
            info: "Automation stopped safely",
            ticketId: ticket.id,
            errorCode: code
          });
        }
      });
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ERR_OPERATION_BUSY")
        throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  await writeState(`bot-pause:${input.ticketId}`, true);
  logger.warn({
    info: "Conversation requires human review after contention",
    ticketId: input.ticketId
  });
};
