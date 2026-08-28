import Ticket from "../../models/Ticket";
import { AsyncLocalStorage } from "async_hooks";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import RecordTicketEventService from "../TicketServices/RecordTicketEventService";
import FindRegisteredPatientNameService from "./FindRegisteredPatientNameService";
import BookPatientIntakeAppointmentService, {
  IntakeBookingResult
} from "./BookPatientIntakeAppointmentService";
import {
  clearIntakeContextFields,
  IntakeDateOption,
  IntakeProfessionalOption,
  IntakeSpecialty,
  loadIntakeContext,
  PatientIntakeContext,
  saveIntakeContext
} from "./PatientIntakeContextService";
import {
  findFirstIntakeAvailability,
  isPatientIntakeAvailabilityEnabled,
  isPatientIntakeBookingEnabled,
  listIntakeAvailabilityDates,
  listIntakeProfessionals
} from "./QuarkAvailabilityService";
import {
  availabilityDatesMessage,
  availabilityTimesMessage,
  BIRTH_DATE_PROMPT,
  bookingSuccessMessage,
  bookingSummaryMessage,
  BOOKING_FAILURE_MESSAGE,
  BOOKING_PROCESSING_MESSAGE,
  CPF_PROMPT,
  DIRECT_HANDOFF_MESSAGE,
  HANDOFF_MESSAGE,
  INSURANCE_PROMPT,
  NAME_PROMPT,
  NO_AVAILABILITY_MESSAGE,
  PAYMENT_PROMPT,
  PROFESSIONAL_NAME_PROMPT,
  PROFESSIONAL_PREFERENCE_PROMPT,
  professionalOptionsMessage,
  QUARK_AVAILABILITY_FAILURE_MESSAGE,
  SLOT_NO_LONGER_AVAILABLE_MESSAGE,
  SPECIALTY_PROMPT,
  initialMenuMessage,
  withIntakeNavigation
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
  | "AWAITING_AVAILABILITY_DATE"
  | "AWAITING_AVAILABILITY_TIME"
  | "AWAITING_BOOKING_CONFIRMATION"
  | "BOOKING_PROCESSING"
  | "BOOKED"
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
  "AWAITING_AVAILABILITY_DATE",
  "AWAITING_AVAILABILITY_TIME",
  "AWAITING_BOOKING_CONFIRMATION",
  "BOOKING_PROCESSING",
  "BOOKED",
  "COMPLETED"
]);

export const patientIntakeOwnsNumericInput = (
  status: string | null | undefined
): boolean => conversationStatuses.has(status as IntakeStatus);

const numberedChoice = (body: string, maximum: number): number | undefined => {
  const normalized = body.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return value >= 1 && value <= maximum ? value : undefined;
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

const replyContext = new AsyncLocalStorage<{
  eventId: string;
  sequence: number;
}>();
const sendBotMessage = async (ticket: Ticket, body: string): Promise<void> => {
  const context = replyContext.getStore();
  await SendWhatsAppMessage({
    body,
    ticket,
    origin: "BOT",
    policy: {
      bot: true,
      expectedQueueId: ticket.queueId || null,
      botEventId: context?.eventId,
      idempotencyKey: context
        ? `${context.eventId}:intake:${context.sequence++}`
        : undefined,
      expiresAt: new Date(Date.now() + 5 * 60000).toISOString()
    }
  }).catch(error => {
    if (error instanceof Error && error.message === "ERR_MESSAGE_QUEUED")
      return;
    throw error;
  });
};

const specialtyLabel = (specialty?: IntakeSpecialty): string => {
  if (specialty === "PSYCHIATRY") return "Psiquiatria";
  if (specialty === "PSYCHOLOGY") return "Psicologia";
  if (specialty === "REPORT") return "Laudo — particular";
  return "Especialidade";
};

const paymentLabel = (context: PatientIntakeContext): string =>
  context.payment === "INSURANCE"
    ? `Convênio${context.insurance ? ` — ${context.insurance}` : ""}`
    : "Particular";

const completeIntake = async (
  ticket: Ticket,
  message = HANDOFF_MESSAGE,
  metadata: Record<string, unknown> = {}
): Promise<PatientIntakeResult> => {
  const completedAt = new Date();
  await ticket.update({
    intakeStatus: "COMPLETED",
    intakeCompletedAt: completedAt,
    ...clearIntakeContextFields
  });
  if (message) await sendBotMessage(ticket, message);
  await RecordTicketEventService({
    ticketId: ticket.id,
    eventType: "INTAKE_COMPLETED",
    newQueueId: ticket.queueId || null,
    metadata: { reason: ticket.intakeReason, ...metadata }
  });
  return { handled: true, showQueueMenu: true };
};

const nextAfterName = async (
  ticket: Ticket,
  context: PatientIntakeContext
): Promise<PatientIntakeResult> => {
  if (
    ticket.intakeReason === "CONFIRM_OR_RESCHEDULE" ||
    ticket.intakeReason === "CANCEL"
  ) {
    return completeIntake(ticket);
  }
  if (ticket.intakeReason === "INSURANCE_OR_PRICE") {
    await saveIntakeContext(ticket, context, {
      intakeStatus: "AWAITING_PAYMENT"
    });
    await sendBotMessage(ticket, withIntakeNavigation(PAYMENT_PROMPT));
    return { handled: true, showQueueMenu: false };
  }
  await saveIntakeContext(ticket, context, {
    intakeStatus: "AWAITING_BIRTH_DATE"
  });
  await sendBotMessage(ticket, withIntakeNavigation(BIRTH_DATE_PROMPT));
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
      intakeCompletedAt: new Date(),
      ...clearIntakeContextFields
    });
    await sendBotMessage(ticket, DIRECT_HANDOFF_MESSAGE);
    await RecordTicketEventService({
      ticketId: ticket.id,
      eventType: "INTAKE_COMPLETED",
      metadata: { reason }
    });
    return { handled: true, showQueueMenu: true };
  }
  await saveIntakeContext(
    ticket,
    {},
    {
      intakeReason: reason,
      intakeStatus: "AWAITING_CPF"
    }
  );
  await sendBotMessage(ticket, withIntakeNavigation(CPF_PROMPT));
  return { handled: true, showQueueMenu: false };
};

const professionalPrompt = (context: PatientIntakeContext): string =>
  context.professionalOptions?.length
    ? professionalOptionsMessage(
        context.professionalOptions.map(professional => professional.name)
      )
    : withIntakeNavigation(PROFESSIONAL_NAME_PROMPT);

const timePage = (
  context: PatientIntakeContext
): {
  times: string[];
  hasMore: boolean;
} => {
  const page = Math.max(0, context.timePage || 0);
  const options = context.timeOptions || [];
  const values = options.slice(page * 8, page * 8 + 8);
  return {
    times: values.map(option => option.time),
    hasMore: (page + 1) * 8 < options.length
  };
};

const summaryPrompt = (context: PatientIntakeContext): string =>
  bookingSummaryMessage({
    patientName: context.patientName || "Paciente",
    specialty: specialtyLabel(context.specialty),
    professional: context.selectedProfessional?.name || "Profissional",
    date: context.selectedSlot?.date || "Data",
    time: context.selectedSlot?.time || "Horário",
    payment: paymentLabel(context),
    automaticBooking: isPatientIntakeBookingEnabled()
  });

const sendPromptForStatus = async (
  ticket: Ticket,
  status: IntakeStatus,
  context: PatientIntakeContext
): Promise<void> => {
  if (status === "AWAITING_MENU") {
    await sendBotMessage(ticket, initialMenuMessage());
    return;
  }
  if (status === "AWAITING_CPF") {
    await sendBotMessage(ticket, withIntakeNavigation(CPF_PROMPT));
    return;
  }
  if (status === "AWAITING_NAME") {
    await sendBotMessage(ticket, withIntakeNavigation(NAME_PROMPT));
    return;
  }
  if (status === "AWAITING_BIRTH_DATE") {
    await sendBotMessage(ticket, withIntakeNavigation(BIRTH_DATE_PROMPT));
    return;
  }
  if (status === "AWAITING_SPECIALTY") {
    await sendBotMessage(ticket, withIntakeNavigation(SPECIALTY_PROMPT));
    return;
  }
  if (status === "AWAITING_PAYMENT") {
    await sendBotMessage(ticket, withIntakeNavigation(PAYMENT_PROMPT));
    return;
  }
  if (status === "AWAITING_INSURANCE") {
    await sendBotMessage(ticket, withIntakeNavigation(INSURANCE_PROMPT));
    return;
  }
  if (status === "AWAITING_PROFESSIONAL_PREFERENCE") {
    await sendBotMessage(
      ticket,
      withIntakeNavigation(PROFESSIONAL_PREFERENCE_PROMPT)
    );
    return;
  }
  if (status === "AWAITING_PROFESSIONAL_NAME") {
    await sendBotMessage(ticket, professionalPrompt(context));
    return;
  }
  if (status === "AWAITING_AVAILABILITY_DATE") {
    await sendBotMessage(
      ticket,
      availabilityDatesMessage(
        context.selectedProfessional?.name || "profissional",
        (context.dateOptions || []).map(date => ({
          label: date.label,
          slots: date.slots.length
        }))
      )
    );
    return;
  }
  if (status === "AWAITING_AVAILABILITY_TIME") {
    const page = timePage(context);
    await sendBotMessage(
      ticket,
      availabilityTimesMessage(
        context.selectedDate?.label || context.selectedDate?.date || "data",
        page.times,
        page.hasMore
      )
    );
    return;
  }
  if (status === "AWAITING_BOOKING_CONFIRMATION") {
    await sendBotMessage(ticket, summaryPrompt(context));
  }
};

const trimmedContextFor = (
  status: IntakeStatus,
  context: PatientIntakeContext
): PatientIntakeContext => {
  const next = { ...context };
  const removeAvailability = () => {
    delete next.selectedProfessional;
    delete next.dateOptions;
    delete next.selectedDate;
    delete next.timeOptions;
    delete next.selectedSlot;
    delete next.timePage;
  };
  if (status === "AWAITING_CPF") return {};
  if (status === "AWAITING_NAME") {
    return { cpf: next.cpf };
  }
  if (status === "AWAITING_BIRTH_DATE") {
    return { cpf: next.cpf, patientName: next.patientName };
  }
  if (status === "AWAITING_SPECIALTY") {
    return {
      cpf: next.cpf,
      patientName: next.patientName,
      birthDate: next.birthDate
    };
  }
  if (status === "AWAITING_PAYMENT") {
    removeAvailability();
    delete next.payment;
    delete next.insurance;
    delete next.professionalOptions;
    return next;
  }
  if (status === "AWAITING_INSURANCE") {
    removeAvailability();
    delete next.insurance;
    delete next.professionalOptions;
    return next;
  }
  if (status === "AWAITING_PROFESSIONAL_NAME") {
    removeAvailability();
    return next;
  }
  if (status === "AWAITING_AVAILABILITY_DATE") {
    delete next.selectedDate;
    delete next.timeOptions;
    delete next.selectedSlot;
    delete next.timePage;
    return next;
  }
  if (status === "AWAITING_AVAILABILITY_TIME") {
    delete next.selectedSlot;
    next.timePage = 0;
    return next;
  }
  return next;
};

const ticketReasonNeedsSpecialty = (context: PatientIntakeContext): boolean =>
  Boolean(context.specialty);

const previousStatus = (
  status: IntakeStatus,
  context: PatientIntakeContext
): IntakeStatus => {
  if (status === "AWAITING_CPF") return "AWAITING_MENU";
  if (status === "AWAITING_NAME") return "AWAITING_CPF";
  if (status === "AWAITING_BIRTH_DATE") return "AWAITING_NAME";
  if (status === "AWAITING_SPECIALTY") return "AWAITING_BIRTH_DATE";
  if (status === "AWAITING_PAYMENT") {
    return ticketReasonNeedsSpecialty(context)
      ? "AWAITING_SPECIALTY"
      : "AWAITING_NAME";
  }
  if (status === "AWAITING_INSURANCE") return "AWAITING_PAYMENT";
  if (status === "AWAITING_PROFESSIONAL_PREFERENCE") {
    return "AWAITING_SPECIALTY";
  }
  if (status === "AWAITING_PROFESSIONAL_NAME") {
    return context.payment === "INSURANCE"
      ? "AWAITING_INSURANCE"
      : "AWAITING_PAYMENT";
  }
  if (status === "AWAITING_AVAILABILITY_DATE") {
    return "AWAITING_PROFESSIONAL_NAME";
  }
  if (
    status === "AWAITING_AVAILABILITY_TIME" ||
    status === "AWAITING_BOOKING_CONFIRMATION"
  ) {
    return status === "AWAITING_BOOKING_CONFIRMATION"
      ? "AWAITING_AVAILABILITY_TIME"
      : "AWAITING_AVAILABILITY_DATE";
  }
  return "AWAITING_MENU";
};

const handleBack = async (
  ticket: Ticket,
  status: IntakeStatus,
  context: PatientIntakeContext
): Promise<PatientIntakeResult> => {
  const target = previousStatus(status, context);
  if (target === "AWAITING_MENU") {
    await saveIntakeContext(
      ticket,
      {},
      {
        intakeStatus: target,
        intakeReason: null
      }
    );
    await sendPromptForStatus(ticket, target, {});
    return { handled: true, showQueueMenu: false };
  }
  const nextContext = trimmedContextFor(target, context);
  await saveIntakeContext(ticket, nextContext, { intakeStatus: target });
  await sendPromptForStatus(ticket, target, nextContext);
  return { handled: true, showQueueMenu: false };
};

const handleMenuCommand = async (
  ticket: Ticket
): Promise<PatientIntakeResult> => {
  await saveIntakeContext(
    ticket,
    {},
    {
      intakeStatus: "AWAITING_MENU",
      intakeReason: null
    }
  );
  await sendBotMessage(ticket, initialMenuMessage());
  return { handled: true, showQueueMenu: false };
};

const showProfessionals = async (
  ticket: Ticket,
  context: PatientIntakeContext
): Promise<PatientIntakeResult> => {
  if (!isPatientIntakeAvailabilityEnabled() || !context.specialty) {
    await saveIntakeContext(ticket, context, {
      intakeStatus: "AWAITING_PROFESSIONAL_PREFERENCE"
    });
    await sendBotMessage(
      ticket,
      withIntakeNavigation(PROFESSIONAL_PREFERENCE_PROMPT)
    );
    return { handled: true, showQueueMenu: false };
  }
  try {
    const professionals = await listIntakeProfessionals(context.specialty);
    if (professionals.length === 0) {
      return completeIntake(
        ticket,
        `Ainda não há uma agenda automática configurada no Quark para *${specialtyLabel(
          context.specialty
        )}*.\n\n${HANDOFF_MESSAGE}`,
        { source: "QUARK_NO_CONFIGURED_PROFESSIONAL" }
      );
    }
    const nextContext = {
      ...context,
      professionalOptions: professionals,
      selectedProfessional: undefined,
      dateOptions: undefined,
      selectedDate: undefined,
      timeOptions: undefined,
      selectedSlot: undefined,
      timePage: 0
    };
    await saveIntakeContext(ticket, nextContext, {
      intakeStatus: "AWAITING_PROFESSIONAL_NAME"
    });
    await sendBotMessage(ticket, professionalPrompt(nextContext));
    return { handled: true, showQueueMenu: false };
  } catch (error) {
    logger.error({
      info: "Could not list Quark professionals for patient intake",
      ticketId: ticket.id,
      err: error
    });
    return completeIntake(ticket, QUARK_AVAILABILITY_FAILURE_MESSAGE, {
      source: "QUARK_AVAILABILITY_ERROR"
    });
  }
};

const showDates = async (
  ticket: Ticket,
  context: PatientIntakeContext,
  professional: IntakeProfessionalOption,
  loadedDates?: IntakeDateOption[]
): Promise<PatientIntakeResult> => {
  try {
    const dates =
      loadedDates || (await listIntakeAvailabilityDates(professional));
    if (dates.length === 0) {
      const nextContext = trimmedContextFor(
        "AWAITING_PROFESSIONAL_NAME",
        context
      );
      await saveIntakeContext(ticket, nextContext, {
        intakeStatus: "AWAITING_PROFESSIONAL_NAME"
      });
      await sendBotMessage(
        ticket,
        `${NO_AVAILABILITY_MESSAGE}\n\n${professionalPrompt(nextContext)}`
      );
      return { handled: true, showQueueMenu: false };
    }
    const nextContext: PatientIntakeContext = {
      ...context,
      selectedProfessional: professional,
      dateOptions: dates,
      selectedDate: undefined,
      timeOptions: undefined,
      selectedSlot: undefined,
      timePage: 0
    };
    await saveIntakeContext(ticket, nextContext, {
      intakeStatus: "AWAITING_AVAILABILITY_DATE"
    });
    await sendPromptForStatus(
      ticket,
      "AWAITING_AVAILABILITY_DATE",
      nextContext
    );
    return { handled: true, showQueueMenu: false };
  } catch (error) {
    logger.error({
      info: "Could not list Quark free slots for patient intake",
      ticketId: ticket.id,
      err: error
    });
    return completeIntake(ticket, QUARK_AVAILABILITY_FAILURE_MESSAGE, {
      source: "QUARK_AVAILABILITY_ERROR"
    });
  }
};

const finishBooking = async (
  ticket: Ticket,
  context: PatientIntakeContext,
  result: IntakeBookingResult
): Promise<PatientIntakeResult> => {
  if (result.status === "PROCESSING") {
    await sendBotMessage(ticket, BOOKING_PROCESSING_MESSAGE);
    return { handled: true, showQueueMenu: false };
  }
  if (result.status === "SLOT_UNAVAILABLE") {
    await sendBotMessage(ticket, SLOT_NO_LONGER_AVAILABLE_MESSAGE);
    if (!context.selectedProfessional) {
      return completeIntake(ticket, QUARK_AVAILABILITY_FAILURE_MESSAGE);
    }
    return showDates(ticket, context, context.selectedProfessional);
  }
  if (result.status === "FAILED") {
    return completeIntake(ticket, BOOKING_FAILURE_MESSAGE, {
      source: "QUARK_BOOKING_ERROR"
    });
  }
  return completeIntake(
    ticket,
    bookingSuccessMessage({
      patientName: context.patientName || "Paciente",
      professional: context.selectedProfessional?.name || "Profissional",
      date: context.selectedSlot?.date || "",
      time: context.selectedSlot?.time || ""
    }),
    { source: "QUARK_BOOKING", appointmentId: result.appointmentId }
  );
};

const runPatientIntake = async (
  ticket: Ticket,
  body: string
): Promise<PatientIntakeResult> => {
  await ticket.reload();
  if (ticket.userId || ticket.status === "closed" || ticket.queueId)
    return { handled: true, showQueueMenu: false };
  const status = ticket.intakeStatus as IntakeStatus | null;
  if (status === "PAUSED_HUMAN") {
    return { handled: true, showQueueMenu: false };
  }
  if (status === "COMPLETED" || status === "BOOKED") {
    return { handled: false, showQueueMenu: false };
  }
  if (!status) {
    const startedAt = new Date();
    const registeredFirstName = await FindRegisteredPatientNameService(
      ticket.contact?.number || ""
    );
    await saveIntakeContext(
      ticket,
      {},
      {
        intakeStatus: "AWAITING_MENU",
        intakeReason: null,
        intakeStartedAt: startedAt,
        intakeCompletedAt: null,
        intakePausedAt: null
      }
    );
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

  if (
    ticket.intakeContextExpiresAt &&
    ticket.intakeContextExpiresAt.getTime() <= Date.now() &&
    status !== "AWAITING_MENU"
  ) {
    await saveIntakeContext(
      ticket,
      {},
      {
        intakeStatus: "AWAITING_MENU",
        intakeReason: null
      }
    );
    await sendBotMessage(
      ticket,
      `O atendimento automático anterior expirou por segurança.\n\n${initialMenuMessage()}`
    );
    return { handled: true, showQueueMenu: false };
  }

  let context = loadIntakeContext(ticket);
  const normalizedBody = body.trim();
  if (/^MENU$/i.test(normalizedBody)) return handleMenuCommand(ticket);
  if (normalizedBody === "0") return handleBack(ticket, status, context);

  if (status === "AWAITING_MENU") {
    const choice = numberedChoice(body, 6);
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
        `O CPF informado parece inválido.\n\n${withIntakeNavigation(
          CPF_PROMPT
        )}`
      );
      return { handled: true, showQueueMenu: false };
    }
    context = { ...context, cpf: body.replace(/\D/g, "") };
    await saveIntakeContext(ticket, context, { intakeStatus: "AWAITING_NAME" });
    await sendBotMessage(ticket, withIntakeNavigation(NAME_PROMPT));
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_NAME") {
    if (!isValidName(body)) {
      await sendBotMessage(
        ticket,
        `Por favor, informe o nome completo do paciente.\n\n${withIntakeNavigation(
          NAME_PROMPT
        )}`
      );
      return { handled: true, showQueueMenu: false };
    }
    context = { ...context, patientName: body.trim() };
    return nextAfterName(ticket, context);
  }

  if (status === "AWAITING_BIRTH_DATE") {
    if (!isValidBirthDate(body)) {
      await sendBotMessage(
        ticket,
        `A data informada parece inválida. Use o formato DD/MM/AAAA.\n\n${withIntakeNavigation(
          BIRTH_DATE_PROMPT
        )}`
      );
      return { handled: true, showQueueMenu: false };
    }
    context = { ...context, birthDate: body.trim() };
    await saveIntakeContext(ticket, context, {
      intakeStatus: "AWAITING_SPECIALTY"
    });
    await sendBotMessage(ticket, withIntakeNavigation(SPECIALTY_PROMPT));
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_SPECIALTY") {
    const choice = numberedChoice(body, 3);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Escolha uma opção válida.\n\n${withIntakeNavigation(SPECIALTY_PROMPT)}`
      );
      return { handled: true, showQueueMenu: false };
    }
    const specialties: Record<number, IntakeSpecialty> = {
      1: "PSYCHIATRY",
      2: "PSYCHOLOGY",
      3: "REPORT"
    };
    context = {
      cpf: context.cpf,
      patientName: context.patientName,
      birthDate: context.birthDate,
      specialty: specialties[choice]
    };
    await saveIntakeContext(ticket, context, {
      intakeStatus: "AWAITING_PAYMENT"
    });
    await sendBotMessage(ticket, withIntakeNavigation(PAYMENT_PROMPT));
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_PAYMENT") {
    const choice = numberedChoice(body, 2);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Escolha uma opção válida.\n\n${withIntakeNavigation(PAYMENT_PROMPT)}`
      );
      return { handled: true, showQueueMenu: false };
    }
    context = {
      ...context,
      payment: choice === 1 ? "PRIVATE" : "INSURANCE",
      insurance: undefined
    };
    if (choice === 2) {
      await saveIntakeContext(ticket, context, {
        intakeStatus: "AWAITING_INSURANCE"
      });
      await sendBotMessage(ticket, withIntakeNavigation(INSURANCE_PROMPT));
      return { handled: true, showQueueMenu: false };
    }
    if (ticket.intakeReason === "INSURANCE_OR_PRICE") {
      return completeIntake(ticket);
    }
    return showProfessionals(ticket, context);
  }

  if (status === "AWAITING_INSURANCE") {
    if (body.trim().length < 2) {
      await sendBotMessage(ticket, withIntakeNavigation(INSURANCE_PROMPT));
      return { handled: true, showQueueMenu: false };
    }
    context = { ...context, insurance: body.trim() };
    if (ticket.intakeReason === "INSURANCE_OR_PRICE") {
      return completeIntake(ticket);
    }
    return showProfessionals(ticket, context);
  }

  if (status === "AWAITING_PROFESSIONAL_PREFERENCE") {
    const choice = numberedChoice(body, 2);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Escolha uma opção válida.\n\n${withIntakeNavigation(
          PROFESSIONAL_PREFERENCE_PROMPT
        )}`
      );
      return { handled: true, showQueueMenu: false };
    }
    if (choice === 1) {
      await saveIntakeContext(ticket, context, {
        intakeStatus: "AWAITING_PROFESSIONAL_NAME"
      });
      await sendBotMessage(
        ticket,
        withIntakeNavigation(PROFESSIONAL_NAME_PROMPT)
      );
      return { handled: true, showQueueMenu: false };
    }
    return completeIntake(ticket);
  }

  if (status === "AWAITING_PROFESSIONAL_NAME") {
    const professionals = context.professionalOptions || [];
    if (professionals.length === 0) {
      if (!isValidName(body)) {
        await sendBotMessage(
          ticket,
          withIntakeNavigation(PROFESSIONAL_NAME_PROMPT)
        );
        return { handled: true, showQueueMenu: false };
      }
      return completeIntake(ticket);
    }
    const choice = numberedChoice(body, professionals.length + 1);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Escolha uma opção válida.\n\n${professionalPrompt(context)}`
      );
      return { handled: true, showQueueMenu: false };
    }
    if (choice === professionals.length + 1) {
      try {
        const first = await findFirstIntakeAvailability(professionals);
        if (!first) {
          await sendBotMessage(
            ticket,
            `${NO_AVAILABILITY_MESSAGE}\n\n${professionalPrompt(context)}`
          );
          return { handled: true, showQueueMenu: false };
        }
        return showDates(ticket, context, first.professional, first.dates);
      } catch (error) {
        logger.error({
          info: "Could not find first Quark availability",
          ticketId: ticket.id,
          err: error
        });
        return completeIntake(ticket, QUARK_AVAILABILITY_FAILURE_MESSAGE);
      }
    }
    return showDates(ticket, context, professionals[choice - 1]);
  }

  if (status === "AWAITING_AVAILABILITY_DATE") {
    const dates = context.dateOptions || [];
    const choice = numberedChoice(body, dates.length);
    if (!choice) {
      await sendBotMessage(
        ticket,
        `Escolha uma data válida.\n\n${availabilityDatesMessage(
          context.selectedProfessional?.name || "profissional",
          dates.map(date => ({ label: date.label, slots: date.slots.length }))
        )}`
      );
      return { handled: true, showQueueMenu: false };
    }
    const selectedDate = dates[choice - 1];
    context = {
      ...context,
      selectedDate,
      timeOptions: selectedDate.slots,
      selectedSlot: undefined,
      timePage: 0
    };
    await saveIntakeContext(ticket, context, {
      intakeStatus: "AWAITING_AVAILABILITY_TIME"
    });
    await sendPromptForStatus(ticket, "AWAITING_AVAILABILITY_TIME", context);
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_AVAILABILITY_TIME") {
    const options = context.timeOptions || [];
    const page = Math.max(0, context.timePage || 0);
    if (/^MAIS$/i.test(normalizedBody)) {
      const nextPage = (page + 1) * 8 < options.length ? page + 1 : 0;
      context = { ...context, timePage: nextPage };
      await saveIntakeContext(ticket, context, { intakeStatus: status });
      await sendPromptForStatus(ticket, status, context);
      return { handled: true, showQueueMenu: false };
    }
    const visible = options.slice(page * 8, page * 8 + 8);
    const choice = numberedChoice(body, visible.length);
    if (!choice) {
      await sendPromptForStatus(ticket, status, context);
      return { handled: true, showQueueMenu: false };
    }
    context = { ...context, selectedSlot: visible[choice - 1] };
    await saveIntakeContext(ticket, context, {
      intakeStatus: "AWAITING_BOOKING_CONFIRMATION"
    });
    await sendPromptForStatus(ticket, "AWAITING_BOOKING_CONFIRMATION", context);
    return { handled: true, showQueueMenu: false };
  }

  if (status === "AWAITING_BOOKING_CONFIRMATION") {
    const choice = numberedChoice(body, 2);
    if (!choice) {
      await sendPromptForStatus(ticket, status, context);
      return { handled: true, showQueueMenu: false };
    }
    if (choice === 2) {
      return handleBack(ticket, status, context);
    }
    if (!isPatientIntakeBookingEnabled()) {
      return completeIntake(
        ticket,
        `Perfeito! Registrei sua preferência por *${
          context.selectedProfessional?.name || "profissional"
        }*, no dia *${context.selectedSlot?.date}*, às *${
          context.selectedSlot?.time
        }*.\n\nNossa equipe dará continuidade à reserva no QuarkClinic. 💚`,
        { source: "QUARK_SLOT_SELECTED" }
      );
    }
    await saveIntakeContext(ticket, context, {
      intakeStatus: "BOOKING_PROCESSING"
    });
    const result = await BookPatientIntakeAppointmentService(ticket, context);
    return finishBooking(ticket, context, result);
  }

  if (status === "BOOKING_PROCESSING") {
    await sendBotMessage(ticket, BOOKING_PROCESSING_MESSAGE);
    return { handled: true, showQueueMenu: false };
  }

  return { handled: false, showQueueMenu: false };
};

const PatientIntakeService = (
  ticket: Ticket,
  body: string,
  eventId?: string
): Promise<PatientIntakeResult> =>
  eventId
    ? replyContext.run({ eventId, sequence: 0 }, () =>
        runPatientIntake(ticket, body)
      )
    : runPatientIntake(ticket, body);
export default PatientIntakeService;
