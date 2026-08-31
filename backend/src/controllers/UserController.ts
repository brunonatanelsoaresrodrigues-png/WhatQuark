import { Request, Response } from "express";
import { getIO, disconnectUserSockets } from "../libs/socket";

import CheckSettingsHelper from "../helpers/CheckSettings";
import AppError from "../errors/AppError";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import ListTicketAssigneesService from "../services/UserServices/ListTicketAssigneesService";
import { SerializeUser } from "../helpers/SerializeUser";
import {
  deleteUserAvatar,
  resolveUserAvatar,
  saveUserAvatar
} from "../services/UserServices/UserAvatarService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber
  });

  return res.json({ users, count, hasMore });
};

export const assignees = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const users = await ListTicketAssigneesService(req.user.id);

  return res.json(users);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const {
    email,
    password,
    name,
    profile,
    queueIds,
    whatsappId,
    canAccessQuarkClinic,
    canViewOtherAgentsTickets
  } = req.body;

  const user = await CreateUserService({
    email,
    password,
    name,
    profile,
    queueIds,
    whatsappId,
    canAccessQuarkClinic: canAccessQuarkClinic === true,
    canViewOtherAgentsTickets: canViewOtherAgentsTickets === true
  });

  const io = getIO();
  io.to("admin").emit("user", {
    action: "create",
    user
  });

  return res.status(200).json(user);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  if (req.user.profile !== "admin" && Number(userId) !== Number(req.user.id)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await ShowUserService(userId);

  return res.status(200).json(SerializeUser(user));
};

export const signup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if ((await CheckSettingsHelper("userCreation")) !== "enabled") {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  }
  const { name, email, password } = req.body;
  const user = await CreateUserService({
    name,
    email,
    password,
    profile: "user",
    queueIds: [],
    canAccessQuarkClinic: false
  });
  getIO().to("admin").emit("user", { action: "create", user });
  return res.status(201).json(user);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { userId } = req.params;
  const userData = req.body;

  const user = await UpdateUserService({ userData, userId });
  disconnectUserSockets(userId);

  const io = getIO();
  io.to("admin").emit("user", {
    action: "update",
    user
  });

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await DeleteUserService(userId);
  disconnectUserSockets(userId);

  const io = getIO();
  io.to("admin").emit("user", {
    action: "delete",
    userId
  });

  return res.status(200).json({ message: "User deleted" });
};

const emitUserUpdate = (user: ReturnType<typeof SerializeUser>): void => {
  getIO().to("admin").emit("user", { action: "update", user });
};

export const storeAvatar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await saveUserAvatar({
    userId: req.params.userId,
    requester: req.user,
    file: req.file
  });
  const serialized = SerializeUser(user);
  emitUserUpdate(serialized);
  return res.status(200).json(serialized);
};

export const removeAvatar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await deleteUserAvatar({
    userId: req.params.userId,
    requester: req.user
  });
  const serialized = SerializeUser(user);
  emitUserUpdate(serialized);
  return res.status(200).json(serialized);
};

export const showAvatar = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { file, mimeType } = await resolveUserAvatar(req.params.userId);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  res.type(mimeType);
  await new Promise<void>((resolve, reject) => {
    res.sendFile(file, { cacheControl: false }, error =>
      error ? reject(error) : resolve()
    );
  });
};
