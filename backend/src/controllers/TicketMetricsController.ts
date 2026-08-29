import { Request, Response } from "express";
import { Op } from "sequelize";
import Ticket from "../models/Ticket";
import ShowUserService from "../services/UserServices/ShowUserService";
import { ticketAccessWhere } from "../helpers/TicketAccessPolicy";
import {
  clinicDay,
  dateParts,
  clinicTimezone
} from "../services/QuarkClinicServices/clinicTime";
import AppError from "../errors/AppError";
import OperationalDashboardService from "../services/TicketServices/OperationalDashboardService";

const optionalPositiveInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new AppError("ERR_INVALID_DASHBOARD_FILTER", 400);
  return parsed;
};

export const operations = async (req: Request, res: Response) =>
  res.json(
    await OperationalDashboardService({
      requesterUserId: req.user.id,
      queueId: optionalPositiveInteger(req.query.queueId),
      assigneeId: optionalPositiveInteger(req.query.assigneeId)
    })
  );

export const daily = async (req: Request, res: Response) => {
  const user = await ShowUserService(req.user.id);
  const from = clinicDay();
  const to = clinicDay(from, 1);
  const tickets = await Ticket.findAll({
    attributes: ["createdAt"],
    where: {
      [Op.and]: [
        ticketAccessWhere(user),
        { ticketType: "PATIENT", createdAt: { [Op.gte]: from, [Op.lt]: to } }
      ]
    },
    raw: true
  });
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    time: `${String(hour).padStart(2, "0")}:00`,
    amount: 0
  }));
  for (const ticket of tickets)
    hours[dateParts(new Date(ticket.createdAt)).hour].amount += 1;
  return res.json({
    total: tickets.length,
    hours,
    timezone: clinicTimezone(),
    from,
    to
  });
};
