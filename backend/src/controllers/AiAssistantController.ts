import { Request, Response } from "express";
import AppError from "../errors/AppError";
import AiSuggestion from "../models/AiSuggestion";
import GenerateTicketSuggestionService from "../services/AiAssistantServices/GenerateTicketSuggestionService";
import crypto from "crypto";

export const status = async (_req: Request, res: Response): Promise<Response> =>
  res.json({
    enabled:
      process.env.AI_ASSISTANT_ENABLED === "true" &&
      Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)
  });

export const generate = async (req: Request, res: Response): Promise<Response> => {
  if (!req.ticket) throw new AppError("ERR_NO_TICKET_FOUND", 404);
  const result = await GenerateTicketSuggestionService({
    ticket: req.ticket,
    userId: Number(req.user.id)
  });
  return res.status(201).json(result);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const action = String(req.body?.action || "").toUpperCase();
  if (!["COPIED", "DISCARDED"].includes(action))
    throw new AppError("ERR_AI_INVALID_ACTION", 400);
  const suggestion = await AiSuggestion.findOne({
    where: { id: Number(req.params.suggestionId), ticketId: Number(req.params.ticketId) }
  });
  if (!suggestion) throw new AppError("ERR_AI_SUGGESTION_NOT_FOUND", 404);
  const editedOutput = String(req.body?.editedOutput || "").trim();
  if (action === "COPIED" && !editedOutput)
    throw new AppError("ERR_AI_EMPTY_REVIEW", 400);
  await suggestion.update(
    action === "COPIED"
      ? {
          status: action,
          copiedAt: new Date(),
          reviewedByUserId: Number(req.user.id),
          reviewedOutputHash: crypto.createHash("sha256").update(editedOutput).digest("hex")
        }
      : { status: action, discardedAt: new Date(), reviewedByUserId: Number(req.user.id) }
  );
  return res.json({ id: suggestion.id, status: suggestion.status });
};
