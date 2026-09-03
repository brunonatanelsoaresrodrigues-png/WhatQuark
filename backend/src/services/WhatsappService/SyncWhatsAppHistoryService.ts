import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getIO } from "../../libs/socket";
import { whatsappProvider } from "../../providers/WhatsApp";
import {
  HistorySyncCursor,
  HistorySyncProgress
} from "../../providers/WhatsApp/types";
import { logger } from "../../utils/logger";
import ShowWhatsAppService from "./ShowWhatsAppService";

export interface WhatsAppHistorySyncStatus extends HistorySyncProgress {
  whatsappId: number;
  status: "idle" | "running" | "completed" | "failed";
  limitedChats: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const jobs = new Map<number, WhatsAppHistorySyncStatus>();

const emptyStatus = (whatsappId: number): WhatsAppHistorySyncStatus => ({
  whatsappId,
  status: "idle",
  totalChats: 0,
  processedChats: 0,
  importedMessages: 0,
  duplicateMessages: 0,
  failedMessages: 0,
  failedChats: 0,
  limitedChats: 0,
  startedAt: null,
  finishedAt: null,
  error: null
});

const publishStatus = (status: WhatsAppHistorySyncStatus): void => {
  jobs.set(status.whatsappId, { ...status });
  getIO().emit("historySync", { ...status });
};

const chatIdForContact = (contact: Contact): string => {
  if (contact.isGroup) return `${contact.number}@g.us`;
  if (contact.lid) {
    return contact.lid.includes("@") ? contact.lid : `${contact.lid}@lid`;
  }
  return `${contact.number}@s.whatsapp.net`;
};

const buildHistoryCursors = async (
  whatsappId: number
): Promise<HistorySyncCursor[]> => {
  const messages = await Message.findAll({
    attributes: ["id", "fromMe", "createdAt"],
    include: [
      {
        model: Ticket,
        as: "ticket",
        required: true,
        attributes: ["id"],
        where: { whatsappId, ticketType: "PATIENT" },
        include: [
          {
            model: Contact,
            as: "contact",
            required: true,
            attributes: ["id", "number", "lid", "isGroup"]
          }
        ]
      }
    ],
    // Começa na mensagem local mais recente e pagina para trás. Assim a
    // sincronização também preenche lacunas no meio do histórico, enquanto os
    // IDs já existentes são descartados de forma idempotente.
    order: [["createdAt", "DESC"]]
  });

  const cursorsByChat = new Map<string, HistorySyncCursor>();
  messages.forEach(message => {
    const contact = message.ticket?.contact;
    if (!contact || (!contact.number && !contact.lid)) return;
    const chatId = chatIdForContact(contact);
    if (cursorsByChat.has(chatId)) return;
    const createdAt = new Date(message.createdAt).getTime();
    if (!message.id || Number.isNaN(createdAt)) return;

    cursorsByChat.set(chatId, {
      chatId,
      ...(!contact.isGroup && contact.lid && /^\d{8,15}$/.test(contact.number)
        ? { alternateChatIds: [`${contact.number}@s.whatsapp.net`] }
        : {}),
      oldestMessageId: message.id,
      oldestMessageFromMe: Boolean(message.fromMe),
      oldestMessageTimestampMs: createdAt
    });
  });

  return Array.from(cursorsByChat.values());
};

const runHistorySync = async (
  whatsappId: number,
  initialStatus: WhatsAppHistorySyncStatus
): Promise<void> => {
  try {
    const whatsapp = await ShowWhatsAppService(whatsappId);
    if (whatsapp.status !== "CONNECTED") {
      throw new Error("ERR_HISTORY_SYNC_REQUIRES_CONNECTED_WHATSAPP");
    }

    const cursors = await buildHistoryCursors(whatsappId);
    const runningStatus = {
      ...initialStatus,
      totalChats: cursors.length
    };
    publishStatus(runningStatus);

    const result = await whatsappProvider.syncHistory(
      whatsappId,
      cursors,
      progress => {
        publishStatus({
          ...runningStatus,
          ...progress,
          status: "running"
        });
      }
    );

    publishStatus({
      ...runningStatus,
      ...result,
      status: "completed",
      finishedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error({
      info: "WhatsApp history synchronization failed",
      whatsappId,
      err: error
    });
    const latest = jobs.get(whatsappId) || initialStatus;
    publishStatus({
      ...latest,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "ERR_HISTORY_SYNC_FAILED"
    });
  }
};

export const StartWhatsAppHistorySyncService = async (
  whatsappId: number
): Promise<WhatsAppHistorySyncStatus> => {
  const existing = jobs.get(whatsappId);
  if (existing?.status === "running") return { ...existing };

  const status: WhatsAppHistorySyncStatus = {
    ...emptyStatus(whatsappId),
    status: "running",
    startedAt: new Date().toISOString()
  };
  publishStatus(status);
  void runHistorySync(whatsappId, status);
  return { ...status };
};

export const GetWhatsAppHistorySyncStatusService = (
  whatsappId: number
): WhatsAppHistorySyncStatus => ({
  ...(jobs.get(whatsappId) || emptyStatus(whatsappId))
});

export { buildHistoryCursors };
