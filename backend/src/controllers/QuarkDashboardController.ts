import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  getQuarkDashboardBreakdown,
  getQuarkDashboardSummary,
  getQuarkDashboardTimeseries,
  listQuarkDashboardAppointments
} from "../services/QuarkClinicServices/QuarkDashboardService";
import EnqueueManualQuarkReminderService from "../services/QuarkClinicServices/EnqueueManualQuarkReminderService";

const ensureAdmin = (req: Request): void => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

const filtersFrom = (req: Request) => ({
  from: typeof req.query.from === "string" ? req.query.from : undefined,
  to: typeof req.query.to === "string" ? req.query.to : undefined,
  status: typeof req.query.status === "string" ? req.query.status : undefined,
  eventType:
    typeof req.query.eventType === "string" ? req.query.eventType : undefined,
  page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
  pageSize:
    typeof req.query.pageSize === "string"
      ? Number(req.query.pageSize)
      : undefined
});

export const summary = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await getQuarkDashboardSummary(filtersFrom(req)));
};

export const timeseries = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await getQuarkDashboardTimeseries(filtersFrom(req)));
};

export const breakdown = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await getQuarkDashboardBreakdown(filtersFrom(req)));
};

export const appointments = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await listQuarkDashboardAppointments(filtersFrom(req)));
};

export const enqueueReminder = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  const result = await EnqueueManualQuarkReminderService({
    appointmentId: req.params.appointmentId
  });
  return res.status(201).json(result);
};
