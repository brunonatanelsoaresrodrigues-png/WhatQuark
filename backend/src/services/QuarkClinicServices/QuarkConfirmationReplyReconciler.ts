/* eslint-disable no-await-in-loop */
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { logger } from "../../utils/logger";
import HandleQuarkConfirmationReply from "./HandleQuarkConfirmationReply";
import { parseConfirmationReply } from "./appointmentUtils";

interface CandidateRow {
  messageId: string;
  appointmentId: string;
  body: string;
}

let timer: NodeJS.Timeout | undefined;
let running = false;
let started = false;

const intervalMs = (): number => {
  const configured = Number(
    process.env.QUARK_REPLY_RECONCILIATION_INTERVAL_SECONDS
  );
  return (Number.isFinite(configured) && configured >= 30 ? configured : 60) *
    1000;
};

const candidateSql = `
  SELECT
    m.id AS messageId,
    n.appointmentId,
    m.body
  FROM Messages m
  INNER JOIN QuarkAppointmentNotifications n
    ON n.ticketId = m.ticketId
   AND n.status = 'SENT'
   AND n.sentAt <= m.createdAt
  INNER JOIN QuarkAppointments a
    ON a.appointmentId = n.appointmentId
  LEFT JOIN Messages previousOutbound
    ON previousOutbound.id = (
      SELECT pm.id
      FROM Messages pm
      WHERE pm.ticketId = m.ticketId
        AND pm.fromMe = 1
        AND pm.createdAt < m.createdAt
      ORDER BY pm.createdAt DESC, pm.id DESC
      LIMIT 1
    )
  WHERE m.fromMe = 0
    AND m.createdAt >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
    AND a.status = 'AGENDADO'
    AND a.awaitingConfirmation = 1
    AND a.scheduledAt >= NOW()
    AND (
      m.quotedMsgId = n.messageId
      OR previousOutbound.id = n.messageId
    )
    AND NOT EXISTS (
      SELECT 1
      FROM QuarkAppointmentResponses successful
      WHERE successful.appointmentId = n.appointmentId
        AND successful.status = 'SUCCESS'
    )
    AND (
      SELECT COUNT(*)
      FROM QuarkAppointmentResponses failed
      WHERE failed.appointmentId = n.appointmentId
        AND failed.status = 'FAILED'
    ) < 3
    AND NOT EXISTS (
      SELECT 1
      FROM QuarkAppointmentResponses recentFailure
      WHERE recentFailure.appointmentId = n.appointmentId
        AND recentFailure.status = 'FAILED'
        AND recentFailure.appliedAt >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    )
  ORDER BY m.createdAt ASC, m.id ASC
`;

export const ReconcileQuarkConfirmationReplies = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    const rows = await sequelize.query<CandidateRow>(candidateSql, {
      type: QueryTypes.SELECT
    });
    const latestByAppointment = new Map<string, string>();

    for (const row of rows) {
      if (parseConfirmationReply(row.body)) {
        latestByAppointment.set(row.appointmentId, row.messageId);
      }
    }

    let handled = 0;
    for (const messageId of latestByAppointment.values()) {
      const message = await Message.findByPk(messageId);
      if (!message) continue;
      const ticket = await Ticket.findByPk(message.ticketId, {
        include: [Contact]
      });
      if (!ticket?.contact || !ticket.whatsappId) continue;

      const result = await HandleQuarkConfirmationReply({
        body: message.body,
        phone: ticket.contact.number,
        ticket,
        whatsappId: ticket.whatsappId,
        message
      });
      if (result) handled += 1;
    }

    if (handled > 0) {
      logger.info({
        info: "QuarkClinic missed confirmation replies reconciled",
        handled
      });
    }
  } catch (error) {
    logger.error({
      info: "QuarkClinic confirmation reply reconciliation failed",
      err: error
    });
  } finally {
    running = false;
  }
};

const schedule = (): void => {
  if (!started) return;
  timer = setTimeout(async () => {
    await ReconcileQuarkConfirmationReplies();
    schedule();
  }, intervalMs());
  timer.unref();
};

export const StartQuarkConfirmationReplyReconciler = (): void => {
  if (started) return;
  started = true;
  timer = setTimeout(async () => {
    await ReconcileQuarkConfirmationReplies();
    schedule();
  }, 15000);
  timer.unref();
};

export const StopQuarkConfirmationReplyReconciler = async (): Promise<void> => {
  started = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
  while (running) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};
