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
import WhatsappHistorySyncJob from "../../models/WhatsappHistorySyncJob";

export interface WhatsAppHistorySyncStatus extends HistorySyncProgress {
  whatsappId: number;
  status: "idle" | "running" | "completed" | "failed";
  limitedChats: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const jobs = new Map<number, WhatsAppHistorySyncStatus>();
const persistenceTails = new Map<number, Promise<void>>();
const lastProgressPersistedAt = new Map<number, number>();

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

const persistStatus = async (
  status: WhatsAppHistorySyncStatus
): Promise<void> => {
  await WhatsappHistorySyncJob.upsert({
    whatsappId: status.whatsappId,
    status: status.status,
    totalChats: status.totalChats,
    processedChats: status.processedChats,
    importedMessages: status.importedMessages,
    duplicateMessages: status.duplicateMessages,
    failedMessages: status.failedMessages,
    failedChats: status.failedChats,
    limitedChats: status.limitedChats,
    startedAt: status.startedAt ? new Date(status.startedAt) : null,
    finishedAt: status.finishedAt ? new Date(status.finishedAt) : null,
    error: status.error?.slice(0, 512) || null
  });
};

const queueStatusPersistence = (
  status: WhatsAppHistorySyncStatus
): Promise<void> => {
  const snapshot = { ...status };
  const previous = persistenceTails.get(status.whatsappId) || Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(() => persistStatus(snapshot))
    .catch(error =>
      logger.error({
        info: "Could not persist WhatsApp history synchronization status",
        whatsappId: status.whatsappId,
        err: error
      })
    );
  persistenceTails.set(status.whatsappId, current);
  return current;
};

const publishStatus = (
  status: WhatsAppHistorySyncStatus,
  forcePersist = false
): Promise<void> | undefined => {
  jobs.set(status.whatsappId, { ...status });
  getIO().emit("historySync", { ...status });
  const now = Date.now();
  if (
    forcePersist ||
    now - (lastProgressPersistedAt.get(status.whatsappId) || 0) >= 2000
  ) {
    lastProgressPersistedAt.set(status.whatsappId, now);
    return queueStatusPersistence(status);
  }
  return undefined;
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
    await publishStatus(runningStatus, true);

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

    await publishStatus(
      {
        ...runningStatus,
        ...result,
        status: "completed",
        finishedAt: new Date().toISOString()
      },
      true
    );
  } catch (error) {
    logger.error({
      info: "WhatsApp history synchronization failed",
      whatsappId,
      err: error
    });
    const latest = jobs.get(whatsappId) || initialStatus;
    await publishStatus(
      {
        ...latest,
        status: "failed",
        finishedAt: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : "ERR_HISTORY_SYNC_FAILED"
      },
      true
    );
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
  await publishStatus(status, true);
  void runHistorySync(whatsappId, status);
  return { ...status };
};

export const GetWhatsAppHistorySyncStatusService = async (
  whatsappId: number
): Promise<WhatsAppHistorySyncStatus> => {
  const current = jobs.get(whatsappId);
  if (current) return { ...current };

  const persisted = await WhatsappHistorySyncJob.findOne({
    where: { whatsappId }
  });
  if (!persisted) return emptyStatus(whatsappId);

  const restored: WhatsAppHistorySyncStatus = {
    whatsappId,
    status: persisted.status,
    totalChats: persisted.totalChats,
    processedChats: persisted.processedChats,
    importedMessages: persisted.importedMessages,
    duplicateMessages: persisted.duplicateMessages,
    failedMessages: persisted.failedMessages,
    failedChats: persisted.failedChats,
    limitedChats: persisted.limitedChats,
    startedAt: persisted.startedAt?.toISOString() || null,
    finishedAt: persisted.finishedAt?.toISOString() || null,
    error: persisted.error
  };

  if (restored.status === "running") {
    restored.status = "failed";
    restored.finishedAt = new Date().toISOString();
    restored.error = "ERR_HISTORY_SYNC_INTERRUPTED_RESTART_REQUIRED";
    await publishStatus(restored, true);
  } else {
    jobs.set(whatsappId, restored);
  }
  return { ...restored };
};

export { buildHistoryCursors };
