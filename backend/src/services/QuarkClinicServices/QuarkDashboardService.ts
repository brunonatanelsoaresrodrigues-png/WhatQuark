import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface DashboardFilters {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  eventType?: string;
  messageStatus?: string;
  responseStatus?: string;
}

interface CountRow {
  [key: string]: string | number | null;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
};

const resolveDateRange = (filters: DashboardFilters) => {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const from =
    filters.from && datePattern.test(filters.from)
      ? filters.from
      : formatDate(defaultFrom);
  const to =
    filters.to && datePattern.test(filters.to) ? filters.to : formatDate(today);
  return {
    from,
    to,
    fromDateTime: `${from} 00:00:00`,
    toDateTime: `${to} 23:59:59`
  };
};

const numberValue = (value: unknown): number => Number(value || 0);

const firstRow = (rows: CountRow[]): CountRow => rows[0] || {};

const parsePhoneList = (
  value: string | number | null,
  fallback: string | number | null
): string[] => {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (Array.isArray(parsed)) {
      return parsed.filter(phone => typeof phone === "string" && phone);
    }
  } catch {
    // Legacy data uses the former primary phone column.
  }
  return fallback ? [String(fallback)] : [];
};

export const getQuarkDashboardSummary = async (filters: DashboardFilters) => {
  const range = resolveDateRange(filters);
  const replacements = {
    fromDateTime: range.fromDateTime,
    toDateTime: range.toDateTime
  };

  const [notificationRows, responseRows, appointmentRows, syncRows] =
    await Promise.all([
      sequelize.query<CountRow>(
        `SELECT
          COUNT(*) AS generated,
          SUM(status = 'SENT') AS sent,
          SUM(deliveredAt IS NOT NULL) AS delivered,
          SUM(readAt IS NOT NULL) AS \`read\`,
          SUM(status IN ('PENDING', 'PROCESSING', 'FAILED_RETRY')) AS queued,
          SUM(status = 'FAILED_RETRY') AS retrying,
          SUM(status = 'DEAD_LETTER') AS failed,
          SUM(status = 'SUPPRESSED') AS suppressed,
          SUM(status = 'SENT' AND eventType <> 'CANCELLED') AS confirmationRequests
        FROM QuarkAppointmentNotifications
        WHERE createdAt BETWEEN :fromDateTime AND :toDateTime`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query<CountRow>(
        `SELECT
          COUNT(*) AS responses,
          SUM(status = 'SUCCESS') AS successfulResponses,
          SUM(status = 'SUCCESS' AND decision = 'CONFIRMED' AND source = 'WHATSAPP') AS confirmedViaWhatsapp,
          SUM(status = 'SUCCESS' AND decision = 'CANCELLED' AND source = 'WHATSAPP') AS cancelledViaWhatsapp,
          SUM(status = 'FAILED') AS responseFailures,
          ROUND(AVG(CASE WHEN status = 'SUCCESS' THEN responseTimeSeconds END)) AS averageResponseSeconds
        FROM QuarkAppointmentResponses
        WHERE receivedAt BETWEEN :fromDateTime AND :toDateTime`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query<CountRow>(
        `SELECT
          COUNT(*) AS monitoredAppointments,
          SUM(status = 'CONFIRMADO') AS confirmedInQuark,
          SUM(status IN ('CANCELADO', 'CANCELADO_VIA_SMS', 'EXCLUIDO')) AS cancelledInQuark,
          SUM(status = 'AGENDADO') AS scheduled,
          SUM(awaitingConfirmation = 1 AND status = 'AGENDADO') AS awaitingResponse
        FROM QuarkAppointments
        WHERE scheduledAt BETWEEN :fromDateTime AND :toDateTime`,
        { replacements, type: QueryTypes.SELECT }
      ),
      sequelize.query<CountRow>(
        `SELECT status, baselineCompletedAt, lastSuccessfulSyncAt
        FROM QuarkSyncStates WHERE \`key\` = 'appointments' LIMIT 1`,
        { type: QueryTypes.SELECT }
      )
    ]);

  const notifications = firstRow(notificationRows);
  const responses = firstRow(responseRows);
  const appointments = firstRow(appointmentRows);
  const confirmationRequests = numberValue(notifications.confirmationRequests);
  const successfulResponses = numberValue(responses.successfulResponses);

  return {
    range: { from: range.from, to: range.to },
    notifications: {
      generated: numberValue(notifications.generated),
      sent: numberValue(notifications.sent),
      delivered: numberValue(notifications.delivered),
      read: numberValue(notifications.read),
      queued: numberValue(notifications.queued),
      retrying: numberValue(notifications.retrying),
      failed: numberValue(notifications.failed),
      suppressed: numberValue(notifications.suppressed)
    },
    responses: {
      total: numberValue(responses.responses),
      successful: successfulResponses,
      confirmed: numberValue(responses.confirmedViaWhatsapp),
      cancelled: numberValue(responses.cancelledViaWhatsapp),
      failed: numberValue(responses.responseFailures),
      averageResponseSeconds: numberValue(responses.averageResponseSeconds),
      responseRate:
        confirmationRequests > 0
          ? Number(
              ((successfulResponses / confirmationRequests) * 100).toFixed(1)
            )
          : 0
    },
    appointments: {
      monitored: numberValue(appointments.monitoredAppointments),
      confirmedInQuark: numberValue(appointments.confirmedInQuark),
      cancelledInQuark: numberValue(appointments.cancelledInQuark),
      scheduled: numberValue(appointments.scheduled),
      awaitingResponse: numberValue(appointments.awaitingResponse)
    },
    sync: syncRows[0] || null
  };
};

export const getQuarkDashboardTimeseries = async (
  filters: DashboardFilters
) => {
  const range = resolveDateRange(filters);
  const replacements = {
    fromDateTime: range.fromDateTime,
    toDateTime: range.toDateTime
  };
  const [notificationRows, responseRows] = await Promise.all([
    sequelize.query<CountRow>(
      `SELECT DATE(createdAt) AS day,
        SUM(status = 'SENT') AS sent,
        SUM(deliveredAt IS NOT NULL) AS delivered,
        SUM(readAt IS NOT NULL) AS \`read\`,
        SUM(status = 'DEAD_LETTER') AS failed
      FROM QuarkAppointmentNotifications
      WHERE createdAt BETWEEN :fromDateTime AND :toDateTime
      GROUP BY DATE(createdAt) ORDER BY day`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query<CountRow>(
      `SELECT DATE(receivedAt) AS day,
        SUM(status = 'SUCCESS' AND decision = 'CONFIRMED') AS confirmed,
        SUM(status = 'SUCCESS' AND decision = 'CANCELLED') AS cancelled
      FROM QuarkAppointmentResponses
      WHERE receivedAt BETWEEN :fromDateTime AND :toDateTime
      GROUP BY DATE(receivedAt) ORDER BY day`,
      { replacements, type: QueryTypes.SELECT }
    )
  ]);

  const byDay = new Map<string, Record<string, string | number>>();
  [...notificationRows, ...responseRows].forEach(row => {
    const day = String(row.day).slice(0, 10);
    const current = byDay.get(day) || {
      day,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      confirmed: 0,
      cancelled: 0
    };
    Object.keys(row).forEach(key => {
      if (key !== "day") current[key] = numberValue(row[key]);
    });
    byDay.set(day, current);
  });
  return Array.from(byDay.values()).sort((a, b) =>
    String(a.day).localeCompare(String(b.day))
  );
};

export const getQuarkDashboardBreakdown = async (filters: DashboardFilters) => {
  const range = resolveDateRange(filters);
  const replacements = {
    fromDateTime: range.fromDateTime,
    toDateTime: range.toDateTime
  };
  const [eventTypes, professionals] = await Promise.all([
    sequelize.query<CountRow>(
      `SELECT eventType,
        COUNT(*) AS generated,
        SUM(status = 'SENT') AS sent,
        SUM(deliveredAt IS NOT NULL) AS delivered,
        SUM(readAt IS NOT NULL) AS \`read\`,
        SUM(status = 'DEAD_LETTER') AS failed
      FROM QuarkAppointmentNotifications
      WHERE createdAt BETWEEN :fromDateTime AND :toDateTime
      GROUP BY eventType ORDER BY generated DESC`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query<CountRow>(
      `SELECT
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.snapshot, '$.profissionalNome')), ''), 'Não informado') AS professional,
        COUNT(*) AS appointments,
        SUM(a.status = 'CONFIRMADO') AS confirmedInQuark,
        SUM(a.status IN ('CANCELADO', 'CANCELADO_VIA_SMS', 'EXCLUIDO')) AS cancelledInQuark,
        SUM(a.awaitingConfirmation = 1 AND a.status = 'AGENDADO') AS awaitingResponse
      FROM QuarkAppointments a
      WHERE a.scheduledAt BETWEEN :fromDateTime AND :toDateTime
      GROUP BY professional ORDER BY appointments DESC LIMIT 30`,
      { replacements, type: QueryTypes.SELECT }
    )
  ]);
  return { eventTypes, professionals };
};

const allowedStatuses: Record<string, string> = {
  AWAITING_RESPONSE: "a.awaitingConfirmation = 1 AND a.status = 'AGENDADO'",
  CONFIRMED: "a.status = 'CONFIRMADO'",
  CANCELLED: "a.status IN ('CANCELADO', 'CANCELADO_VIA_SMS', 'EXCLUIDO')",
  SCHEDULED: "a.status = 'AGENDADO'"
};

const latestNotification = (condition: string): string =>
  `(SELECT ${condition} FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId ORDER BY n.id DESC LIMIT 1)`;

const allowedMessageStatuses: Record<string, string> = {
  NO_MESSAGE:
    "NOT EXISTS (SELECT 1 FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId)",
  QUEUED: `${latestNotification(
    "n.status"
  )} IN ('PENDING', 'PROCESSING', 'FAILED_RETRY')`,
  SENT: `${latestNotification("n.sentAt")} IS NOT NULL`,
  DELIVERED: `${latestNotification("n.deliveredAt")} IS NOT NULL`,
  READ: `${latestNotification("n.readAt")} IS NOT NULL`,
  FAILED: `${latestNotification(
    "n.status"
  )} IN ('FAILED_RETRY', 'DEAD_LETTER')`,
  REMINDER_SENT:
    "EXISTS (SELECT 1 FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId AND n.eventType IN ('REMINDER', 'MANUAL_REMINDER') AND n.status = 'SENT')"
};

const allowedResponseStatuses: Record<string, string> = {
  AWAITING: "a.awaitingConfirmation = 1 AND a.status = 'AGENDADO'",
  CONFIRMED:
    "EXISTS (SELECT 1 FROM QuarkAppointmentResponses r WHERE r.appointmentId = a.appointmentId AND r.status = 'SUCCESS' AND r.decision = 'CONFIRMED')",
  CANCELLED:
    "EXISTS (SELECT 1 FROM QuarkAppointmentResponses r WHERE r.appointmentId = a.appointmentId AND r.status = 'SUCCESS' AND r.decision = 'CANCELLED')",
  NO_RESPONSE:
    "NOT EXISTS (SELECT 1 FROM QuarkAppointmentResponses r WHERE r.appointmentId = a.appointmentId AND r.status = 'SUCCESS')"
};

const appointmentFilterClause = (filters: DashboardFilters): string => {
  const filterClauses = [
    filters.status ? allowedStatuses[filters.status] : undefined,
    filters.messageStatus
      ? allowedMessageStatuses[filters.messageStatus]
      : undefined,
    filters.responseStatus
      ? allowedResponseStatuses[filters.responseStatus]
      : undefined
  ].filter(Boolean);

  return filterClauses.length ? ` AND ${filterClauses.join(" AND ")}` : "";
};

export const getQuarkDashboardCalendarDays = async (
  filters: DashboardFilters
) => {
  const range = resolveDateRange(filters);
  const filterClause = appointmentFilterClause(filters);
  const rows = await sequelize.query<CountRow>(
    `SELECT
      DATE(a.scheduledAt) AS day,
      COUNT(*) AS total,
      SUM(a.status = 'AGENDADO' AND a.awaitingConfirmation = 0) AS scheduled,
      SUM(a.status = 'AGENDADO' AND a.awaitingConfirmation = 1) AS awaitingResponse,
      SUM(a.status = 'CONFIRMADO') AS confirmed,
      SUM(a.status IN ('CANCELADO', 'CANCELADO_VIA_SMS', 'EXCLUIDO')) AS cancelled
    FROM QuarkAppointments a
    WHERE a.scheduledAt BETWEEN :fromDateTime AND :toDateTime${filterClause}
    GROUP BY DATE(a.scheduledAt)
    ORDER BY day`,
    {
      replacements: {
        fromDateTime: range.fromDateTime,
        toDateTime: range.toDateTime
      },
      type: QueryTypes.SELECT
    }
  );

  return rows.map(row => ({
    day: String(row.day).slice(0, 10),
    total: numberValue(row.total),
    scheduled: numberValue(row.scheduled),
    awaitingResponse: numberValue(row.awaitingResponse),
    confirmed: numberValue(row.confirmed),
    cancelled: numberValue(row.cancelled)
  }));
};

export const listQuarkDashboardAppointments = async (
  filters: DashboardFilters
) => {
  const range = resolveDateRange(filters);
  const page = Math.max(1, Math.floor(filters.page || 1));
  const pageSize = Math.min(
    100,
    Math.max(10, Math.floor(filters.pageSize || 25))
  );
  const offset = (page - 1) * pageSize;
  const filterClause = appointmentFilterClause(filters);
  const replacements = {
    fromDateTime: range.fromDateTime,
    toDateTime: range.toDateTime,
    limit: pageSize,
    offset
  };

  const [rows, countRows] = await Promise.all([
    sequelize.query<CountRow>(
      `SELECT
        a.id,
        a.appointmentId,
        a.patientName AS patient,
        a.phone,
        a.phones,
        a.scheduledAt,
        a.status,
        a.awaitingConfirmation,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.snapshot, '$.profissionalNome')), ''), 'Não informado') AS professional,
        (SELECT n.eventType FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId ORDER BY n.id DESC LIMIT 1) AS lastEventType,
        (SELECT n.status FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId ORDER BY n.id DESC LIMIT 1) AS lastNotificationStatus,
        (SELECT n.sentAt FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId ORDER BY n.id DESC LIMIT 1) AS lastSentAt,
        (SELECT n.deliveredAt FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId ORDER BY n.id DESC LIMIT 1) AS lastDeliveredAt,
        (SELECT n.readAt FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId ORDER BY n.id DESC LIMIT 1) AS lastReadAt,
        (SELECT n.ticketId FROM QuarkAppointmentNotifications n WHERE n.appointmentId = a.appointmentId AND n.ticketId IS NOT NULL ORDER BY n.id DESC LIMIT 1) AS ticketId,
        EXISTS(
          SELECT 1 FROM QuarkAppointmentNotifications n
          WHERE n.appointmentId = a.appointmentId
            AND (
              n.notificationKey = CONCAT(
                'manual-reminder:',
                DATE_FORMAT(NOW(), '%Y-%m-%d'),
                ':',
                LEFT(a.scheduleFingerprint, 24)
              )
              OR n.notificationKey LIKE CONCAT(
                'manual-reminder:',
                DATE_FORMAT(NOW(), '%Y-%m-%d'),
                ':',
                LEFT(a.scheduleFingerprint, 24),
                CHAR(58),
                'to',
                CHAR(58),
                '%'
              )
            )
        ) AS manualReminderToday,
        (SELECT r.decision FROM QuarkAppointmentResponses r WHERE r.appointmentId = a.appointmentId ORDER BY r.id DESC LIMIT 1) AS lastDecision,
        (SELECT r.source FROM QuarkAppointmentResponses r WHERE r.appointmentId = a.appointmentId ORDER BY r.id DESC LIMIT 1) AS lastDecisionSource,
        (SELECT r.status FROM QuarkAppointmentResponses r WHERE r.appointmentId = a.appointmentId ORDER BY r.id DESC LIMIT 1) AS lastDecisionStatus,
        (SELECT r.receivedAt FROM QuarkAppointmentResponses r WHERE r.appointmentId = a.appointmentId ORDER BY r.id DESC LIMIT 1) AS lastResponseAt
      FROM QuarkAppointments a
      WHERE a.scheduledAt BETWEEN :fromDateTime AND :toDateTime${filterClause}
      ORDER BY a.scheduledAt ASC
      LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query<CountRow>(
      `SELECT COUNT(*) AS total FROM QuarkAppointments a
      WHERE a.scheduledAt BETWEEN :fromDateTime AND :toDateTime${filterClause}`,
      { replacements, type: QueryTypes.SELECT }
    )
  ]);
  return {
    rows: rows.map(row => ({
      ...row,
      phones: parsePhoneList(row.phones, row.phone)
    })),
    total: numberValue(countRows[0]?.total),
    page,
    pageSize
  };
};
