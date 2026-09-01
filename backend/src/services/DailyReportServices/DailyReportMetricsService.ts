import { QueryTypes } from "sequelize";
import sequelize from "../../database";

const numberValue = (value: unknown): number => Number(value || 0);

const queryOne = async (
  sql: string,
  replacements: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const rows = (await sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT
  })) as Array<Record<string, unknown>>;
  return rows[0] || {};
};

export interface DailyReportSnapshot {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  attendance: Record<string, number | string>;
  messages: Record<string, number>;
  appointments: Record<string, number>;
  agents: Array<Record<string, number | string | null>>;
  alerts: Record<string, number | string | null>;
  dataQuality: { complete: boolean; warnings: string[] };
}

interface Request {
  periodStart: Date;
  periodEnd: Date;
  tomorrowStart: Date;
  tomorrowEnd: Date;
}

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const DailyReportMetricsService = async ({
  periodStart,
  periodEnd,
  tomorrowStart,
  tomorrowEnd
}: Request): Promise<DailyReportSnapshot> => {
  const replacements = { periodStart, periodEnd, tomorrowStart, tomorrowEnd };
  const attendance = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM Contacts c WHERE c.isInternal = 0 AND c.createdAt >= :periodStart AND c.createdAt < :periodEnd) AS newContacts,
       (SELECT COUNT(*) FROM Tickets t WHERE t.ticketType = 'PATIENT' AND t.createdAt >= :periodStart AND t.createdAt < :periodEnd) AS newConversations,
       (SELECT COUNT(DISTINCT m.ticketId) FROM Messages m INNER JOIN Tickets t ON t.id=m.ticketId WHERE t.ticketType='PATIENT' AND m.createdAt >= :periodStart AND m.createdAt < :periodEnd) AS moved,
       (SELECT COUNT(*) FROM TicketEvents e INNER JOIN Tickets t ON t.id=e.ticketId WHERE t.ticketType='PATIENT' AND e.eventType='REOPENED' AND e.occurredAt >= :periodStart AND e.occurredAt < :periodEnd) AS reopened,
       (SELECT COUNT(*) FROM TicketEvents e INNER JOIN Tickets t ON t.id=e.ticketId WHERE t.ticketType='PATIENT' AND e.eventType IN ('CLOSED_BY_USER','CLOSED_BY_INACTIVITY') AND e.occurredAt >= :periodStart AND e.occurredAt < :periodEnd) AS resolved,
       (SELECT COUNT(*) FROM TicketEvents e INNER JOIN Tickets t ON t.id=e.ticketId WHERE t.ticketType='PATIENT' AND e.eventType='CLOSED_BY_INACTIVITY' AND e.occurredAt >= :periodStart AND e.occurredAt < :periodEnd) AS closedByInactivity,
       (SELECT COUNT(*) FROM TicketEvents e INNER JOIN Tickets t ON t.id=e.ticketId WHERE t.ticketType='PATIENT' AND e.eventType='TRANSFERRED' AND e.occurredAt >= :periodStart AND e.occurredAt < :periodEnd) AS transferred,
       (SELECT COUNT(*) FROM Tickets t WHERE t.ticketType='PATIENT' AND t.status='open') AS openNow,
       (SELECT COUNT(*) FROM Tickets t WHERE t.ticketType='PATIENT' AND t.status='pending') AS pendingNow,
       (SELECT COUNT(*) FROM Tickets t WHERE t.ticketType='PATIENT' AND t.status IN ('open','pending') AND t.userId IS NULL) AS unassignedNow,
       (SELECT COUNT(*) FROM Tickets t WHERE t.ticketType='PATIENT' AND t.awaitingPatientSince IS NOT NULL) AS waitingPatientNow,
       (SELECT COALESCE(DATE_FORMAT(m.createdAt, '%H:00'), '-') FROM Messages m INNER JOIN Tickets t ON t.id=m.ticketId WHERE t.ticketType='PATIENT' AND m.createdAt >= :periodStart AND m.createdAt < :periodEnd GROUP BY HOUR(m.createdAt) ORDER BY COUNT(*) DESC LIMIT 1) AS busiestHour`,
    replacements
  );

  const messages = await queryOne(
    `SELECT
       SUM(m.fromMe = 0) AS received,
       SUM(m.fromMe = 1) AS sent,
       SUM(m.origin = 'HUMAN') AS human,
       SUM(m.origin = 'BOT') AS bot,
       SUM(m.origin = 'QUARK') AS quark,
       SUM(m.origin = 'INACTIVITY') AS inactivity,
       SUM(m.origin = 'SYSTEM') AS system,
       SUM(m.fromMe = 1 AND m.origin = 'UNKNOWN') AS unknownOutgoing,
       SUM(m.fromMe = 0 AND m.mediaType = 'audio') AS audiosReceived,
       SUM(m.fromMe = 0 AND m.mediaType IN ('image','document')) AS mediaReceived,
       SUM(m.fromMe = 1 AND m.ack < 0) AS failed,
       COUNT(DISTINCT m.ticketId) AS conversations
     FROM Messages m
     INNER JOIN Tickets t ON t.id=m.ticketId
     WHERE t.ticketType='PATIENT' AND m.createdAt >= :periodStart AND m.createdAt < :periodEnd`,
    replacements
  );

  const appointmentEvents = await queryOne(
    `SELECT
       SUM(eventType='CREATED') AS created,
       SUM(eventType='CONFIRMED') AS confirmed,
       SUM(eventType='CANCELLED') AS cancelled,
       SUM(eventType='RESCHEDULED') AS rescheduled,
       SUM(eventType='UPDATED') AS updated
     FROM QuarkAppointmentEvents
     WHERE occurredAt >= :periodStart AND occurredAt < :periodEnd`,
    replacements
  );
  const appointmentCurrent = await queryOne(
    `SELECT
       SUM(awaitingConfirmation=1) AS awaitingConfirmation,
       SUM(scheduledAt >= :tomorrowStart AND scheduledAt < :tomorrowEnd) AS tomorrow,
       SUM(scheduledAt >= :tomorrowStart AND scheduledAt < :tomorrowEnd AND awaitingConfirmation=1) AS tomorrowUnconfirmed
     FROM QuarkAppointments`,
    replacements
  );
  const notificationMetrics = await queryOne(
    `SELECT
       SUM(status='SENT') AS notificationsSent,
       SUM(deliveredAt IS NOT NULL) AS notificationsDelivered,
       SUM(readAt IS NOT NULL) AS notificationsRead,
       SUM(status='DEAD_LETTER') AS notificationFailures
     FROM QuarkAppointmentNotifications
     WHERE createdAt >= :periodStart AND createdAt < :periodEnd`,
    replacements
  );
  const responseMetrics = await queryOne(
    `SELECT
       SUM(status='SUCCESS' AND decision='CONFIRMED') AS confirmedViaWhatsapp,
       SUM(status='SUCCESS' AND decision='CANCELLED') AS cancelledViaWhatsapp,
       SUM(status='FAILED') AS applyFailures,
       AVG(CASE WHEN status='SUCCESS' THEN responseTimeSeconds END) AS averageResponseSeconds
     FROM QuarkAppointmentResponses
     WHERE receivedAt >= :periodStart AND receivedAt < :periodEnd`,
    replacements
  );

  const rawAgentMessages = (await sequelize.query(
    `SELECT m.ticketId,m.sentByUserId,m.fromMe,m.origin,m.createdAt,u.name AS userName
     FROM Messages m
     INNER JOIN Tickets t ON t.id=m.ticketId
     LEFT JOIN Users u ON u.id=m.sentByUserId
     WHERE t.ticketType='PATIENT' AND m.createdAt >= :periodStart AND m.createdAt < :periodEnd
     ORDER BY m.ticketId,m.createdAt`,
    { replacements, type: QueryTypes.SELECT }
  )) as Array<any>;
  const eventRows = (await sequelize.query(
    `SELECT e.performedByUserId,u.name AS userName,e.eventType,COUNT(*) AS total
     FROM TicketEvents e
     INNER JOIN Tickets t ON t.id=e.ticketId
     LEFT JOIN Users u ON u.id=e.performedByUserId
     WHERE t.ticketType='PATIENT' AND e.occurredAt >= :periodStart AND e.occurredAt < :periodEnd AND e.performedByUserId IS NOT NULL
     GROUP BY e.performedByUserId,u.name,e.eventType`,
    { replacements, type: QueryTypes.SELECT }
  )) as Array<any>;

  const agents = new Map<
    number,
    {
      id: number;
      name: string;
      messages: number;
      tickets: Set<number>;
      responses: number[];
      accepted: number;
      resolved: number;
      transferred: number;
    }
  >();
  const ensureAgent = (id: number, name: string) => {
    if (!agents.has(id)) {
      agents.set(id, {
        id,
        name: name || `Atendente ${id}`,
        messages: 0,
        tickets: new Set<number>(),
        responses: [],
        accepted: 0,
        resolved: 0,
        transferred: 0
      });
    }
    return agents.get(id)!;
  };

  const byTicket = new Map<number, Array<any>>();
  rawAgentMessages.forEach(row => {
    const ticketId = Number(row.ticketId);
    if (!byTicket.has(ticketId)) byTicket.set(ticketId, []);
    byTicket.get(ticketId)!.push(row);
    if (row.origin === "HUMAN" && row.sentByUserId) {
      const agent = ensureAgent(Number(row.sentByUserId), row.userName);
      agent.messages += 1;
      agent.tickets.add(ticketId);
    }
  });
  byTicket.forEach(rows => {
    const firstIncoming = rows.find(row => !row.fromMe);
    if (!firstIncoming) return;
    const firstHuman = rows.find(
      row =>
        row.origin === "HUMAN" &&
        row.sentByUserId &&
        new Date(row.createdAt).getTime() >=
          new Date(firstIncoming.createdAt).getTime()
    );
    if (!firstHuman) return;
    ensureAgent(
      Number(firstHuman.sentByUserId),
      firstHuman.userName
    ).responses.push(
      Math.max(
        0,
        Math.round(
          (new Date(firstHuman.createdAt).getTime() -
            new Date(firstIncoming.createdAt).getTime()) /
            1000
        )
      )
    );
  });
  eventRows.forEach(row => {
    const agent = ensureAgent(Number(row.performedByUserId), row.userName);
    const total = numberValue(row.total);
    if (row.eventType === "ACCEPTED") agent.accepted += total;
    if (["CLOSED_BY_USER", "CLOSED_BY_INACTIVITY"].includes(row.eventType)) {
      agent.resolved += total;
    }
    if (row.eventType === "TRANSFERRED") agent.transferred += total;
  });

  const sync = await queryOne(
    `SELECT lastSuccessfulSyncAt FROM QuarkSyncStates WHERE \`key\`='appointments' LIMIT 1`,
    replacements
  );
  const operational = await queryOne(
    `SELECT
       (SELECT COUNT(*) FROM Whatsapps WHERE status='CONNECTED') AS connectedWhatsapps,
       (SELECT COUNT(*) FROM QuarkAppointmentNotifications WHERE status IN ('PENDING','FAILED_RETRY')) AS queuedNotifications,
       (SELECT COUNT(*) FROM QuarkAppointmentNotifications WHERE status='PROCESSING') AS processingNotifications,
       (SELECT COUNT(*) FROM QuarkAppointmentNotifications WHERE status='DEAD_LETTER') AS deadLetters,
       (SELECT COUNT(*) FROM QuarkAppointments WHERE phone IS NULL OR phone='') AS invalidPhones`,
    replacements
  );

  const moved = numberValue(attendance.moved);
  const resolved = numberValue(attendance.resolved);
  const received = numberValue(messages.received);
  const sent = numberValue(messages.sent);
  const unknownOutgoing = numberValue(messages.unknownOutgoing);
  const warnings: string[] = [];
  if (unknownOutgoing > 0) {
    warnings.push(
      `${unknownOutgoing} mensagem(ns) enviada(s) não possuem autoria histórica precisa.`
    );
  }
  const freshness = sync.lastSuccessfulSyncAt
    ? new Date(String(sync.lastSuccessfulSyncAt))
    : null;
  if (
    !freshness ||
    periodEnd.getTime() - freshness.getTime() > 15 * 60 * 1000
  ) {
    warnings.push(
      "A sincronização do QuarkClinic está atrasada; a agenda pode estar parcial."
    );
  }

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    attendance: {
      newContacts: numberValue(attendance.newContacts),
      newConversations: numberValue(attendance.newConversations),
      moved,
      reopened: numberValue(attendance.reopened),
      resolved,
      closedByInactivity: numberValue(attendance.closedByInactivity),
      transferred: numberValue(attendance.transferred),
      openNow: numberValue(attendance.openNow),
      pendingNow: numberValue(attendance.pendingNow),
      unassignedNow: numberValue(attendance.unassignedNow),
      waitingPatientNow: numberValue(attendance.waitingPatientNow),
      resolutionRate: moved ? Number(((resolved / moved) * 100).toFixed(1)) : 0,
      busiestHour: String(attendance.busiestHour || "-")
    },
    messages: {
      received,
      sent,
      human: numberValue(messages.human),
      bot: numberValue(messages.bot),
      quark: numberValue(messages.quark),
      inactivity: numberValue(messages.inactivity),
      system: numberValue(messages.system),
      unknownOutgoing,
      audiosReceived: numberValue(messages.audiosReceived),
      mediaReceived: numberValue(messages.mediaReceived),
      failed: numberValue(messages.failed),
      averagePerConversation: numberValue(messages.conversations)
        ? Number(
            ((received + sent) / numberValue(messages.conversations)).toFixed(1)
          )
        : 0
    },
    appointments: {
      created: numberValue(appointmentEvents.created),
      confirmed: numberValue(appointmentEvents.confirmed),
      cancelled: numberValue(appointmentEvents.cancelled),
      rescheduled: numberValue(appointmentEvents.rescheduled),
      updated: numberValue(appointmentEvents.updated),
      awaitingConfirmation: numberValue(
        appointmentCurrent.awaitingConfirmation
      ),
      tomorrow: numberValue(appointmentCurrent.tomorrow),
      tomorrowUnconfirmed: numberValue(appointmentCurrent.tomorrowUnconfirmed),
      notificationsSent: numberValue(notificationMetrics.notificationsSent),
      notificationsDelivered: numberValue(
        notificationMetrics.notificationsDelivered
      ),
      notificationsRead: numberValue(notificationMetrics.notificationsRead),
      notificationFailures: numberValue(
        notificationMetrics.notificationFailures
      ),
      confirmedViaWhatsapp: numberValue(responseMetrics.confirmedViaWhatsapp),
      cancelledViaWhatsapp: numberValue(responseMetrics.cancelledViaWhatsapp),
      applyFailures: numberValue(responseMetrics.applyFailures),
      averageResponseSeconds: numberValue(
        responseMetrics.averageResponseSeconds
      )
    },
    agents: Array.from(agents.values())
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        messages: agent.messages,
        tickets: agent.tickets.size,
        accepted: agent.accepted,
        resolved: agent.resolved,
        transferred: agent.transferred,
        medianFirstResponseSeconds: median(agent.responses),
        averageFirstResponseSeconds: agent.responses.length
          ? Math.round(
              agent.responses.reduce((sum, value) => sum + value, 0) /
                agent.responses.length
            )
          : null
      }))
      .sort((left, right) =>
        String(left.name).localeCompare(String(right.name))
      ),
    alerts: {
      connectedWhatsapps: numberValue(operational.connectedWhatsapps),
      queuedNotifications: numberValue(operational.queuedNotifications),
      processingNotifications: numberValue(operational.processingNotifications),
      deadLetters: numberValue(operational.deadLetters),
      invalidPhones: numberValue(operational.invalidPhones),
      unassignedTickets: numberValue(attendance.unassignedNow),
      tomorrowUnconfirmed: numberValue(appointmentCurrent.tomorrowUnconfirmed),
      quarkLastSuccessfulSyncAt: freshness ? freshness.toISOString() : null
    },
    dataQuality: { complete: warnings.length === 0, warnings }
  };
};

export default DailyReportMetricsService;
