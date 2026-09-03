import { EventEmitter } from "events";
import { proto } from "whaileys";
import {
  cancelHistoryRequest,
  requestHistoryPage,
  shouldSyncOnDemandHistory
} from "../../../providers/WhatsApp/Implementations/WhaileysHistorySync";

const cursor = {
  chatId: "123456@lid",
  alternateChatIds: ["5511999999999@s.whatsapp.net"],
  oldestMessageId: "anchor",
  oldestMessageFromMe: false,
  oldestMessageTimestampMs: 1788450000000
};
const makeMessage = (remoteJid = cursor.chatId, id = "old") => ({
  key: { id, remoteJid },
  message: { conversation: "history" },
  messageTimestamp: 1788449990
});
const history = (
  messages: any[] = [makeMessage()],
  chats: any[] = [{ id: cursor.chatId }]
) => ({
  messages,
  chats,
  contacts: [],
  isLatest: false,
  syncType: proto.HistorySync.HistorySyncType.ON_DEMAND
});
const makeSocket = () => ({
  ev: new EventEmitter(),
  fetchMessageHistory: jest.fn().mockResolvedValue("request-id")
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("enables only requested ON_DEMAND history, not initial or full sync", () => {
  expect(
    shouldSyncOnDemandHistory({
      syncType: proto.HistorySync.HistorySyncType.ON_DEMAND
    })
  ).toBe(true);
  expect(
    shouldSyncOnDemandHistory({
      syncType: proto.HistorySync.HistorySyncType.RECENT
    })
  ).toBe(false);
  expect(
    shouldSyncOnDemandHistory({
      syncType: proto.HistorySync.HistorySyncType.FULL
    })
  ).toBe(false);
  expect(shouldSyncOnDemandHistory({})).toBe(false);
});

it("requests history in milliseconds and receives messaging-history.set", async () => {
  const socket = makeSocket();
  const result = requestHistoryPage(socket as any, cursor, 50);
  await Promise.resolve();
  expect(socket.fetchMessageHistory).toHaveBeenCalledWith(
    50,
    { remoteJid: cursor.chatId, id: "anchor", fromMe: false },
    cursor.oldestMessageTimestampMs
  );
  socket.ev.emit("messaging-history.set", history());
  await expect(result).resolves.toEqual([makeMessage()]);
  expect(socket.ev.listenerCount("messaging-history.set")).toBe(0);
  expect(socket.ev.listenerCount("connection.update")).toBe(0);
});

it("ignores placeholder/live events, non-demand history and other chats", async () => {
  const socket = makeSocket();
  const result = requestHistoryPage(socket as any, cursor, 50);
  socket.ev.emit("messages.pdo-response", { messages: [] });
  socket.ev.emit("messages.upsert", { messages: [makeMessage()] });
  socket.ev.emit("messaging-history.set", {
    ...history(),
    syncType: proto.HistorySync.HistorySyncType.RECENT
  });
  socket.ev.emit(
    "messaging-history.set",
    history([makeMessage("someone-else@lid")], [{ id: "someone-else@lid" }])
  );
  expect(socket.ev.listenerCount("messaging-history.set")).toBe(1);
  socket.ev.emit("messaging-history.set", history());
  await expect(result).resolves.toEqual([makeMessage()]);
});

it("accepts a confirmed phone alias and filters unrelated messages", async () => {
  const socket = makeSocket();
  const message = makeMessage(cursor.alternateChatIds[0]);
  const result = requestHistoryPage(socket as any, cursor, 50);
  socket.ev.emit(
    "messaging-history.set",
    history([message, makeMessage("other@lid")], [])
  );
  await expect(result).resolves.toEqual([message]);
});

it("recognizes an empty response only when the requested chat is identified", async () => {
  const socket = makeSocket();
  const result = requestHistoryPage(socket as any, cursor, 50);
  socket.ev.emit("messaging-history.set", history([], []));
  expect(socket.ev.listenerCount("messaging-history.set")).toBe(1);
  socket.ev.emit("messaging-history.set", history([]));
  await expect(result).resolves.toEqual([]);
});

it("fails with a bounded timeout and releases listeners for a later request", async () => {
  const socket = makeSocket();
  const result = requestHistoryPage(socket as any, cursor, 50);
  const assertion = expect(result).rejects.toThrow("ERR_HISTORY_SYNC_TIMEOUT");
  jest.advanceTimersByTime(45000);
  await assertion;
  expect(socket.ev.listenerCount("messaging-history.set")).toBe(0);
  const retry = requestHistoryPage(socket as any, cursor, 50);
  socket.ev.emit("messaging-history.set", history([]));
  await expect(retry).resolves.toEqual([]);
});

it("rejects a concurrent request without disturbing the first one", async () => {
  const socket = makeSocket();
  const first = requestHistoryPage(socket as any, cursor, 50);
  await expect(requestHistoryPage(socket as any, cursor, 50)).rejects.toThrow(
    "ERR_HISTORY_SYNC_ALREADY_RUNNING"
  );
  socket.ev.emit("messaging-history.set", history());
  await expect(first).resolves.toHaveLength(1);
});

it.each(["connection", "shutdown"])(
  "cancels promptly on %s without requesting more history",
  async kind => {
    const socket = makeSocket();
    const result = requestHistoryPage(socket as any, cursor, 50);
    const assertion = expect(result).rejects.toThrow(
      "ERR_HISTORY_SYNC_DISCONNECTED"
    );
    if (kind === "connection")
      socket.ev.emit("connection.update", { connection: "close" });
    else cancelHistoryRequest(socket as any);
    await assertion;
    expect(socket.fetchMessageHistory).not.toHaveBeenCalled();
    expect(socket.ev.listenerCount("messaging-history.set")).toBe(0);
  }
);

it("cleans up when the provider rejects the request", async () => {
  const socket = makeSocket();
  socket.fetchMessageHistory.mockRejectedValue(new Error("request-rejected"));
  await expect(requestHistoryPage(socket as any, cursor, 50)).rejects.toThrow(
    "request-rejected"
  );
  expect(socket.ev.listenerCount("messaging-history.set")).toBe(0);
});
