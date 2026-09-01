import { Request, Response } from "express";
import AppError from "../errors/AppError";
import OperationalIncident from "../models/OperationalIncident";
import GetOperationalHealthService from "../services/OperationalHealthServices/GetOperationalHealthService";

export const show = async (_req: Request, res: Response): Promise<Response> =>
  res.json(await GetOperationalHealthService(true));

export const acknowledge = async (req: Request, res: Response): Promise<Response> => {
  const id = Number(req.params.incidentId);
  const incident = await OperationalIncident.findByPk(id);
  if (!incident || incident.status === "RESOLVED")
    throw new AppError("ERR_OPERATIONAL_INCIDENT_NOT_FOUND", 404);
  await incident.update({
    status: "ACKNOWLEDGED",
    acknowledgedAt: new Date(),
    acknowledgedByUserId: Number(req.user.id)
  });
  return res.json(incident);
};
