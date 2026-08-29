import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  getQuarkDashboardBreakdown,
  getQuarkDashboardCalendarDays,
  getQuarkDashboardSummary,
  getQuarkDashboardTimeseries,
  listQuarkDashboardAppointments
} from "../services/QuarkClinicServices/QuarkDashboardService";
import EnqueueManualQuarkReminderService from "../services/QuarkClinicServices/EnqueueManualQuarkReminderService";
import ConfirmQuarkAppointmentFromDashboardService from "../services/QuarkClinicServices/ConfirmQuarkAppointmentFromDashboardService";
import EnsureQuarkAutomationAccessService from "../services/QuarkClinicServices/EnsureQuarkAutomationAccessService";
import ShowQuarkClinicAppointmentService from "../services/QuarkClinicServices/ShowQuarkClinicAppointmentService";

const ensureAdmin = (req: Request): void => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
};

const ensureViewAccess = async (req: Request): Promise<void> =>
  EnsureQuarkAutomationAccessService({
    userId: req.user.id,
    profile: req.user.profile
  });

const filtersFrom = (req: Request) => ({
  from: typeof req.query.from === "string" ? req.query.from : undefined,
  to: typeof req.query.to === "string" ? req.query.to : undefined,
  status: typeof req.query.status === "string" ? req.query.status : undefined,
  eventType:
    typeof req.query.eventType === "string" ? req.query.eventType : undefined,
  messageStatus:
    typeof req.query.messageStatus === "string"
      ? req.query.messageStatus
      : undefined,
  responseStatus:
    typeof req.query.responseStatus === "string"
      ? req.query.responseStatus
      : undefined,
  page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
  pageSize:
    typeof req.query.pageSize === "string"
      ? Number(req.query.pageSize)
      : undefined
});

export const summary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await ensureViewAccess(req);
  return res.json(await getQuarkDashboardSummary(filtersFrom(req)));
};

export const timeseries = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await ensureViewAccess(req);
  return res.json(await getQuarkDashboardTimeseries(filtersFrom(req)));
};

export const breakdown = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await ensureViewAccess(req);
  return res.json(await getQuarkDashboardBreakdown(filtersFrom(req)));
};

export const appointments = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await ensureViewAccess(req);
  return res.json(await listQuarkDashboardAppointments(filtersFrom(req)));
};

export const showClinicAppointment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await ensureViewAccess(req);
  return res.json(
    await ShowQuarkClinicAppointmentService(req.params.appointmentId)
  );
};

export const calendarDays = async (
  req: Request,
  res: Response
): Promise<Response> => {
  await ensureViewAccess(req);
  return res.json(await getQuarkDashboardCalendarDays(filtersFrom(req)));
};

export const enqueueReminder = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  const result = await EnqueueManualQuarkReminderService({
    appointmentId: req.params.appointmentId,
    fingerprint: req.body.fingerprint,
    phone: req.body.phone
  });
  return res.status(201).json(result);
};

export const confirmAppointment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  const result = await ConfirmQuarkAppointmentFromDashboardService({
    appointmentId: req.params.appointmentId,
    actorUserId: Number(req.user.id)
  });
  return res.json(result);
};
