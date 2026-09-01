import { Op } from "sequelize";
import sequelize from "../../database";
import ServiceRating from "../../models/ServiceRating";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import { withLease } from "../MessagingServices/state";
import { getServiceRatingConfig } from "./config";

export const ratingScoreFrom = (body: string): number | null => {
  const match = String(body || "").match(/^\s*([0-5])\s*$/);
  return match ? Number(match[1]) : null;
};

export const FindPendingServiceRating = async ({
  contactId,
  whatsappId,
  body
}: {
  contactId: number;
  whatsappId: number;
  body: string;
}): Promise<ServiceRating | null> => {
  if (ratingScoreFrom(body) === null) return null;
  await ServiceRating.update(
    { status: "EXPIRED" },
    {
      where: {
        contactId,
        whatsappId,
        status: { [Op.in]: ["PENDING", "SENT"] },
        expiresAt: { [Op.lte]: new Date() }
      }
    }
  );
  return ServiceRating.findOne({
    where: {
      contactId,
      whatsappId,
      status: { [Op.in]: ["PENDING", "SENT"] },
      expiresAt: { [Op.gt]: new Date() }
    },
    order: [["requestedAt", "DESC"]]
  });
};

export const HandleServiceRatingResponse = async ({
  ratingId,
  body,
  messageId
}: {
  ratingId: number;
  body: string;
  messageId: string;
}): Promise<boolean> => {
  const score = ratingScoreFrom(body);
  if (score === null) return false;
  return withLease(`service-rating-response:${ratingId}`, async () => {
    const answered = await sequelize.transaction(async transaction => {
      const rating = await ServiceRating.findByPk(ratingId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (
        !rating ||
        !["PENDING", "SENT"].includes(rating.status) ||
        rating.expiresAt.getTime() <= Date.now()
      ) {
        if (rating && rating.expiresAt.getTime() <= Date.now())
          await rating.update({ status: "EXPIRED" }, { transaction });
        return null;
      }
      await rating.update(
        {
          status: "ANSWERED",
          score,
          responseMessageId: messageId,
          answeredAt: new Date(),
          failureCode: null
        },
        { transaction }
      );
      return rating;
    });
    if (!answered) return false;

    try {
      const config = await getServiceRatingConfig();
      const ticket = await ShowTicketService(answered.ticketId);
      await SendWhatsAppMessage({
        body: config.thankYouMessage,
        ticket,
        origin: "SURVEY",
        policy: {
          idempotencyKey: `service-rating-thanks:${answered.id}`,
          expiresAt: new Date(Date.now() + 10 * 60000).toISOString()
        }
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ERR_MESSAGE_QUEUED")
        logger.warn({
          info: "Service rating thank-you could not be sent",
          ratingId,
          err: error
        });
    }
    getIO().to("admin").emit("serviceRating", {
      action: "answered",
      ratingId,
      score
    });
    return true;
  });
};
