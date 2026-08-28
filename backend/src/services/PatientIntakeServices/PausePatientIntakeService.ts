import Ticket from "../../models/Ticket";
import RecordTicketEventService from "../TicketServices/RecordTicketEventService";

const activeStatuses = new Set([
  "AWAITING_MENU",
  "AWAITING_CPF",
  "AWAITING_NAME",
  "AWAITING_BIRTH_DATE",
  "AWAITING_SPECIALTY",
  "AWAITING_PROFESSIONAL_PREFERENCE",
  "AWAITING_PROFESSIONAL_NAME",
  "AWAITING_PAYMENT",
  "AWAITING_INSURANCE",
  "AWAITING_AVAILABILITY_DATE",
  "AWAITING_AVAILABILITY_TIME",
  "AWAITING_BOOKING_CONFIRMATION",
  "BOOKING_PROCESSING"
]);

const PausePatientIntakeService = async (
  ticket: Ticket,
  userId?: number | null
): Promise<boolean> => {
  await ticket.reload();
  if (!activeStatuses.has(ticket.intakeStatus || "")) return false;

  await ticket.update({
    intakeStatus: "PAUSED_HUMAN",
    intakePausedAt: new Date(),
    intakeContext: null,
    intakeContextExpiresAt: null
  });
  await RecordTicketEventService({
    ticketId: ticket.id,
    eventType: "INTAKE_PAUSED",
    performedByUserId: userId || null,
    newUserId: ticket.userId || userId || null,
    newQueueId: ticket.queueId || null,
    metadata: { reason: "HUMAN_MESSAGE" }
  });
  return true;
};

export default PausePatientIntakeService;
