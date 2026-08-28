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
