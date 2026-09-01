import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export default function loginRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = attempts.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;
  entry.count += 1;
  attempts.set(key, entry);
  res.once("finish", () => {
    if (res.statusCode < 400) attempts.delete(key);
  });

  if (attempts.size > 10000) {
    for (const [candidate, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(candidate);
    }
  }
  if (entry.count > MAX_ATTEMPTS) {
    throw new AppError("ERR_TOO_MANY_LOGIN_ATTEMPTS", 429);
  }
  next();
}
