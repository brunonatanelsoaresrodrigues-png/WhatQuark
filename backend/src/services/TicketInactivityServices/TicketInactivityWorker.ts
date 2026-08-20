import { Op } from "sequelize";
import sequelize from "../../database";
import Message from "../../models/Message";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentResponse from "../../models/QuarkAppointmentResponse";
import Ticket from "../../models/Ticket";
import TicketInactivityEvent from "../../models/TicketInactivityEvent";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowTicketService from "../TicketServices/ShowTicketService";
import {
  getTicketInactivityConfig,
  INACTIVITY_CLOSE_REASON,
  TicketInactivityConfig
} from "./config";
import { emitTicketInactivityUpdate } from "./ticketEvents";

let workerTimer: NodeJS.Timeout | undefined;
let workerStopped = true;
let activeRun: Promise<void> | undefined;

const digitsOnly = (value: string | null | undefined): string =>
  String(value || "").replace(/\D/g, "");

const samePhone = (left: string, right: string): boolean => {
  const normalizedLeft = digitsOnly(left);
  const normalizedRight = digitsOnly(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.endsWith(normalizedRight) ||
    normalizedRight.endsWith(normalizedLeft)
  );
};

const hasQuarkOperationInProgress = async (phone: string): Promise<boolean> => {
  const processingResponses = await QuarkAppointmentResponse.findAll({
    attributes: ["appointmentId"],
    where: { status: "PROCESSING" }
  });
  if (processingResponses.length === 0) return false;

  const appointmentIds = processingResponses.map(item => item.appointmentId);
  const appointments = await QuarkAppointment.findAll({
    attributes: ["appointmentId", "phone"],
    where: { appointmentId: { [Op.in]: appointmentIds } }
  });

  return appointments.some(appointment =>
    samePhone(appointment.phone || "", phone)
  );
};

const recoverStuckClaims = async (
  config: TicketInactivityConfig
): Promise<void> => {
  const threshold = new Date(
    Date.now() - config.claimTimeoutMinutes * 60 * 1000
  );
  const [count] = await Ticket.update(
    { inactivityClosingAt: null },
    {
      where: {
        status: "open",
        awaitingPatientSince: { [Op.gt]: new Date(0) },
        inactivityClosingAt: { [Op.lt]: threshold }
      }
    }
  );

  if (count > 0) {
    logger.warn({
      info: "Recovered stuck patient inactivity claims",
      count
    });
  }
};

const claimDueTicket = async (
  config: TicketInactivityConfig
): Promise<Ticket | undefined> => {
  const dueBefore = new Date(
    Date.now() - config.timeoutMinutes * 60 * 1000
  );

  return sequelize.transaction(async transaction => {
    const ticket = await Ticket.findOne({
      where: {
        status: "open",
        isGroup: false,
        awaitingPatientSince: { [Op.lte]: dueBefore },
        inactivityClosingAt: null
      },
      order: [["awaitingPatientSince", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true
    } as any);

    if (!ticket) return undefined;
    await ticket.update({ inactivityClosingAt: new Date() }, { transaction });
    return ticket;
  });
};

const releaseClaim = async (ticketId: number): Promise<void> => {
  await Ticket.update(
    { inactivityClosingAt: null },
    { where: { id: ticketId, status: "open" } }
  );
};

const cancelBecausePatientReplied = async (
  ticket: Ticket,
  messageId: string
): Promise<void> => {
  await sequelize.transaction(async transaction => {
    const lockedTicket = await Ticket.findByPk(ticket.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!lockedTicket || lockedTicket.status !== "open") return;

    await lockedTicket.update(
      {
        awaitingPatientSince: null,
        inactivityClosingAt: null,
        inactivityNoticeSentAt: null,
        inactivityNoticeMessageId: null
      },
      { transaction }
    );
    await TicketInactivityEvent.create(
      {
        ticketId: ticket.id,
        eventType: "WAITING_CANCELLED",
        reason: "Paciente respondeu antes do encerramento",
        userId: ticket.userId || null,
        messageId,
        occurredAt: new Date()
      },
      { transaction }
    );
  });
  await emitTicketInactivityUpdate(ticket.id);
};

export const finalizeClosure = async (
  ticketId: number,
  noticeMessageId: string | null
): Promise<boolean> =>
  sequelize.transaction(async transaction => {
    const ticket = await Ticket.findByPk(ticketId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (
      !ticket ||
      ticket.status !== "open" ||
      !ticket.awaitingPatientSince ||
      !ticket.inactivityClosingAt
    ) {
      return false;
    }

    const latestIncoming = await Message.findOne({
      where: {
        ticketId,
        fromMe: false,
        isDeleted: false,
        createdAt: { [Op.gte]: ticket.awaitingPatientSince }
      },
      order: [["createdAt", "DESC"]],
      transaction
    });
    if (latestIncoming) {
      await ticket.update(
        {
          awaitingPatientSince: null,
          inactivityClosingAt: null,
          inactivityNoticeSentAt: null,
          inactivityNoticeMessageId: null
        },
        { transaction }
      );
      await TicketInactivityEvent.create(
        {
          ticketId,
          eventType: "WAITING_CANCELLED",
          reason: "Paciente respondeu antes do encerramento",
          userId: ticket.userId || null,
          messageId: latestIncoming.id,
          occurredAt: new Date()
        },
        { transaction }
      );
      return false;
    }

    const previousUserId = ticket.userId || null;
    await ticket.update(
      {
        status: "closed",
        awaitingPatientSince: null,
        inactivityClosingAt: null,
        closedByInactivity: true,
        inactivityPreviousUserId: previousUserId
      },
      { transaction }
    );
    await TicketInactivityEvent.create(
      {
        ticketId,
        eventType: "CLOSED",
        reason: INACTIVITY_CLOSE_REASON,
        userId: previousUserId,
        messageId: noticeMessageId,
        occurredAt: new Date()
      },
      { transaction }
    );
    return true;
  });

const processTicket = async (
  config: TicketInactivityConfig,
  claimedTicket: Ticket
): Promise<void> => {
  let ticket = await ShowTicketService(claimedTicket.id);
  if (
    ticket.status !== "open" ||
    !ticket.awaitingPatientSince ||
    !ticket.inactivityClosingAt
  ) {
    return;
  }

  const lastMessage = await Message.findOne({
    where: { ticketId: ticket.id, isDeleted: false },
    order: [["createdAt", "DESC"]]
  });
  if (!lastMessage || !lastMessage.fromMe) {
    if (lastMessage && !lastMessage.fromMe) {
      await cancelBecausePatientReplied(ticket, lastMessage.id);
    } else {
      await releaseClaim(ticket.id);
    }
    return;
  }

  const persistedNotice = ticket.inactivityNoticeMessageId
    ? await Message.findByPk(ticket.inactivityNoticeMessageId)
    : null;
  const latestMessageIsNotice =
    Boolean(persistedNotice) && lastMessage.id === persistedNotice?.id;

  if (
    !latestMessageIsNotice &&
    lastMessage.createdAt.getTime() > ticket.awaitingPatientSince.getTime()
  ) {
    await ticket.update({
      awaitingPatientSince: lastMessage.createdAt,
      inactivityClosingAt: null,
      inactivityNoticeSentAt: null,
      inactivityNoticeMessageId: null
    });
    await emitTicketInactivityUpdate(ticket.id);
    return;
  }

  if (await hasQuarkOperationInProgress(ticket.contact.number)) {
    await releaseClaim(ticket.id);
    return;
  }

  const whatsapp = await Whatsapp.findByPk(ticket.whatsappId);
  if (!whatsapp || whatsapp.status !== "CONNECTED") {
    await releaseClaim(ticket.id);
    return;
  }

  let noticeMessageId: string | null = ticket.inactivityNoticeMessageId;
  if (!ticket.inactivityNoticeSentAt) {
    const sentMessage = await SendWhatsAppMessage({
      body: config.message,
      ticket
    });
    noticeMessageId = sentMessage.id;
    await Ticket.update(
      {
        inactivityNoticeSentAt: new Date(),
        inactivityNoticeMessageId: sentMessage.id
      },
      {
        where: {
          id: ticket.id,
          status: "open",
          inactivityClosingAt: { [Op.gt]: new Date(0) }
        }
      }
    );

    // O evento de mensagem enviada é persistido de forma assíncrona pelo
    // provedor. O ticket só pode ser fechado depois que esse eco estiver no
    // histórico, evitando que a própria mensagem de encerramento o reabra.
    let storedMessage: Message | null = null;
    for (let attempt = 0; attempt < 20 && !storedMessage; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      storedMessage = await Message.findByPk(sentMessage.id);
      if (!storedMessage) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    if (!storedMessage) {
      await releaseClaim(ticket.id);
      return;
    }
  } else if (!persistedNotice) {
    await releaseClaim(ticket.id);
    return;
  }

  ticket = await ShowTicketService(ticket.id);
  const closed = await finalizeClosure(ticket.id, noticeMessageId);
  await emitTicketInactivityUpdate(ticket.id, closed ? "open" : undefined);

  if (closed) {
    logger.info({
      info: "Ticket closed due to patient inactivity",
      ticketId: ticket.id,
      reason: INACTIVITY_CLOSE_REASON
    });
  }
};

const scheduleNextRun = (
  config: TicketInactivityConfig,
  delayMs: number
): void => {
  workerTimer = setTimeout(() => {
    activeRun = runWorker(config).finally(() => {
      activeRun = undefined;
    });
  }, delayMs);
  workerTimer.unref();
};

const runWorker = async (config: TicketInactivityConfig): Promise<void> => {
  if (workerStopped) return;

  let nextDelay = config.pollIntervalSeconds * 1000;

  try {
    await recoverStuckClaims(config);
    const ticket = await claimDueTicket(config);
    if (ticket) {
      await processTicket(config, ticket);
      const intervalRange =
        config.sendIntervalMaxSeconds - config.sendIntervalMinSeconds;
      nextDelay =
        (config.sendIntervalMinSeconds +
          Math.floor(Math.random() * (intervalRange + 1))) *
        1000;
    }
  } catch (error) {
    logger.error({ info: "Ticket inactivity worker failed", err: error });
  } finally {
    if (!workerStopped) {
      scheduleNextRun(config, nextDelay);
    }
  }
};

export const StartTicketInactivityWorker = (): void => {
  const config = getTicketInactivityConfig();
  if (!config.enabled || !workerStopped) return;

  workerStopped = false;
  logger.info({
    info: "Ticket inactivity automation scheduled",
    timeoutMinutes: config.timeoutMinutes,
    pollIntervalSeconds: config.pollIntervalSeconds,
    sendIntervalMinSeconds: config.sendIntervalMinSeconds,
    sendIntervalMaxSeconds: config.sendIntervalMaxSeconds
  });
  scheduleNextRun(config, config.pollIntervalSeconds * 1000);
};

export const StopTicketInactivityWorker = async (): Promise<void> => {
  workerStopped = true;
  if (workerTimer) clearTimeout(workerTimer);
  workerTimer = undefined;
  if (activeRun) await activeRun;
};
