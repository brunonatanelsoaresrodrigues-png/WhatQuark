import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  createDailyReportRecipient,
  dailyReportOverview,
  enqueueDailyReportTest,
  exportDailyReportCsv,
  generateDailyReportPreview,
  retryDailyReportDelivery,
  updateDailyReportRecipient,
  verifyDailyReportRecipient
} from "../services/DailyReportServices/DailyReportAdminService";

const ensureAdmin = (req: Request): void => {
  if (req.user.profile !== "admin")
    throw new AppError("ERR_NO_PERMISSION", 403);
};

export const overview = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await dailyReportOverview());
};

export const createRecipient = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res
    .status(201)
    .json(await createDailyReportRecipient(req.body, Number(req.user.id)));
};

export const updateRecipient = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(
    await updateDailyReportRecipient(
      Number(req.params.id),
      req.body,
      Number(req.user.id)
    )
  );
};

export const verifyRecipient = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(
    await verifyDailyReportRecipient(Number(req.params.id), Number(req.user.id))
  );
};

export const preview = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await generateDailyReportPreview());
};

export const sendTest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(
    await enqueueDailyReportTest(Number(req.params.id), Number(req.user.id))
  );
};

export const retryDelivery = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  return res.json(await retryDailyReportDelivery(Number(req.params.id)));
};

export const exportCsv = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);
  const csv = await exportDailyReportCsv(Number(req.params.id));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${csv.filename}"`
  );
  return res.send(csv.content);
};
