export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const MESSAGE_EDIT_MAX_LENGTH = 4096;

export const canEditMessage = (message, now = Date.now()) => {
  if (!message?.fromMe || message.isDeleted) return false;
  if (message.mediaType && message.mediaType !== "chat") return false;

  const humanMessage =
    message.origin === "HUMAN" ||
    (message.origin === "UNKNOWN" && Boolean(message.sentByUserId));
  if (!humanMessage) return false;

  const createdAt = Date.parse(message.createdAt);
  if (!Number.isFinite(createdAt)) return false;

  const age = now - createdAt;
  return age >= 0 && age <= MESSAGE_EDIT_WINDOW_MS;
};
