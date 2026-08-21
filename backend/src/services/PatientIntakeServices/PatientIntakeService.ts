import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import RecordTicketEventService from "../TicketServices/RecordTicketEventService";
import FindRegisteredPatientNameService from "./FindRegisteredPatientNameService";
import {
  BIRTH_DATE_PROMPT,
  CPF_PROMPT,
  DIRECT_HANDOFF_MESSAGE,
  HANDOFF_MESSAGE,
  INSURANCE_PROMPT,
  NAME_PROMPT,
  PAYMENT_PROMPT,
  PROFESSIONAL_NAME_PROMPT,
  PROFESSIONAL_PREFERENCE_PROMPT,
  SPECIALTY_PROMPT,
  initialMenuMessage
} from "./messages";

export type IntakeStatus =
  | "AWAITING_MENU"
  | "AWAITING_CPF"
  | "AWAITING_NAME"
  | "AWAITING_BIRTH_DATE"
  | "AWAITING_SPECIALTY"
  | "AWAITING_PROFESSIONAL_PREFERENCE"
  | "AWAITING_PROFESSIONAL_NAME"
  | "AWAITING_PAYMENT"
  | "AWAITING_INSURANCE"
  | "COMPLETED"
  | "PAUSED_HUMAN";

export type IntakeReason =
  | "SCHEDULE"
  | "AVAILABILITY"
  | "CONFIRM_OR_RESCHEDULE"
  | "CANCEL"
  | "INSURANCE_OR_PRICE"
  | "HUMAN";

export interface PatientIntakeResult {
  handled: boolean;
  showQueueMenu: boolean;
}

const conversationStatuses = new Set<IntakeStatus>([
  "AWAITING_MENU",
  "AWAITING_CPF",
  "AWAITING_NAME",
  "AWAITING_BIRTH_DATE",
  "AWAITING_SPECIALTY",
  "AWAITING_PROFESSIONAL_PREFERENCE",
  "AWAITING_PROFESSIONAL_NAME",
  "AWAITING_PAYMENT",
  "AWAITING_INSURANCE",
  "COMPLETED"
]);

export const patientIntakeOwnsNumericInput = (
  status: string | null | undefined
): boolean => conversationStatuses.has(status as IntakeStatus);

const strictChoice = (body: string, maximum: number): number | undefined => {
  const normalized = body.trim();
  if (!new RegExp(`^[1-${maximum}]$`).test(normalized)) return undefined;
  return Number(normalized);
};

export const isValidCpf = (body: string): boolean => {
  const cpf = body.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10]);
};

export const isValidBirthDate = (body: string, now = new Date()): boolean => {
  const match = body.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const value = new Date(year, month - 1, day);
  const oldestYear = now.getFullYear() - 120;

  return (
    value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === day &&
    value.getTime() <= now.getTime() &&
    year >= oldestYear
  );
};

const isValidName = (body: string): boolean => {
  const value = body.trim();
  return value.length >= 3 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value);
};

const sendBotMessage = async (ticket: Ticket, body: string): Promise<void> => {
  await SendWhatsAppMessage({ body, ticket, origin: "BOT" });
};

const completeIntake = async (ticket: Ticket): Promise<PatientIntakeResult> => {
  const completedAt = new Date();
  await ticket.update({
    intakeStatus: "COMPLETED",
    intakeCompletedAt: completedAt
  });
  await sendBotMessage(ticket, HANDOFF_MESSAGE);
  await RecordTicketEventService({
    ticketId: ticket.id,
    eventType: "INTAKE_COMPLETED",
    newQueueId: ticket.queueId || null,
    metadata: { reason: ticket.intakeReason }
  });
  return { handled: true, showQueueMenu: true };
};

const nextAfterName = async (ticket: Ticket): Promise<PatientIntakeResult> => {
  if (
    ticket.intakeReason === "CONFIRM_OR_RESCHEDULE" ||
    ticket.intakeReason === "CANCEL"
  ) {
    return completeIntake(ticket);
  }

  if (ticket.intakeReason === "INSURANCE_OR_PRICE") {
    await ticket.update({ intakeStatus: "AWAITING_PAYMENT" });
    await sendBotMessage(ticket, PAYMENT_PROMPT);
    return { handled: true, showQueueMenu: false };
  }

  await ticket.update({ intakeStatus: "AWAITING_BIRTH_DATE" });
  await sendBotMessage(ticket, BIRTH_DATE_PROMPT);
  return { handled: true, showQueueMenu: false };
};

const startReason = async (
  ticket: Ticket,
  choice: number
): Promise<PatientIntakeResult> => {
  const reasons: Record<number, IntakeReason> = {
    1: "SCHEDULE",
    2: "AVAILABILITY",
    3: "CONFIRM_OR_RESCHEDULE",
    4: "CANCEL",
    5: "INSURANCE_OR_PRICE",
    6: "HUMAN"
  };
  const reason = reasons[choice];

  if (reason === "HUMAN") {
    await ticket.update({
      intakeReason: reason,
      intakeStatus: "COMPLETED",
      intakeCompletedAt: new Date()
    });
    await sendBotMessage(ticket, DIRECT_HANDOFF_MESSAGE);
    await RecordTicketEventService({
      ticketId: ticket.id,
      eventType: "INTAKE_COMPLETED",
      metadata: { reason }
    });
    return { handled: true, showQueueMenu: true };
  }

  await ticket.update({ intakeReason: reason, intakeStatus: "AWAITING_CPF" });
  await sendBotMessage(ticket, CPF_PROMPT);
  return { handled: true, showQueueMenu: false };
};

const PatientIntakeService = async (
  ticket: Ticket,
  body: string
): Promise<PatientIntakeResult> => {
  await ticket.reload();
  const status = ticket.intakeStatus as IntakeStatus | null;

  if (status === "PAUSED_HUMAN") {
    return { handled: true, showQueueMenu: false };
  }
  if (status === "COMPLETED") {
    return { handled: false, showQueueMenu: false };
  }

  if (!status) {
    const startedAt = new Date();
    const registeredFirstName = await FindRegisteredPatientNameService(
      ticket.contact?.number || ""
    );
    await ticket.update({
      intakeStatus: "AWAITING_MENU",
      intakeReason: null,
      intakeStartedAt: startedAt,
      intakeCompletedAt: null,
      intakePausedAt: null
    });
    await sendBotMessage(
      ticket,
      initialMenuMessage(startedAt, "America/Sao_Paulo", registeredFirstName)
    );
    await RecordTicketEventService({
      ticketId: ticket.id,
      eventType: "INTAKE_STARTED",
      metadata: { source: "PATIENT_MESSAGE" }
    });
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_MENU") {
    const choice = strictChoice(body, 6);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Não conseguimos identificar a opção.\n\n${initialMenuMessage()}`
      );
      return { handled: true, showQueueMenu: false };
    }
    return startReason(ticket, choice);
  }

  if (status === "AWAITING_CPF") {
    if (!isValidCpf(body)) {
      await sendBotMessage(
        ticket,
        `O CPF informado parece inválido.\n\n${CPF_PROMPT}`
      );
      return { handled: true, showQueueMenu: false };
    }
    await ticket.update({ intakeStatus: "AWAITING_NAME" });
    await sendBotMessage(ticket, NAME_PROMPT);
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_NAME") {
    if (!isValidName(body)) {
      await sendBotMessage(
        ticket,
        `Por favor, informe o nome completo do paciente.\n\n${NAME_PROMPT}`
      );
      return { handled: true, showQueueMenu: false };
    }
    return nextAfterName(ticket);
  }

  if (status === "AWAITING_BIRTH_DATE") {
    if (!isValidBirthDate(body)) {
      await sendBotMessage(
        ticket,
        `A data informada parece inválida. Use o formato DD/MM/AAAA.\n\n${BIRTH_DATE_PROMPT}`
      );
      return { handled: true, showQueueMenu: false };
    }
    await ticket.update({ intakeStatus: "AWAITING_SPECIALTY" });
    await sendBotMessage(ticket, SPECIALTY_PROMPT);
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_SPECIALTY") {
    if (!strictChoice(body, 3)) {
      await sendBotMessage(
        ticket,
        `Escolha uma opção válida.\n\n${SPECIALTY_PROMPT}`
      );
      return { handled: true, showQueueMenu: false };
    }
    await ticket.update({
      intakeStatus: "AWAITING_PROFESSIONAL_PREFERENCE"
    });
    await sendBotMessage(ticket, PROFESSIONAL_PREFERENCE_PROMPT);
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_PROFESSIONAL_PREFERENCE") {
    const choice = strictChoice(body, 2);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Escolha uma opção válida.\n\n${PROFESSIONAL_PREFERENCE_PROMPT}`
      );
      return { handled: true, showQueueMenu: false };
    }
    if (choice === 1) {
      await ticket.update({ intakeStatus: "AWAITING_PROFESSIONAL_NAME" });
      await sendBotMessage(ticket, PROFESSIONAL_NAME_PROMPT);
    } else {
      await ticket.update({ intakeStatus: "AWAITING_PAYMENT" });
      await sendBotMessage(ticket, PAYMENT_PROMPT);
    }
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_PROFESSIONAL_NAME") {
    if (!isValidName(body)) {
      await sendBotMessage(ticket, PROFESSIONAL_NAME_PROMPT);
      return { handled: true, showQueueMenu: false };
    }
    await ticket.update({ intakeStatus: "AWAITING_PAYMENT" });
    await sendBotMessage(ticket, PAYMENT_PROMPT);
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_PAYMENT") {
    const choice = strictChoice(body, 2);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Escolha uma opção válida.\n\n${PAYMENT_PROMPT}`
      );
      return { handled: true, showQueueMenu: false };
    }
    if (choice === 2) {
      await ticket.update({ intakeStatus: "AWAITING_INSURANCE" });
      await sendBotMessage(ticket, INSURANCE_PROMPT);
      return { handled: true, showQueueMenu: false };
    }
    return completeIntake(ticket);
  }

  if (status === "AWAITING_INSURANCE") {
    if (body.trim().length < 2) {
      await sendBotMessage(ticket, INSURANCE_PROMPT);
      return { handled: true, showQueueMenu: false };
    }
    return completeIntake(ticket);
  }

  return { handled: false, showQueueMenu: false };
};

export default PatientIntakeService;
