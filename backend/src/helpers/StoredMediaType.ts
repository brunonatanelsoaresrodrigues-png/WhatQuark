import { MessageType } from "../providers/WhatsApp/types";

export const storedMediaType = (
  messageType: MessageType,
  mimetype: string
): string =>
  messageType === "sticker"
    ? "sticker"
    : mimetype.split("/")[0] || messageType;
