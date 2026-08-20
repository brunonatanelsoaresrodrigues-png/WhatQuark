import Message from "../../models/Message";
import MessageAttribution, {
  MessageOrigin
} from "../../models/MessageAttribution";

export interface AttributionData {
  sentByUserId?: number | null;
  origin: MessageOrigin;
}

export const registerMessageAttribution = async (
  messageId: string,
  attribution: AttributionData
): Promise<void> => {
  await MessageAttribution.upsert({
    messageId,
    sentByUserId: attribution.sentByUserId || null,
    origin: attribution.origin
  });

  await Message.update(
    {
      sentByUserId: attribution.sentByUserId || null,
      origin: attribution.origin
    },
    { where: { id: messageId } }
  );
};

export const resolveMessageAttribution = async (
  messageId: string,
  fromMe: boolean
): Promise<AttributionData> => {
  if (!fromMe) return { sentByUserId: null, origin: "PATIENT" };

  const attribution = await MessageAttribution.findByPk(messageId);
  if (!attribution) return { sentByUserId: null, origin: "UNKNOWN" };

  return {
    sentByUserId: attribution.sentByUserId,
    origin: attribution.origin
  };
};
