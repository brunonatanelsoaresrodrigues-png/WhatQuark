/* eslint-disable no-await-in-loop */
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import QuarkAppointment from "../../models/QuarkAppointment";
import QuarkAppointmentResponse from "../../models/QuarkAppointmentResponse";
import { logger } from "../../utils/logger";
import HandleQuarkConfirmationReply from "./HandleQuarkConfirmationReply";
import { parseConfirmationReply } from "./appointmentUtils";
import { emitQuarkDashboardUpdate } from "./dashboardEvents";

interface CandidateRow {
  messageId: string;
  body: string;
}

interface StuckResponseRow {
  id: number;
  appointmentId: string;
  decision: "CONFIRMED" | "CANCELLED";
  appointmentStatus: string;
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
    m.body
  FROM Messages m
  INNER JOIN QuarkAppointmentNotifications n
    ON n.ticketId = m.ticketId
   AND n.status = 'SENT'
   AND n.sentAt <= m.createdAt
   AND JSON_UNQUOTE(JSON_EXTRACT(n.payload, '$.requestsConfirmation')) = 'true'
  INNER JOIN QuarkAppointments a
    ON a.appointmentId = n.appointmentId
  WHERE m.fromMe = 0
    AND m.createdAt >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
    AND a.status = 'AGENDADO'
    AND a.awaitingConfirmation = 1
    AND a.scheduledAt >= NOW()
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

export const responseDecisionMatchesStatus = (
  decision: "CONFIRMED" | "CANCELLED",
  status: string
): boolean =>
  decision === "CONFIRMED"
    ? status === "CONFIRMADO"
    : ["CANCELADO", "CANCELADO_VIA_SMS", "EXCLUIDO"].includes(status);

export const ReconcileStuckQuarkResponses = async (): Promise<number> => {
  const rows = await sequelize.query<StuckResponseRow>(
    `SELECT r.id, r.appointmentId, r.decision, a.status AS appointmentStatus
    FROM QuarkAppointmentResponses r
    INNER JOIN QuarkAppointments a ON a.appointmentId = r.appointmentId
    WHERE r.status = 'PROCESSING'
      AND r.receivedAt < DATE_SUB(NOW(), INTERVAL 2 MINUTE)
    ORDER BY r.receivedAt ASC
    LIMIT 100`,
    { type: QueryTypes.SELECT }
  );

  for (const row of rows) {
    const applied = responseDecisionMatchesStatus(
      row.decision,
      row.appointmentStatus
    );
    await QuarkAppointmentResponse.update(
      applied
        ? {
            status: "SUCCESS",
            newQuarkStatus: row.appointmentStatus,
            appliedAt: new Date(),
            errorCode: null
          }
        : {
            status: "FAILED",
            appliedAt: new Date(),
            errorCode: "RECOVERED_STALE_PROCESSING_RESPONSE"
          },
      { where: { id: row.id, status: "PROCESSING" } }
    );
    if (!applied && row.appointmentStatus === "AGENDADO") {
      await QuarkAppointment.update(
        { awaitingConfirmation: true },
        { where: { appointmentId: row.appointmentId } }
      );
    }
    emitQuarkDashboardUpdate("response", row.id);
  }
  return rows.length;
};

export const ReconcileQuarkConfirmationReplies = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    const recoveredStuck = await ReconcileStuckQuarkResponses();
    const rows = await sequelize.query<CandidateRow>(candidateSql, {
      type: QueryTypes.SELECT
    });
    const candidateMessages = new Map<string, string>();

    for (const row of rows) {
      if (parseConfirmationReply(row.body)) {
        candidateMessages.set(row.messageId, row.body);
      }
    }

    let handled = 0;
    for (const messageId of candidateMessages.keys()) {
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

    if (handled > 0 || recoveredStuck > 0) {
      logger.info({
        info: "QuarkClinic missed confirmation replies reconciled",
        handled,
        recoveredStuck
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
