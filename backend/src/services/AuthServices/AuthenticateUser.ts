import { verify } from "jsonwebtoken";
import authConfig from "../../config/auth";
import AppError from "../../errors/AppError";
import User from "../../models/User";

export const AuthenticateUser = async (token: string): Promise<User> => {
  let payload: { id: number; tokenVersion: number; exp: number };
  try {
    payload = verify(token, authConfig.secret, {
      algorithms: ["HS256"]
    }) as typeof payload;
    if (
      !Number.isInteger(payload.id) ||
      !Number.isInteger(payload.tokenVersion) ||
      !Number.isFinite(payload.exp)
    )
      throw new Error("Invalid claims");
  } catch {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
  const user = await User.findByPk(payload.id);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
  return user;
};
