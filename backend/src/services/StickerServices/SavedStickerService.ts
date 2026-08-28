import { createHash } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { Readable } from "stream";
import AppError from "../../errors/AppError";
import uploadConfig from "../../config/upload";
import Message from "../../models/Message";
import SavedSticker from "../../models/SavedSticker";
import { safeMediaFilename } from "../../helpers/SafeMediaFilename";
import AssertTicketAccess from "../TicketServices/AssertTicketAccess";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";

const stickersDirectory = path.join(uploadConfig.directory, "stickers");
const maximumStickerBytes = 5 * 1024 * 1024;

export interface SerializedSticker {
  id: number;
  name: string | null;
  mimeType: string;
  mediaUrl: string;
  createdByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const serialize = (sticker: SavedSticker): SerializedSticker => ({
  id: sticker.id,
  name: sticker.name,
  mimeType: sticker.mimeType,
  mediaUrl: `/stickers/${sticker.id}/media`,
  createdByUserId: sticker.createdByUserId,
  createdAt: sticker.createdAt,
  updatedAt: sticker.updatedAt
});

const stickerFile = async (sticker: SavedSticker): Promise<string> => {
  const root = await fs.realpath(uploadConfig.directory);
  const file = await fs.realpath(path.join(root, sticker.storageKey));
  const relative = path.relative(root, file);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !relative.startsWith(`stickers${path.sep}`)
  )
    throw new AppError("ERR_NO_STICKER_FOUND", 404);
  return file;
};

export const listSavedStickers = async (): Promise<SerializedSticker[]> => {
  const stickers = await SavedSticker.findAll({
    order: [["updatedAt", "DESC"]],
    limit: 250
  });
  return stickers.map(serialize);
};

export const saveStickerFromMessage = async (
  messageId: string,
  userId: number,
  requestedName?: string
): Promise<SerializedSticker> => {
  const message = await Message.findByPk(messageId);
  if (!message || message.isDeleted || !message.ticketId)
    throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  await AssertTicketAccess(message.ticketId, userId);

  const mediaName = message.getDataValue("mediaUrl") as string | null;
  const legacyWebp = Boolean(mediaName && /\.webp$/i.test(mediaName));
  if (!mediaName || (message.mediaType !== "sticker" && !legacyWebp))
    throw new AppError("ERR_MESSAGE_IS_NOT_STICKER", 400);

  const root = await fs.realpath(uploadConfig.directory);
  let source: string;
  try {
    source = await fs.realpath(path.join(root, mediaName));
  } catch {
    throw new AppError("ERR_NO_MEDIA_FOUND", 404);
  }
  const relative = path.relative(root, source);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new AppError("ERR_NO_MEDIA_FOUND", 404);

  const contents = await fs.readFile(source);
  if (!contents.length || contents.length > maximumStickerBytes)
    throw new AppError("ERR_INVALID_STICKER", 400);
  const sha256 = createHash("sha256").update(contents).digest("hex");
  const name = requestedName?.trim().slice(0, 80) || null;
  const existing = await SavedSticker.findOne({ where: { sha256 } });
  if (existing) {
    if (name && existing.name !== name) await existing.update({ name });
    return serialize(existing);
  }

  await fs.mkdir(stickersDirectory, { recursive: true });
  const filename = safeMediaFilename("sticker.webp");
  const destination = path.join(stickersDirectory, filename);
  const storageKey = path.posix.join("stickers", filename);
  await fs.writeFile(destination, contents, { flag: "wx" });
  try {
    const created = await SavedSticker.create({
      name,
      storageKey,
      sha256,
      mimeType: "image/webp",
      sourceMessageId: message.id,
      createdByUserId: userId
    });
    return serialize(created);
  } catch (error) {
    await fs.unlink(destination).catch(() => undefined);
    const duplicate = await SavedSticker.findOne({ where: { sha256 } });
    if (duplicate) return serialize(duplicate);
    throw error;
  }
};

export const resolveSavedStickerMedia = async (
  stickerId: number
): Promise<{ sticker: SavedSticker; file: string }> => {
  const sticker = await SavedSticker.findByPk(stickerId);
  if (!sticker) throw new AppError("ERR_NO_STICKER_FOUND", 404);
  try {
    return { sticker, file: await stickerFile(sticker) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("ERR_NO_STICKER_FOUND", 404);
  }
};

export const deleteSavedSticker = async (
  stickerId: number,
  userId: number,
  profile: string
): Promise<void> => {
  const sticker = await SavedSticker.findByPk(stickerId);
  if (!sticker) throw new AppError("ERR_NO_STICKER_FOUND", 404);
  if (profile !== "admin" && sticker.createdByUserId !== userId)
    throw new AppError("ERR_NO_PERMISSION", 403);
  const file = await stickerFile(sticker).catch(() => null);
  await sticker.destroy();
  if (file) await fs.unlink(file).catch(() => undefined);
};

export const sendSavedSticker = async (input: {
  stickerId: number;
  ticketId: string;
  userId: number;
  idempotencyKey: string;
}): Promise<void> => {
  const ticket = await AssertTicketAccess(input.ticketId, input.userId, true);
  const { sticker, file } = await resolveSavedStickerMedia(input.stickerId);
  await SendWhatsAppMedia({
    media: {
      fieldname: "medias",
      originalname: sticker.name || "figurinha.webp",
      encoding: "7bit",
      mimetype: sticker.mimeType,
      destination: stickersDirectory,
      filename: path.basename(file),
      path: file,
      size: (await fs.stat(file)).size,
      buffer: Buffer.alloc(0),
      stream: Readable.from(Buffer.alloc(0))
    },
    ticket,
    body: "Figurinha",
    sentByUserId: input.userId,
    origin: "HUMAN",
    sendAsSticker: true,
    removeFileAfterSend: false,
    policy: {
      idempotencyKey: `human:${input.userId}:${input.idempotencyKey}:sticker:${sticker.id}`
    }
  });
};
