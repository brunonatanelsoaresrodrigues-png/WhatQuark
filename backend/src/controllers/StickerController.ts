import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  deleteSavedSticker,
  listSavedStickers,
  resolveSavedStickerMedia,
  saveStickerFromMessage,
  sendSavedSticker
} from "../services/StickerServices/SavedStickerService";

const stickerId = (value: string): number => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError("ERR_NO_STICKER_FOUND", 404);
  return id;
};

export const index = async (_req: Request, res: Response): Promise<Response> =>
  res.json({ stickers: await listSavedStickers() });

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { messageId, name } = req.body as { messageId?: string; name?: string };
  if (!messageId) throw new AppError("ERR_MESSAGE_ID_REQUIRED", 400);
  const sticker = await saveStickerFromMessage(
    String(messageId),
    Number(req.user.id),
    name
  );
  return res.status(201).json(sticker);
};

export const showMedia = async (req: Request, res: Response): Promise<void> => {
  const { sticker, file } = await resolveSavedStickerMedia(
    stickerId(req.params.stickerId)
  );
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  res.type(sticker.mimeType);
  await new Promise<void>((resolve, reject) => {
    res.sendFile(file, { cacheControl: false }, error =>
      error ? reject(error) : resolve()
    );
  });
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const requestKey = req.header("Idempotency-Key");
  if (!requestKey || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))
    throw new AppError("ERR_IDEMPOTENCY_KEY_REQUIRED", 400);
  await sendSavedSticker({
    stickerId: stickerId(req.params.stickerId),
    ticketId: req.params.ticketId,
    userId: Number(req.user.id),
    idempotencyKey: requestKey
  });
  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await deleteSavedSticker(
    stickerId(req.params.stickerId),
    Number(req.user.id),
    req.user.profile
  );
  return res.status(204).send();
};
