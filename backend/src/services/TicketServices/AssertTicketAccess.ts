import AppError from "../../errors/AppError";
import {
  canAccessTicket,
  canManageTicket
} from "../../helpers/TicketAccessPolicy";
import ShowUserService from "../UserServices/ShowUserService";
import ShowTicketService from "./ShowTicketService";

export default async function AssertTicketAccess(
  ticketId: string | number,
  userId: string | number,
  manage = false
) {
  const [ticket, user] = await Promise.all([
    ShowTicketService(ticketId),
    ShowUserService(userId)
  ]);
  if (!(manage ? canManageTicket(user, ticket) : canAccessTicket(user, ticket)))
    throw new AppError("ERR_NO_PERMISSION", 403);
  return ticket;
}
