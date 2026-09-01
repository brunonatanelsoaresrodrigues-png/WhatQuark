import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowContactService from "../ContactServices/ShowContactService";
import RecordTicketEventService from "./RecordTicketEventService";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  queueId?: number;
  actorUserId?: number | null;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId,
  actorUserId = null
}: Request): Promise<Ticket> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  await CheckContactOpenTickets(contactId, defaultWhatsapp.id);

  const { isGroup } = await ShowContactService(contactId);

  if (queueId === undefined) {
    const user = await User.findByPk(userId, { include: ["queues"] });
    queueId = user?.queues.length === 1 ? user.queues[0].id : undefined;
  }

  const { id }: Ticket = await defaultWhatsapp.$create("ticket", {
    contactId,
    status,
    isGroup,
    userId,
    queueId
  });

  const ticket = await Ticket.findByPk(id, { include: ["contact"] });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  await RecordTicketEventService({
    ticketId: ticket.id,
    eventType: "CREATED",
    performedByUserId: actorUserId || userId || null,
    newUserId: userId || null,
    newQueueId: queueId || null,
    metadata: { source: "DASHBOARD", status }
  });

  return ticket;
};

export default CreateTicketService;
