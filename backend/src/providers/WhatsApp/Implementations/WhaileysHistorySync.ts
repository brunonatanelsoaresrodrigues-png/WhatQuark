import {
  BaileysEventMap,
  jidNormalizedUser,
  proto,
  WAMessage,
  WASocket
} from "whaileys";
import AppError from "../../../errors/AppError";
import { HistorySyncCursor } from "../types";

type HistorySocket = Pick<WASocket, "ev" | "fetchMessageHistory">;
const pendingRequests = new WeakMap<HistorySocket, (error: Error) => void>();

// Only download explicitly requested history. Initial/full history must not
// enter the live message handler or start automated conversations.
export const shouldSyncOnDemandHistory = (
  notification: proto.Message.IHistorySyncNotification
): boolean =>
  notification.syncType === proto.HistorySync.HistorySyncType.ON_DEMAND;

export const cancelHistoryRequest = (socket: HistorySocket): void => {
  pendingRequests.get(socket)?.(
    new AppError("ERR_HISTORY_SYNC_DISCONNECTED", 409)
  );
};

export const requestHistoryPage = async (
  socket: HistorySocket,
  cursor: HistorySyncCursor,
  count: number,
  timeoutMs = 45_000
): Promise<WAMessage[]> =>
  new Promise<WAMessage[]>((resolve, reject) => {
    if (pendingRequests.has(socket)) {
      reject(new AppError("ERR_HISTORY_SYNC_ALREADY_RUNNING", 409));
      return;
    }
    let settled = false;
    const chatIds = new Set(
      [cursor.chatId, ...(cursor.alternateChatIds || [])].map(jidNormalizedUser)
    );
    const matchesChat = (jid: string | null | undefined) =>
      !!jid && chatIds.has(jidNormalizedUser(jid));
    const cleanup = () => {
      clearTimeout(timeout);
      socket.ev.off("messaging-history.set", onHistory);
      socket.ev.off("connection.update", onConnection);
      pendingRequests.delete(socket);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onHistory = (history: BaileysEventMap["messaging-history.set"]) => {
      if (
        settled ||
        history.syncType !== proto.HistorySync.HistorySyncType.ON_DEMAND
      )
        return;
      // This installed provider does not expose the request ID in this event.
      // Keep a single request per socket and match confirmed LID/phone aliases;
      // unrelated chats and live/placeholder messages cannot finish the request.
      const messages = history.messages.filter(message =>
        matchesChat(message.key.remoteJid)
      );
      if (!messages.length && !history.chats.some(chat => matchesChat(chat.id)))
        return;
      settled = true;
      cleanup();
      resolve(messages);
    };
    const onConnection = ({
      connection
    }: BaileysEventMap["connection.update"]) => {
      if (connection === "close")
        fail(new AppError("ERR_HISTORY_SYNC_DISCONNECTED", 409));
    };
    const timeout = setTimeout(
      () => fail(new AppError("ERR_HISTORY_SYNC_TIMEOUT", 504)),
      timeoutMs
    );
    pendingRequests.set(socket, fail);
    socket.ev.on("messaging-history.set", onHistory);
    socket.ev.on("connection.update", onConnection);
    Promise.resolve()
      .then(() =>
        settled
          ? undefined
          : socket.fetchMessageHistory(
              count,
              {
                remoteJid: cursor.chatId,
                id: cursor.oldestMessageId,
                fromMe: cursor.oldestMessageFromMe
              },
              cursor.oldestMessageTimestampMs
            )
      )
      .catch(fail);
  });
