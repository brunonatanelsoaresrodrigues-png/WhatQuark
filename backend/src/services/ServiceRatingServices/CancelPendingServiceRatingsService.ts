import { Op } from "sequelize";
import ServiceRating from "../../models/ServiceRating";

const CancelPendingServiceRatingsService = async (
  contactId: number,
  whatsappId: number
): Promise<void> => {
  await ServiceRating.update(
    { status: "CANCELLED" },
    {
      where: {
        contactId,
        whatsappId,
        status: { [Op.in]: ["PENDING", "SENT"] }
      }
    }
  );
};

export default CancelPendingServiceRatingsService;
