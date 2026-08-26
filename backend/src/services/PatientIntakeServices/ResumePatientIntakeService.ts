import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";
import RecordTicketEventService from "../TicketServices/RecordTicketEventService";
import PatientIntakeService from "./PatientIntakeService";

interface Request {
  ticketId: string | number;
  userId: number;
}

const ResumePatientIntakeService = async ({
  ticketId,
  userId
}: Request): Promise<Ticket> => {
  const ticket = await ShowTicketService(ticketId);

  if (
    ticket.ticketType !== "PATIENT" ||
    ticket.isGroup ||
    !["open", "pending"].includes(ticket.status)
  ) {
    throw new AppError("ERR_PATIENT_INTAKE_CANNOT_RESUME", 409);
  }
  if (ticket.intakeStatus !== "PAUSED_HUMAN") {
    throw new AppError("ERR_PATIENT_INTAKE_NOT_PAUSED", 409);
  }

  await ticket.update({
    intakeStatus: null,
    intakeReason: null,
    intakeStartedAt: null,
    intakeCompletedAt: null,
    intakePausedAt: null,
    intakeContext: null,
    intakeContextExpiresAt: null
  });
  await RecordTicketEventService({
    ticketId: ticket.id,
    eventType: "INTAKE_RESTARTED",
    performedByUserId: userId,
    newUserId: ticket.userId || userId,
    newQueueId: ticket.queueId || null,
    metadata: { reason: "MANUAL_RESUME" }
  });

  // O reinicio e intencional e envia um novo menu apenas uma vez. Qualquer
  // mensagem humana posterior volta a pausar o bot automaticamente.
  await PatientIntakeService(ticket, "");
  return ShowTicketService(ticket.id);
};

export default ResumePatientIntakeService;
