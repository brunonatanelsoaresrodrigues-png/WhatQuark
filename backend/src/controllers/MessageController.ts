import { Request, Response } from "express";

import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { emitTicketEvent } from "../libs/socket";
import AssertTicketAccess from "../services/TicketServices/AssertTicketAccess";
import AppError from "../errors/AppError";
import Message from "../models/Message";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import PausePatientIntakeService from "../services/PatientIntakeServices/PausePatientIntakeService";
import { logger } from "../utils/logger";

type IndexQuery = {
  pageNumber: string;
  beforeMessageId?: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber, beforeMessageId } = req.query as IndexQuery;

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    beforeMessageId,
    userId: req.user.id,
    ticketId
  });

  await SetTicketMessagesAsRead(ticket);

  return res.json({ count, messages, ticket, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg }: MessageData = req.body;
  const requestKey = req.header("Idempotency-Key");
  if (!requestKey || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))
    throw new AppError("ERR_IDEMPOTENCY_KEY_REQUIRED", 400);
  const medias = req.files as Express.Multer.File[];

  const ticket = await AssertTicketAccess(ticketId, req.user.id, true);

  await SetTicketMessagesAsRead(ticket);

  if (quotedMsg) {
    const quoted = await Message.findByPk(quotedMsg.id);
    if (!quoted || quoted.ticketId !== ticket.id)
      throw new AppError("ERR_INVALID_QUOTED_MESSAGE", 400);
  }

  await PausePatientIntakeService(ticket, Number(req.user.id));

  if (medias?.length) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File, index: number) => {
        await SendWhatsAppMedia({
          media,
          ticket,
          sentByUserId: Number(req.user.id),
          origin: "HUMAN",
          policy: {
            idempotencyKey: `human:${req.user.id}:${requestKey}:${index}`
          }
        });
      })
    );
  } else {
    await SendWhatsAppMessage({
      body,
      ticket,
      quotedMsg,
      sentByUserId: Number(req.user.id),
      origin: "HUMAN",
      policy: { idempotencyKey: `human:${req.user.id}:${requestKey}` }
    });
  }

  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;

  const existing = await Message.findByPk(messageId);
  if (!existing) throw new AppError("ERR_NO_MESSAGE_FOUND", 404);
  const ticket = await AssertTicketAccess(existing.ticketId, req.user.id, true);
  const message = await DeleteWhatsAppMessage(messageId);

  await emitTicketEvent(ticket, "appMessage", {
    action: "update",
    message
  });

  return res.send();
};
