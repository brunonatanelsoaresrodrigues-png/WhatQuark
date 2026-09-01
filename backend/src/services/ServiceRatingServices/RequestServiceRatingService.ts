import { Op } from "sequelize";
import ServiceRating, {
  ServiceRatingTrigger
} from "../../models/ServiceRating";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { withLease } from "../MessagingServices/state";
import { getServiceRatingConfig } from "./config";

interface Request {
  ticket: Ticket | number;
  ratedUserId?: number | null;
  trigger: ServiceRatingTrigger;
}

const errorCode = (error: unknown): string =>
  error instanceof Error ? error.message.slice(0, 64) : "ERR_RATING_SEND";

const RequestServiceRatingService = async ({
  ticket: ticketInput,
  ratedUserId,
  trigger
}: Request): Promise<ServiceRating | null> => {
  const ticketId = typeof ticketInput === "number" ? ticketInput : ticketInput.id;
  return withLease(`service-rating-request:${ticketId}`, async () => {
    const config = await getServiceRatingConfig();
    if (!config.enabled) return null;
    const ticket = await ShowTicketService(ticketId);
    const userId = ratedUserId || ticket.userId || ticket.inactivityPreviousUserId;
    if (
      !userId ||
      ticket.ticketType !== "PATIENT" ||
      ticket.isGroup ||
      !ticket.contactId ||
      !ticket.whatsappId
    )
      return null;

    const existing = await ServiceRating.findOne({ where: { ticketId } });
    if (existing) return existing;
    const recent = await ServiceRating.findOne({
      where: {
        contactId: ticket.contactId,
        whatsappId: ticket.whatsappId,
        status: { [Op.in]: ["PENDING", "SENT", "ANSWERED"] },
        createdAt: {
          [Op.gte]: new Date(Date.now() - config.cooldownHours * 3600000)
        }
      },
      order: [["createdAt", "DESC"]]
    });
    if (recent) return null;

    const user = await User.findByPk(userId, { attributes: ["id", "name"] });
    if (!user) return null;
    const now = new Date();
    const rating = await ServiceRating.create({
      ticketId,
      contactId: ticket.contactId,
      ratedUserId: user.id,
      queueId: ticket.queueId || null,
      whatsappId: ticket.whatsappId,
      ratedUserName: user.name,
      queueName: ticket.queue?.name || null,
      trigger,
      status: "PENDING",
      score: null,
      requestMessageId: null,
      responseMessageId: null,
      requestedAt: now,
      answeredAt: null,
      expiresAt: new Date(now.getTime() + config.expiryHours * 3600000),
      failureCode: null
    });

    try {
      const message = await SendWhatsAppMessage({
        body: config.message,
        ticket,
        origin: "SURVEY",
        policy: {
          idempotencyKey: `service-rating:${ticket.id}`,
          expiresAt: rating.expiresAt.toISOString()
        }
      });
      await rating.update({ status: "SENT", requestMessageId: message.id });
    } catch (error) {
      if (errorCode(error) !== "ERR_MESSAGE_QUEUED") {
        await rating.update({ status: "FAILED", failureCode: errorCode(error) });
        logger.warn({
          info: "Service rating request could not be sent",
          ticketId,
          ratingId: rating.id,
          err: error
        });
      }
    }
    getIO().to("admin").emit("serviceRating", {
      action: "request",
      ratingId: rating.id,
      ticketId
    });
    return rating;
  });
};

export default RequestServiceRatingService;
