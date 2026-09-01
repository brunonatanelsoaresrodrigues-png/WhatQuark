import { Request, Response, NextFunction } from "express";
import AssertTicketAccess from "../services/TicketServices/AssertTicketAccess";

export default async function canAccessTicket(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  req.ticket = await AssertTicketAccess(
    req.params.ticketId,
    req.user.id,
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  );
  next();
}
