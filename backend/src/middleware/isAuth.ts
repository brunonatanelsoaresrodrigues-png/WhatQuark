import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import { AuthenticateUser } from "../services/AuthServices/AuthenticateUser";

const isAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || "");
  if (!match) throw new AppError("ERR_SESSION_EXPIRED", 401);
  const user = await AuthenticateUser(match[1]);
  req.user = { id: String(user.id), profile: user.profile };
  next();
};

export default isAuth;
