import path from "path";
import { promises as fs } from "fs";
import AppError from "../errors/AppError";

const maximumBytes = 20 * 1024 * 1024;
const dangerousExtensions = new Set([
  ".apk",
  ".bat",
  ".cmd",
  ".com",
  ".cpl",
  ".dll",
  ".exe",
  ".hta",
  ".jar",
  ".js",
  ".jse",
  ".msi",
  ".ps1",
  ".scr",
  ".vbs",
  ".vbe",
  ".wsf"
]);
const dangerousMime = /(?:x-msdownload|x-dosexec|x-executable|javascript)/i;

const startsWith = (buffer: Buffer, bytes: number[]) =>
  bytes.every((byte, index) => buffer[index] === byte);

const validateSignature = (file: Express.Multer.File, header: Buffer): void => {
  const mime = file.mimetype.toLowerCase();
  if (mime === "image/webp") {
    if (
      header.toString("ascii", 0, 4) !== "RIFF" ||
      header.toString("ascii", 8, 12) !== "WEBP"
    )
      throw new AppError("ERR_INVALID_MEDIA_CONTENT", 400);
  } else if (mime === "image/png" && !startsWith(header, [137, 80, 78, 71])) {
    throw new AppError("ERR_INVALID_MEDIA_CONTENT", 400);
  } else if (
    ["image/jpeg", "image/jpg"].includes(mime) &&
    !startsWith(header, [255, 216, 255])
  ) {
    throw new AppError("ERR_INVALID_MEDIA_CONTENT", 400);
  } else if (
    mime === "application/pdf" &&
    header.toString("ascii", 0, 5) !== "%PDF-"
  ) {
    throw new AppError("ERR_INVALID_MEDIA_CONTENT", 400);
  }
};

export const validateMediaUpload = async (
  file: Express.Multer.File
): Promise<void> => {
  if (!file.path || file.size <= 0 || file.size > maximumBytes)
    throw new AppError("ERR_INVALID_MEDIA", 400);
  const extension = path
    .extname(file.originalname || file.filename)
    .toLowerCase();
  if (
    dangerousExtensions.has(extension) ||
    dangerousMime.test(file.mimetype || "")
  )
    throw new AppError("ERR_MEDIA_TYPE_NOT_ALLOWED", 400);
  const handle = await fs.open(file.path, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    validateSignature(file, header.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
};
