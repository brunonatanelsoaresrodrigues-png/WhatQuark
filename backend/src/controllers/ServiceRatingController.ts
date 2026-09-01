import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  GetServiceRatingSummary,
  ListServiceRatings
} from "../services/ServiceRatingServices/ListServiceRatingsService";

const positive = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const summary = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await GetServiceRatingSummary(
      Math.min(positive(req.query.days, 30), 365),
      req.query.userId ? positive(req.query.userId, 0) : undefined
    )
  );

export const index = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await ListServiceRatings({
      days: Math.min(positive(req.query.days, 30), 365),
      pageNumber: positive(req.query.pageNumber, 1),
      userId: req.query.userId ? positive(req.query.userId, 0) : undefined
    })
  );

export const userSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const userId = positive(req.params.userId, 0);
  if (!userId) throw new AppError("ERR_NO_USER_FOUND", 404);
  if (req.user.profile !== "admin" && Number(req.user.id) !== userId)
    throw new AppError("ERR_NO_PERMISSION", 403);
  const data = await GetServiceRatingSummary(
    Math.min(positive(req.query.days, 30), 365),
    userId
  );
  return res.json(data.users[0] || null);
};
