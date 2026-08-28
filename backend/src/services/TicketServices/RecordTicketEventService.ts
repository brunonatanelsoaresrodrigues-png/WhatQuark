import { Transaction } from "sequelize";
import TicketEvent, { TicketEventType } from "../../models/TicketEvent";

interface Request {
  ticketId: number;
  eventType: TicketEventType;
  performedByUserId?: number | null;
  previousUserId?: number | null;
  newUserId?: number | null;
  previousQueueId?: number | null;
  newQueueId?: number | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
  transaction?: Transaction;
}

const RecordTicketEventService = async ({
  metadata,
  transaction,
  ...data
}: Request): Promise<TicketEvent> =>
  TicketEvent.create(
    {
      ...data,
      performedByUserId: data.performedByUserId || null,
      previousUserId: data.previousUserId || null,
      newUserId: data.newUserId || null,
      previousQueueId: data.previousQueueId || null,
      newQueueId: data.newQueueId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      occurredAt: data.occurredAt || new Date()
    },
    { transaction }
  );

export default RecordTicketEventService;
