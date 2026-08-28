import { Request, Response } from "express";
import path from "path";
import { promises as fs } from "fs";
import Message from "../models/Message";
import AppError from "../errors/AppError";
import uploadConfig from "../config/upload";
import AssertTicketAccess from "../services/TicketServices/AssertTicketAccess";

export const show = async (req: Request, res: Response): Promise<void> => {
  const { filename } = req.params;
  if (!filename || filename.startsWith(".") || /[/\\\x00]/.test(filename)) {
    throw new AppError("ERR_NO_MEDIA_FOUND", 404);
  }
  const message = await Message.findOne({
    where: { mediaUrl: filename, isDeleted: false }
  });
  if (!message) throw new AppError("ERR_NO_MEDIA_FOUND", 404);
  await AssertTicketAccess(message.ticketId, req.user.id);

  let file: string;
  try {
    const root = await fs.realpath(uploadConfig.directory);
    file = await fs.realpath(path.join(root, filename));
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Invalid path");
  } catch {
    throw new AppError("ERR_NO_MEDIA_FOUND", 404);
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  res.attachment(filename);
  await new Promise<void>((resolve, reject) => {
    res.sendFile(file, { cacheControl: false }, error =>
      error ? reject(error) : resolve()
    );
  });
};
