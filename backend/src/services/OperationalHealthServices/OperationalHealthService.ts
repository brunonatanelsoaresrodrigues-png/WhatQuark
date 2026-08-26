import { Op, QueryTypes } from "sequelize";
import sequelize from "../../database";
import { getRedisClient } from "../../libs/redisStore";
import { getIO } from "../../libs/socket";
import OperationalAlert, {
  OperationalAlertSeverity
} from "../../models/OperationalAlert";
import QuarkSyncState from "../../models/QuarkSyncState";
import Whatsapp from "../../models/Whatsapp";
import { isQuarkIntegrationEnabled } from "../QuarkClinicServices/config";

interface CountRow {
  [key: string]: string | number | Date | null;
}

export interface DerivedOperationalAlert {
  alertKey: string;
  category: string;
  severity: OperationalAlertSeverity;
  title: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface OperationalHealthSnapshot {
  generatedAt: string;
  uptimeSeconds: number;
  overallStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  database: { status: "UP" | "DOWN"; latencyMs: number | null };
  redis: {
    status: "UP" | "DOWN" | "DISABLED";
    latencyMs: number | null;
  };
  whatsapp: {
    configuredId: number | null;
    targetStatus: string | null;
    targetUpdatedAt: Date | null;
    connections: Array<{
      id: number;
      name: string;
      status: string;
      isDefault: boolean;
      updatedAt: Date;
    }>;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
  };
  quark: {
    enabled: boolean;
    syncStatus: string | null;
    lastSuccessfulSyncAt: Date | null;
    syncAgeSeconds: number | null;
    syncLockUntil: Date | null;
    queue: {
      pending: number;
      processing: number;
      retrying: number;
      deadLetter: number;
      suppressed: number;
      sentLastHour: number;
      stuckProcessing: number;
      oldestPendingAt: Date | null;
      lastSentAt: Date | null;
    };
    coverage: {
      upcomingScheduled: number;
      uncoveredUpcoming: number;
      cancelledWithoutNotification: number;
    };
    responses: {
      processing: number;
      stuckProcessing: number;
      failedLast24Hours: number;
      lastAppliedAt: Date | null;
    };
  };
  activeAlerts: DerivedOperationalAlert[];
}

const numberValue = (value: unknown): number => Number(value || 0);

const ageSeconds = (value: Date | string | null | undefined): number | null => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
};

const emptyQueue = {
  pending: 0,
  processing: 0,
  retrying: 0,
  deadLetter: 0,
  suppressed: 0,
  sentLastHour: 0,
  stuckProcessing: 0,
  oldestPendingAt: null as Date | null,
  lastSentAt: null as Date | null
};

const emptyCoverage = {
  upcomingScheduled: 0,
  uncoveredUpcoming: 0,
  cancelledWithoutNotification: 0
};

const emptyResponses = {
  processing: 0,
  stuckProcessing: 0,
  failedLast24Hours: 0,
  lastAppliedAt: null as Date | null
};

const configuredWhatsappId = (): number | null => {
  const value = Number(process.env.QUARK_WHATSAPP_ID);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

const databaseDetails = async () => {
  const startedAt = Date.now();
  try {
    await sequelize.authenticate();
    return { status: "UP" as const, latencyMs: Date.now() - startedAt };
  } catch {
    return { status: "DOWN" as const, latencyMs: null };
  }
};

const redisDetails = async () => {
  if (!process.env.REDIS_URL) {
    return { status: "DISABLED" as const, latencyMs: null };
  }
  const client = getRedisClient();
  if (!client) return { status: "DOWN" as const, latencyMs: null };
  const startedAt = Date.now();
  try {
    await client.ping();
    return { status: "UP" as const, latencyMs: Date.now() - startedAt };
  } catch {
    return { status: "DOWN" as const, latencyMs: null };
  }
};

export const deriveOperationalAlerts = (
  snapshot: Omit<OperationalHealthSnapshot, "overallStatus" | "activeAlerts">
): DerivedOperationalAlert[] => {
  const alerts: DerivedOperationalAlert[] = [];
  const queueWarningThreshold = Math.max(
    1,
    Number(process.env.OPERATIONAL_QUEUE_WARNING_THRESHOLD) || 500
  );
  const pollSeconds = Math.max(
    60,
    Number(process.env.QUARK_POLL_INTERVAL_SECONDS) || 300
  );
  const syncStaleSeconds = Math.max(10 * 60, pollSeconds * 3);

  if (snapshot.database.status === "DOWN") {
    alerts.push({
      alertKey: "database:unavailable",
      category: "DATABASE",
      severity: "CRITICAL",
      title: "Banco de dados indisponível",
      message: "O backend não conseguiu validar a conexão com o banco de dados."
    });
  }

  if (snapshot.redis.status === "DOWN") {
    alerts.push({
      alertKey: "redis:unavailable",
      category: "REDIS",
      severity: "WARNING",
      title: "Redis indisponível",
      message: "Sessões e cache podem operar de forma degradada."
    });
  }

  if (!snapshot.whatsapp.connections.length) {
    alerts.push({
      alertKey: "whatsapp:no-connection",
      category: "WHATSAPP",
      severity: "CRITICAL",
      title: "Nenhuma conexão de WhatsApp configurada",
      message: "A operação não possui uma conexão de WhatsApp disponível."
    });
  } else if (snapshot.whatsapp.targetStatus !== "CONNECTED") {
    alerts.push({
      alertKey: `whatsapp:${snapshot.whatsapp.configuredId || "default"}:offline`,
      category: "WHATSAPP",
      severity: "CRITICAL",
      title: "WhatsApp desconectado",
      message: `A conexão usada pelo Quark está em estado ${
        snapshot.whatsapp.targetStatus || "DESCONHECIDO"
      }. A fila permanece protegida e pausada.`,
      details: {
        whatsappId: snapshot.whatsapp.configuredId,
        status: snapshot.whatsapp.targetStatus,
        updatedAt: snapshot.whatsapp.targetUpdatedAt
      }
    });
  }

  if (snapshot.quark.enabled) {
    if (!snapshot.quark.lastSuccessfulSyncAt) {
      alerts.push({
        alertKey: "quark:sync-never-completed",
        category: "QUARK",
        severity: "CRITICAL",
        title: "Sincronização do Quark ainda não concluída",
        message: "Não existe registro de uma sincronização concluída com sucesso."
      });
    } else if (
      snapshot.quark.syncAgeSeconds !== null &&
      snapshot.quark.syncAgeSeconds > syncStaleSeconds
    ) {
      alerts.push({
        alertKey: "quark:sync-stale",
        category: "QUARK",
        severity: "CRITICAL",
        title: "Sincronização do Quark atrasada",
        message: `A última sincronização ocorreu há ${Math.floor(
          snapshot.quark.syncAgeSeconds / 60
        )} minutos.`,
        details: {
          lastSuccessfulSyncAt: snapshot.quark.lastSuccessfulSyncAt,
          expectedMaximumSeconds: syncStaleSeconds
        }
      });
    }
  }

  if (snapshot.quark.queue.stuckProcessing > 0) {
    alerts.push({
      alertKey: "quark:queue-stuck",
      category: "QUEUE",
      severity: "CRITICAL",
      title: "Notificações presas em processamento",
      message: `${snapshot.quark.queue.stuckProcessing} notificação(ões) ultrapassaram o tempo máximo de processamento.`
    });
  }

  if (snapshot.quark.queue.deadLetter > 0) {
    alerts.push({
      alertKey: "quark:dead-letter",
      category: "QUEUE",
      severity:
        snapshot.quark.queue.deadLetter > 20 ? "CRITICAL" : "WARNING",
      title: "Notificações em retenção",
      message: `${snapshot.quark.queue.deadLetter} notificação(ões) precisam de análise ou recuperação seletiva.`
    });
  }

  if (
    snapshot.quark.queue.pending + snapshot.quark.queue.retrying >=
    queueWarningThreshold
  ) {
    alerts.push({
      alertKey: "quark:queue-backlog",
      category: "QUEUE",
      severity: "WARNING",
      title: "Fila de notificações acumulada",
      message: `${
        snapshot.quark.queue.pending + snapshot.quark.queue.retrying
      } notificações aguardam processamento controlado.`,
      details: { warningThreshold: queueWarningThreshold }
    });
  }

  if (snapshot.quark.coverage.uncoveredUpcoming > 0) {
    alerts.push({
      alertKey: "quark:appointments-uncovered",
      category: "COVERAGE",
      severity: "CRITICAL",
      title: "Consultas futuras sem cobertura",
      message: `${snapshot.quark.coverage.uncoveredUpcoming} consulta(s) agendada(s) não possuem notificação válida na fila ou já enviada.`
    });
  }

  if (snapshot.quark.coverage.cancelledWithoutNotification > 0) {
    alerts.push({
      alertKey: "quark:cancellations-uncovered",
      category: "COVERAGE",
      severity: "CRITICAL",
      title: "Cancelamentos sem notificação",
      message: `${snapshot.quark.coverage.cancelledWithoutNotification} cancelamento(s) recente(s) não possuem aviso correspondente.`
    });
  }

  if (snapshot.quark.responses.stuckProcessing > 0) {
    alerts.push({
      alertKey: "quark:responses-stuck",
      category: "CONFIRMATION",
      severity: "CRITICAL",
      title: "Respostas não concluídas no Quark",
      message: `${snapshot.quark.responses.stuckProcessing} resposta(s) permanecem em processamento por mais de dois minutos.`
    });
  }

  if (snapshot.quark.responses.failedLast24Hours > 0) {
    alerts.push({
      alertKey: "quark:responses-failed",
      category: "CONFIRMATION",
      severity: "WARNING",
      title: "Falhas recentes de confirmação",
      message: `${snapshot.quark.responses.failedLast24Hours} resposta(s) falharam nas últimas 24 horas e serão reconciliadas conforme a política de segurança.`
    });
  }

  return alerts;
};

export const collectOperationalHealth = async (): Promise<
  OperationalHealthSnapshot
> => {
  const [database, redis] = await Promise.all([
    databaseDetails(),
    redisDetails()
  ]);
  const base = {
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database,
    redis,
    whatsapp: {
      configuredId: configuredWhatsappId(),
      targetStatus: null as string | null,
      targetUpdatedAt: null as Date | null,
      connections: [] as OperationalHealthSnapshot["whatsapp"]["connections"],
      lastInboundAt: null as Date | null,
      lastOutboundAt: null as Date | null
    },
    quark: {
      enabled: isQuarkIntegrationEnabled(),
      syncStatus: null as string | null,
      lastSuccessfulSyncAt: null as Date | null,
      syncAgeSeconds: null as number | null,
      syncLockUntil: null as Date | null,
      queue: { ...emptyQueue },
      coverage: { ...emptyCoverage },
      responses: { ...emptyResponses }
    }
  };

  if (database.status === "UP") {
    const [connections, sync, queueRows, coverageRows, responseRows, messageRows] =
      await Promise.all([
        Whatsapp.findAll({
          attributes: ["id", "name", "status", "isDefault", "updatedAt"],
          order: [["id", "ASC"]]
        }),
        QuarkSyncState.findByPk("appointments"),
        sequelize.query<CountRow>(
          `SELECT
            SUM(status = 'PENDING') AS pending,
            SUM(status = 'PROCESSING') AS processing,
            SUM(status = 'FAILED_RETRY') AS retrying,
            SUM(
              n.status = 'DEAD_LETTER'
              AND (
                (
                  n.eventType = 'CANCELLED'
                  AND EXISTS (
                    SELECT 1 FROM QuarkAppointments a
                    WHERE a.appointmentId = n.appointmentId
                      AND a.status IN ('CANCELADO', 'CANCELADO_VIA_SMS', 'EXCLUIDO')
                  )
                  AND EXISTS (
                    SELECT 1 FROM QuarkAppointmentEvents e
                    WHERE e.appointmentId = n.appointmentId
                      AND e.eventType = 'CANCELLED'
                      AND e.source = 'QUARK_EXTERNAL'
                      AND e.occurredAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM QuarkAppointmentNotifications x
                    WHERE x.appointmentId = n.appointmentId
                      AND x.id <> n.id
                      AND x.eventType = 'CANCELLED'
                      AND x.status IN ('PENDING', 'PROCESSING', 'FAILED_RETRY', 'SENT')
                  )
                )
                OR (
                  n.eventType <> 'CANCELLED'
                  AND EXISTS (
                    SELECT 1 FROM QuarkAppointments a
                    WHERE a.appointmentId = n.appointmentId
                      AND a.status = 'AGENDADO'
                      AND a.scheduledAt > NOW()
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM QuarkAppointmentNotifications x
                    WHERE x.appointmentId = n.appointmentId
                      AND x.id <> n.id
                      AND x.status IN ('PENDING', 'PROCESSING', 'FAILED_RETRY', 'SENT')
                  )
                )
              )
            ) AS deadLetter,
            SUM(status = 'SUPPRESSED') AS suppressed,
            SUM(status = 'SENT' AND sentAt >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) AS sentLastHour,
            SUM(status = 'PROCESSING' AND processingStartedAt < DATE_SUB(NOW(), INTERVAL 10 MINUTE)) AS stuckProcessing,
            MIN(CASE WHEN status IN ('PENDING', 'FAILED_RETRY') THEN createdAt END) AS oldestPendingAt,
            MAX(sentAt) AS lastSentAt
          FROM QuarkAppointmentNotifications n`,
          { type: QueryTypes.SELECT }
        ),
        sequelize.query<CountRow>(
          `SELECT
            SUM(a.status = 'AGENDADO' AND a.scheduledAt BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)) AS upcomingScheduled,
            SUM(
              a.status = 'AGENDADO'
              AND a.scheduledAt BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
              AND NOT EXISTS (
                SELECT 1 FROM QuarkAppointmentNotifications n
                WHERE n.appointmentId = a.appointmentId
                  AND n.status IN ('PENDING', 'PROCESSING', 'FAILED_RETRY', 'SENT')
              )
            ) AS uncoveredUpcoming,
            SUM(
              a.status IN ('CANCELADO', 'CANCELADO_VIA_SMS', 'EXCLUIDO')
              AND EXISTS (
                SELECT 1 FROM QuarkAppointmentEvents e
                WHERE e.appointmentId = a.appointmentId
                  AND e.eventType = 'CANCELLED'
                  AND e.source = 'QUARK_EXTERNAL'
                  AND e.occurredAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
              )
              AND NOT EXISTS (
                SELECT 1 FROM QuarkAppointmentNotifications n
                WHERE n.appointmentId = a.appointmentId
                  AND n.eventType = 'CANCELLED'
                  AND n.status IN ('PENDING', 'PROCESSING', 'FAILED_RETRY', 'SENT')
              )
            ) AS cancelledWithoutNotification
          FROM QuarkAppointments a`,
          { type: QueryTypes.SELECT }
        ),
        sequelize.query<CountRow>(
          `SELECT
            SUM(status = 'PROCESSING') AS processing,
            SUM(status = 'PROCESSING' AND receivedAt < DATE_SUB(NOW(), INTERVAL 2 MINUTE)) AS stuckProcessing,
            SUM(status = 'FAILED' AND receivedAt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS failedLast24Hours,
            MAX(appliedAt) AS lastAppliedAt
          FROM QuarkAppointmentResponses`,
          { type: QueryTypes.SELECT }
        ),
        sequelize.query<CountRow>(
          `SELECT
            MAX(CASE WHEN fromMe = 0 THEN createdAt END) AS lastInboundAt,
            MAX(CASE WHEN fromMe = 1 THEN createdAt END) AS lastOutboundAt
          FROM Messages`,
          { type: QueryTypes.SELECT }
        )
      ]);

    base.whatsapp.connections = connections.map(item => ({
      id: item.id,
      name: item.name,
      status: item.status,
      isDefault: Boolean(item.isDefault),
      updatedAt: item.updatedAt
    }));
    const target = base.whatsapp.configuredId
      ? connections.find(item => item.id === base.whatsapp.configuredId)
      : connections.find(item => item.isDefault) || connections[0];
    base.whatsapp.configuredId = target?.id || base.whatsapp.configuredId;
    base.whatsapp.targetStatus = target?.status || null;
    base.whatsapp.targetUpdatedAt = target?.updatedAt || null;

    if (sync) {
      base.quark.syncStatus = sync.status;
      base.quark.lastSuccessfulSyncAt = sync.lastSuccessfulSyncAt;
      base.quark.syncAgeSeconds = ageSeconds(sync.lastSuccessfulSyncAt);
      base.quark.syncLockUntil = sync.syncLockUntil;
    }

    const queue = queueRows[0] || {};
    base.quark.queue = {
      pending: numberValue(queue.pending),
      processing: numberValue(queue.processing),
      retrying: numberValue(queue.retrying),
      deadLetter: numberValue(queue.deadLetter),
      suppressed: numberValue(queue.suppressed),
      sentLastHour: numberValue(queue.sentLastHour),
      stuckProcessing: numberValue(queue.stuckProcessing),
      oldestPendingAt: queue.oldestPendingAt
        ? new Date(queue.oldestPendingAt)
        : null,
      lastSentAt: queue.lastSentAt ? new Date(queue.lastSentAt) : null
    };
    const coverage = coverageRows[0] || {};
    base.quark.coverage = {
      upcomingScheduled: numberValue(coverage.upcomingScheduled),
      uncoveredUpcoming: numberValue(coverage.uncoveredUpcoming),
      cancelledWithoutNotification: numberValue(
        coverage.cancelledWithoutNotification
      )
    };
    const responses = responseRows[0] || {};
    base.quark.responses = {
      processing: numberValue(responses.processing),
      stuckProcessing: numberValue(responses.stuckProcessing),
      failedLast24Hours: numberValue(responses.failedLast24Hours),
      lastAppliedAt: responses.lastAppliedAt
        ? new Date(responses.lastAppliedAt)
        : null
    };
    const messages = messageRows[0] || {};
    base.whatsapp.lastInboundAt = messages.lastInboundAt
      ? new Date(messages.lastInboundAt)
      : null;
    base.whatsapp.lastOutboundAt = messages.lastOutboundAt
      ? new Date(messages.lastOutboundAt)
      : null;
  }

  const activeAlerts = deriveOperationalAlerts(base);
  return {
    ...base,
    overallStatus: activeAlerts.some(item => item.severity === "CRITICAL")
      ? "CRITICAL"
      : activeAlerts.some(item => item.severity === "WARNING")
      ? "DEGRADED"
      : "HEALTHY",
    activeAlerts
  };
};

export const synchronizeOperationalAlerts = async (
  snapshot: OperationalHealthSnapshot
): Promise<void> => {
  if (snapshot.database.status !== "UP") return;
  const now = new Date();
  const activeKeys = snapshot.activeAlerts.map(item => item.alertKey);

  for (const definition of snapshot.activeAlerts) {
    const [record, created] = await OperationalAlert.findOrCreate({
      where: { alertKey: definition.alertKey },
      defaults: {
        ...definition,
        status: "OPEN",
        details: definition.details
          ? JSON.stringify(definition.details)
          : null,
        firstDetectedAt: now,
        lastDetectedAt: now,
        acknowledgedAt: null,
        acknowledgedByUserId: null,
        resolvedAt: null
      }
    });
    if (!created) {
      await record.update({
        category: definition.category,
        severity: definition.severity,
        title: definition.title,
        message: definition.message,
        details: definition.details
          ? JSON.stringify(definition.details)
          : null,
        lastDetectedAt: now,
        ...(record.status === "RESOLVED"
          ? {
              status: "OPEN",
              firstDetectedAt: now,
              acknowledgedAt: null,
              acknowledgedByUserId: null,
              resolvedAt: null
            }
          : {})
      });
    }
  }

  await OperationalAlert.update(
    { status: "RESOLVED", resolvedAt: now },
    {
      where: {
        status: { [Op.in]: ["OPEN", "ACKNOWLEDGED"] },
        ...(activeKeys.length ? { alertKey: { [Op.notIn]: activeKeys } } : {})
      }
    }
  );

  try {
    getIO().emit("operationalHealth", {
      overallStatus: snapshot.overallStatus,
      occurredAt: now.toISOString()
    });
  } catch {
    // O monitor nunca pode interromper a operação por causa do socket.
  }
};

export const getOperationalHealthOverview = async () => {
  const snapshot = await collectOperationalHealth();
  await synchronizeOperationalAlerts(snapshot).catch(() => undefined);
  const alerts =
    snapshot.database.status === "UP"
      ? await OperationalAlert.findAll({
          where: { status: { [Op.in]: ["OPEN", "ACKNOWLEDGED"] } },
          order: [
            ["severity", "ASC"],
            ["lastDetectedAt", "DESC"]
          ],
          limit: 100
        })
      : [];
  return { ...snapshot, alerts };
};

export const acknowledgeOperationalAlert = async (
  id: number,
  userId: number
) => {
  const alert = await OperationalAlert.findByPk(id);
  if (!alert) return null;
  if (alert.status === "RESOLVED") return alert;
  await alert.update({
    status: "ACKNOWLEDGED",
    acknowledgedAt: new Date(),
    acknowledgedByUserId: userId
  });
  return alert;
};

export const operationalReadiness = async () => {
  const [database, redis] = await Promise.all([
    databaseDetails(),
    redisDetails()
  ]);
  const ready =
    database.status === "UP" &&
    (redis.status === "UP" || redis.status === "DISABLED");
  return { ready, database, redis };
};
