import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import AppError from "../../errors/AppError";
import User from "../../models/User";

const directory = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "public",
  "user-avatars"
);

const types: Record<
  string,
  { extension: string; valid: (data: Buffer) => boolean }
> = {
  "image/jpeg": {
    extension: ".jpg",
    valid: data => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  },
  "image/png": {
    extension: ".png",
    valid: data =>
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  "image/webp": {
    extension: ".webp",
    valid: data =>
      data.length >= 12 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP"
  }
};

const findUser = async (userId: string | number): Promise<User> => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError("ERR_NO_USER_FOUND", 404);
  return user;
};

export const canManageUserAvatar = (
  requester: { id: string; profile: string },
  targetId: string | number
): boolean =>
  requester.profile === "admin" || Number(requester.id) === Number(targetId);

export const validateUserAvatar = (
  file?: Express.Multer.File
): { extension: string } => {
  if (!file?.buffer?.length) throw new AppError("ERR_INVALID_USER_AVATAR", 400);
  const type = types[(file.mimetype || "").toLowerCase()];
  if (!type || !type.valid(file.buffer))
    throw new AppError("ERR_INVALID_USER_AVATAR", 400);
  return { extension: type.extension };
};

const authorize = (
  requester: { id: string; profile: string },
  targetId: string | number
): void => {
  if (!canManageUserAvatar(requester, targetId))
    throw new AppError("ERR_NO_PERMISSION", 403);
};

const avatarPath = (fileName: string): string => {
  if (!fileName || path.basename(fileName) !== fileName)
    throw new AppError("ERR_USER_AVATAR_NOT_FOUND", 404);
  return path.join(directory, fileName);
};

const removeFile = async (fileName?: string | null): Promise<void> => {
  if (!fileName) return;
  await fs.unlink(avatarPath(fileName)).catch(() => undefined);
};

export const saveUserAvatar = async ({
  userId,
  requester,
  file
}: {
  userId: string | number;
  requester: { id: string; profile: string };
  file?: Express.Multer.File;
}): Promise<User> => {
  authorize(requester, userId);
  const { extension } = validateUserAvatar(file);
  const avatarFile = file as Express.Multer.File;

  const user = await findUser(userId);
  await fs.mkdir(directory, { recursive: true });
  const fileName = `${uuid()}${extension}`;
  const destination = avatarPath(fileName);
  await fs.writeFile(destination, avatarFile.buffer, { flag: "wx" });
  const previous = user.avatar;
  try {
    await user.update({ avatar: fileName });
  } catch (error) {
    await removeFile(fileName);
    throw error;
  }
  await removeFile(previous);
  return user.reload({ include: ["queues", "whatsapp"] });
};

export const deleteUserAvatar = async ({
  userId,
  requester
}: {
  userId: string | number;
  requester: { id: string; profile: string };
}): Promise<User> => {
  authorize(requester, userId);
  const user = await findUser(userId);
  const previous = user.avatar;
  if (previous) await user.update({ avatar: null });
  await removeFile(previous);
  return user.reload({ include: ["queues", "whatsapp"] });
};

export const resolveUserAvatar = async (
  userId: string | number
): Promise<{ file: string; mimeType: string }> => {
  const user = await findUser(userId);
  if (!user.avatar) throw new AppError("ERR_USER_AVATAR_NOT_FOUND", 404);
  const file = avatarPath(user.avatar);
  try {
    await fs.access(file);
  } catch {
    throw new AppError("ERR_USER_AVATAR_NOT_FOUND", 404);
  }
  const extension = path.extname(user.avatar).toLowerCase();
  const mimeType =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
      ? "image/webp"
      : "image/jpeg";
  return { file, mimeType };
};

export const removeStoredUserAvatar = removeFile;
