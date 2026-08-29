import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import {
  clinicDay,
  clinicTimezone,
  dateParts
} from "../QuarkClinicServices/clinicTime";

interface Request {
  requesterUserId: string | number;
  queueId?: number;
  assigneeId?: number;
  now?: Date;
}

interface DashboardViewer {
  id: number | string;
  profile: string;
  canViewOtherAgentsTickets?: boolean;
  queues: Array<{ id: number }>;
}

interface Filters {
  queueId?: number;
  assigneeId?: number;
}

interface WaitRow {
  id: number;
  queueId: number | null;
  queueName: string | null;
  waitStartedAt: Date | string;
}

interface DurationRow {
  agentId: number | null;
  agentName: string | null;
  occurredAt: Date | string;
  seconds: number | string | null;
}

const numberValue = (value: unknown): number => Number(value || 0);

const queryRows = async <T>(
  sql: string,
  replacements: Record<string, unknown>
): Promise<T[]> =>
  (await sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT
  })) as T[];

const queryOne = async (
  sql: string,
  replacements: Record<string, unknown>
): Promise<Record<string, unknown>> =>
  (await queryRows<Record<string, unknown>>(sql, replacements))[0] || {};

export const buildOperationalWhere = (
  viewer: DashboardViewer,
  filters: Filters,
  alias = "t"
): { sql: string; replacements: Record<string, unknown> } => {
  const clauses = [
    `${alias}.ticketType='PATIENT'`,
    `${alias}.isGroup=0`
  ];
  const replacements: Record<string, unknown> = {};
  const viewerQueues = viewer.queues.map(queue => Number(queue.id));
  const canViewOthers =
    viewer.profile === "admin" || viewer.canViewOtherAgentsTickets === true;

  if (viewer.profile !== "admin") {
    clauses.push(
      viewerQueues.length
        ? `(${alias}.queueId IN (:viewerQueueIds) OR ${alias}.queueId IS NULL)`
        : `${alias}.queueId IS NULL`
    );
    if (viewerQueues.length) replacements.viewerQueueIds = viewerQueues;
    if (!canViewOthers) {
      clauses.push(
        `(${alias}.userId=:viewerId OR ${alias}.status='pending')`
      );
      replacements.viewerId = Number(viewer.id);
    }
  }

  if (filters.queueId) {
    if (
      viewer.profile !== "admin" &&
      !viewerQueues.includes(filters.queueId)
    )
      throw new AppError("ERR_NO_PERMISSION", 403);
    clauses.push(`${alias}.queueId=:dashboardQueueId`);
    replacements.dashboardQueueId = filters.queueId;
  }

  if (filters.assigneeId) {
    if (!canViewOthers && filters.assigneeId !== Number(viewer.id))
      throw new AppError("ERR_NO_PERMISSION", 403);
    clauses.push(`${alias}.userId=:dashboardAssigneeId`);
    replacements.dashboardAssigneeId = filters.assigneeId;
  }

  return { sql: clauses.join(" AND "), replacements };
};

export const summarizeWaits = (
  rows: WaitRow[],
  now: Date,
  slaSeconds: number
) => {
  const waits = rows.map(row => ({
    ...row,
    seconds: Math.max(
      0,
      Math.floor((now.getTime() - new Date(row.waitStartedAt).getTime()) / 1000)
    )
  }));
  const total = waits.reduce((sum, row) => sum + row.seconds, 0);
  return {
    maximumSeconds: waits.reduce(
      (maximum, row) => Math.max(maximum, row.seconds),
      0
    ),
    averageSeconds: waits.length ? Math.round(total / waits.length) : 0,
    aboveSla: waits.filter(row => row.seconds > slaSeconds).length,
    rows: waits
  };
};

const average = (values: number[]): number | null =>
  values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;

const valuesForPeriod = (
  rows: DurationRow[],
  start: Date,
  end: Date
): number[] =>
  rows
    .filter(row => {
      const value = new Date(row.occurredAt).getTime();
      return value >= start.getTime() && value < end.getTime();
    })
    .map(row => Number(row.seconds))
    .filter(value => Number.isFinite(value) && value >= 0);

const percentChange = (current: number, previous: number): number | null => {
  if (!previous) return current ? null : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const OperationalDashboardService = async ({
  requesterUserId,
  queueId,
  assigneeId,
  now = new Date()
}: Request) => {
  const viewer = await ShowUserService(requesterUserId);
  const filters = { queueId, assigneeId };
  const access = buildOperationalWhere(viewer, filters);
  const timezone = clinicTimezone();
  const periodStart = clinicDay(now);
  const periodEnd = clinicDay(periodStart, 1);
  const previousStart = clinicDay(periodStart, -1);
  const slaMinutes = Math.max(
    1,
    Number(process.env.DASHBOARD_SLA_MINUTES || 5)
  );
  const slaSeconds = slaMinutes * 60;
  const replacements = {
    ...access.replacements,
    periodStart,
    periodEnd,
    previousStart
  };

  const [
    current,
    waitRows,
    entries,
    resolved,
    acceptanceRows,
    serviceRows,
    hourlyEntries,
    hourlyResolved,
    queueDemand,
    activeAgents
  ] = await Promise.all([
    queryOne(
      `SELECT
         SUM(t.status='pending') AS waiting,
         SUM(t.status='open') AS active,
         SUM(t.status IN ('open','pending') AND t.unreadMessages > 0) AS unread,
         SUM(t.status IN ('open','pending') AND t.userId IS NULL) AS unassigned
       FROM Tickets t
       WHERE ${access.sql}`,
      replacements
    ),
    queryRows<WaitRow>(
      `SELECT t.id,t.queueId,q.name AS queueName,
         COALESCE((
           SELECT MAX(e.occurredAt)
           FROM TicketEvents e
           WHERE e.ticketId=t.id
             AND e.eventType IN ('CREATED','REOPENED','RETURNED_TO_QUEUE')
         ),t.createdAt) AS waitStartedAt
       FROM Tickets t
       LEFT JOIN Queues q ON q.id=t.queueId
       WHERE ${access.sql} AND t.status='pending'`,
      replacements
    ),
    queryOne(
      `SELECT
         SUM(t.createdAt >= :periodStart AND t.createdAt < :periodEnd) AS current,
         SUM(t.createdAt >= :previousStart AND t.createdAt < :periodStart) AS previous
       FROM Tickets t
       WHERE ${access.sql}
         AND t.createdAt >= :previousStart AND t.createdAt < :periodEnd`,
      replacements
    ),
    queryOne(
      `SELECT
         COUNT(DISTINCT CASE WHEN e.occurredAt >= :periodStart AND e.occurredAt < :periodEnd THEN e.ticketId END) AS current,
         COUNT(DISTINCT CASE WHEN e.occurredAt >= :previousStart AND e.occurredAt < :periodStart THEN e.ticketId END) AS previous
       FROM TicketEvents e
       INNER JOIN Tickets t ON t.id=e.ticketId
       WHERE ${access.sql}
         AND e.eventType IN ('CLOSED_BY_USER','CLOSED_BY_INACTIVITY')
         AND e.occurredAt >= :previousStart AND e.occurredAt < :periodEnd`,
      replacements
    ),
    queryRows<DurationRow>(
      `SELECT e.performedByUserId AS agentId,u.name AS agentName,e.occurredAt,
         GREATEST(0,TIMESTAMPDIFF(SECOND,
           COALESCE((
             SELECT MAX(qe.occurredAt)
             FROM TicketEvents qe
             WHERE qe.ticketId=e.ticketId
               AND qe.eventType IN ('CREATED','REOPENED','RETURNED_TO_QUEUE')
               AND qe.occurredAt <= e.occurredAt
           ),t.createdAt),e.occurredAt)) AS seconds
       FROM TicketEvents e
       INNER JOIN Tickets t ON t.id=e.ticketId
       LEFT JOIN Users u ON u.id=e.performedByUserId
       WHERE ${access.sql} AND e.eventType='ACCEPTED'
         AND e.occurredAt >= :previousStart AND e.occurredAt < :periodEnd`,
      replacements
    ),
    queryRows<DurationRow>(
      `SELECT e.performedByUserId AS agentId,u.name AS agentName,e.occurredAt,
         TIMESTAMPDIFF(SECOND,(
           SELECT MAX(ae.occurredAt)
           FROM TicketEvents ae
           WHERE ae.ticketId=e.ticketId
             AND ae.eventType='ACCEPTED'
             AND ae.occurredAt <= e.occurredAt
         ),e.occurredAt) AS seconds
       FROM TicketEvents e
       INNER JOIN Tickets t ON t.id=e.ticketId
       LEFT JOIN Users u ON u.id=e.performedByUserId
       WHERE ${access.sql}
         AND e.eventType IN ('CLOSED_BY_USER','CLOSED_BY_INACTIVITY')
         AND e.occurredAt >= :previousStart AND e.occurredAt < :periodEnd`,
      replacements
    ),
    queryRows<{ createdAt: Date | string }>(
      `SELECT t.createdAt
       FROM Tickets t
       WHERE ${access.sql}
         AND t.createdAt >= :periodStart AND t.createdAt < :periodEnd`,
      replacements
    ),
    queryRows<{ occurredAt: Date | string }>(
      `SELECT e.occurredAt
       FROM TicketEvents e
       INNER JOIN Tickets t ON t.id=e.ticketId
       WHERE ${access.sql}
         AND e.eventType IN ('CLOSED_BY_USER','CLOSED_BY_INACTIVITY')
         AND e.occurredAt >= :periodStart AND e.occurredAt < :periodEnd`,
      replacements
    ),
    queryRows<{ queueId: number | null; queueName: string | null; total: unknown }>(
      `SELECT t.queueId,q.name AS queueName,COUNT(*) AS total
       FROM Tickets t
       LEFT JOIN Queues q ON q.id=t.queueId
       WHERE ${access.sql} AND t.status IN ('open','pending')
       GROUP BY t.queueId,q.name
       ORDER BY total DESC`,
      replacements
    ),
    queryRows<{ agentId: number; agentName: string; total: unknown }>(
      `SELECT t.userId AS agentId,u.name AS agentName,COUNT(*) AS total
       FROM Tickets t
       INNER JOIN Users u ON u.id=t.userId
       WHERE ${access.sql} AND t.status='open' AND t.userId IS NOT NULL
       GROUP BY t.userId,u.name`,
      replacements
    )
  ]);

  const waits = summarizeWaits(waitRows, now, slaSeconds);
  const entriesToday = numberValue(entries.current);
  const entriesPrevious = numberValue(entries.previous);
  const resolvedToday = numberValue(resolved.current);
  const resolvedPrevious = numberValue(resolved.previous);
  const acceptedToday = valuesForPeriod(
    acceptanceRows,
    periodStart,
    periodEnd
  );
  const acceptedPrevious = valuesForPeriod(
    acceptanceRows,
    previousStart,
    periodStart
  );
  const serviceToday = valuesForPeriod(serviceRows, periodStart, periodEnd);
  const servicePrevious = valuesForPeriod(
    serviceRows,
    previousStart,
    periodStart
  );
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    time: `${String(hour).padStart(2, "0")}:00`,
    entries: 0,
    resolved: 0
  }));
  hourlyEntries.forEach(row => {
    hourly[dateParts(new Date(row.createdAt)).hour].entries += 1;
  });
  hourlyResolved.forEach(row => {
    hourly[dateParts(new Date(row.occurredAt)).hour].resolved += 1;
  });

  const agents = new Map<
    number,
    {
      id: number;
      name: string;
      active: number;
      resolved: number;
      waits: number[];
      services: number[];
    }
  >();
  const ensureAgent = (id: number, name: string | null) => {
    if (!agents.has(id))
      agents.set(id, {
        id,
        name: name || `Atendente ${id}`,
        active: 0,
        resolved: 0,
        waits: [],
        services: []
      });
    return agents.get(id)!;
  };
  activeAgents.forEach(row => {
    ensureAgent(Number(row.agentId), row.agentName).active = numberValue(
      row.total
    );
  });
  acceptanceRows
    .filter(
      row =>
        row.agentId &&
        new Date(row.occurredAt).getTime() >= periodStart.getTime()
    )
    .forEach(row => {
      const seconds = Number(row.seconds);
      if (Number.isFinite(seconds) && seconds >= 0)
        ensureAgent(Number(row.agentId), row.agentName).waits.push(seconds);
    });
  serviceRows
    .filter(
      row =>
        row.agentId &&
        new Date(row.occurredAt).getTime() >= periodStart.getTime()
    )
    .forEach(row => {
      const agent = ensureAgent(Number(row.agentId), row.agentName);
      agent.resolved += 1;
      const seconds = Number(row.seconds);
      if (Number.isFinite(seconds) && seconds >= 0)
        agent.services.push(seconds);
    });

  const peak = hourly.reduce(
    (result, row) => (row.entries > result.entries ? row : result),
    hourly[0]
  );
  const averageWaitToday = average(acceptedToday);
  const averageWaitPrevious = average(acceptedPrevious);
  const averageServiceToday = average(serviceToday);
  const averageServicePrevious = average(servicePrevious);
  const resolutionRate = entriesToday
    ? Number(Math.min(100, (resolvedToday / entriesToday) * 100).toFixed(1))
    : resolvedToday
    ? 100
    : 0;
  const previousResolutionRate = entriesPrevious
    ? Number(
        Math.min(100, (resolvedPrevious / entriesPrevious) * 100).toFixed(1)
      )
    : resolvedPrevious
    ? 100
    : 0;

  return {
    generatedAt: now.toISOString(),
    timezone,
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      label: "Hoje"
    },
    slaMinutes,
    now: {
      waiting: numberValue(current.waiting),
      active: numberValue(current.active),
      unread: numberValue(current.unread),
      unassigned: numberValue(current.unassigned),
      maximumWaitSeconds: waits.maximumSeconds,
      averageWaitSeconds: waits.averageSeconds,
      aboveSla: waits.aboveSla
    },
    today: {
      entries: entriesToday,
      resolved: resolvedToday,
      averageWaitSeconds: averageWaitToday,
      averageServiceSeconds: averageServiceToday,
      resolutionRate
    },
    comparison: {
      entriesPercent: percentChange(entriesToday, entriesPrevious),
      resolvedPercent: percentChange(resolvedToday, resolvedPrevious),
      averageWaitSeconds:
        averageWaitToday === null || averageWaitPrevious === null
          ? null
          : averageWaitToday - averageWaitPrevious,
      averageServiceSeconds:
        averageServiceToday === null || averageServicePrevious === null
          ? null
          : averageServiceToday - averageServicePrevious,
      resolutionPoints: Number(
        (resolutionRate - previousResolutionRate).toFixed(1)
      )
    },
    flow: hourly,
    attention: {
      highestDemandQueue: queueDemand.length
        ? {
            id: queueDemand[0].queueId,
            name: queueDemand[0].queueName || "Sem fila",
            total: numberValue(queueDemand[0].total)
          }
        : null,
      peakHour: peak.entries ? peak.time : null,
      peakEntries: peak.entries
    },
    agents: Array.from(agents.values())
      .map(agent => {
        const agentWait = average(agent.waits);
        return {
          id: agent.id,
          name: agent.name,
          active: agent.active,
          resolved: agent.resolved,
          averageWaitSeconds: agentWait,
          averageServiceSeconds: average(agent.services),
          status:
            agentWait === null
              ? "NO_DATA"
              : agentWait > slaSeconds
              ? "ATTENTION"
              : "WITHIN_SLA"
        };
      })
      .sort(
        (left, right) =>
          right.active - left.active ||
          right.resolved - left.resolved ||
          left.name.localeCompare(right.name)
      )
  };
};

export default OperationalDashboardService;
