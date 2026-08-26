import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  acknowledgeOperationalAlert,
  getOperationalHealthOverview,
  operationalReadiness
} from "../services/OperationalHealthServices/OperationalHealthService";

const ensureAdmin = (req: Request): void => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

export const liveness = async (
  _req: Request,
  res: Response
): Promise<Response> =>
  res.json({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });

export const readiness = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  const result = await operationalReadiness();
  return res.status(result.ready ? 200 : 503).json(result);
};

export const overview = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await getOperationalHealthOverview());
};

export const acknowledge = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  const alert = await acknowledgeOperationalAlert(
    Number(req.params.id),
    Number(req.user.id)
  );
  if (!alert) throw new AppError("ERR_OPERATIONAL_ALERT_NOT_FOUND", 404);
  return res.json(alert);
};
