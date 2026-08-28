import { Request, Response } from "express";
import { emitTicketEvent } from "../libs/socket";
import AppError from "../errors/AppError";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import formatBody from "../helpers/Mustache";
import SetTicketWaitingForPatientService from "../services/TicketInactivityServices/SetTicketWaitingForPatientService";
import EnsureTicketDeletionPermissionService from "../services/TicketServices/EnsureTicketDeletionPermissionService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  showAll: string;
  assignee: string;
  withUnreadMessages: string;
  queueIds: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    searchParam,
    showAll,
    assignee,
    queueIds: queueIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;

  let queueIds: number[] = [];

  if (queueIdsStringified) {
    try {
      const parsed = JSON.parse(queueIdsStringified);
      if (
        !Array.isArray(parsed) ||
        !parsed.every(id => Number.isInteger(id) && id > 0)
      ) {
        throw new Error("Invalid queues");
      }
      queueIds = parsed;
    } catch {
      throw new AppError("ERR_INVALID_QUEUE_FILTER", 400);
    }
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    assignee,
    userId,
    queueIds,
    withUnreadMessages
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId }: TicketData = req.body;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId: req.user.profile === "admin" ? userId : Number(req.user.id),
    actorUserId: Number(req.user.id)
  });

  await emitTicketEvent(ticket, "ticket", {
    action: "update",
    ticket
  });

  return res.status(200).json(ticket);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const contact = await ShowTicketService(ticketId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  if (req.user.profile !== "admin" && req.body.whatsappId !== undefined) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { ticket, oldStatus } = await UpdateTicketService({
    ticketData,
    ticketId,
    actorUserId: Number(req.user.id)
  });

  if (ticket.status === "closed" && oldStatus !== "closed") {
    const whatsapp = await ShowWhatsAppService(ticket.whatsappId);

    const { farewellMessage } = whatsapp;

    if (farewellMessage) {
      await SendWhatsAppMessage({
        body: formatBody(farewellMessage, ticket.contact),
        ticket,
        sentByUserId: Number(req.user.id),
        origin: "SYSTEM",
        policy: {
          idempotencyKey: `farewell:${
            ticket.id
          }:${ticket.updatedAt.toISOString()}`
        }
      });
    }
  }

  return res.status(200).json(ticket);
};

export const setWaitingForPatient = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { waiting } = req.body as { waiting?: boolean };

  if (typeof waiting !== "boolean") {
    return res.status(400).json({ error: "ERR_INVALID_WAITING_STATE" });
  }

  const ticket = await SetTicketWaitingForPatientService({
    ticketId,
    waiting,
    userId: Number(req.user.id)
  });

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  await EnsureTicketDeletionPermissionService(req.user.id);

  const ticket = await DeleteTicketService(ticketId);

  await emitTicketEvent(ticket, "ticket", {
    action: "delete",
    ticketId: +ticketId
  });

  return res.status(200).json({ message: "ticket deleted" });
};
