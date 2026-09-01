import { promises as fs } from "fs";
import { Op } from "sequelize";
import sequelize from "../../database";
import { getRedisClient } from "../../libs/redisStore";
import { getIO } from "../../libs/socket";
import AiSuggestion from "../../models/AiSuggestion";
import ContactIdentityIssue from "../../models/ContactIdentityIssue";
import DailyReportRun from "../../models/DailyReportRun";
import OperationalIncident from "../../models/OperationalIncident";
import OutboundMessage from "../../models/OutboundMessage";
import QuarkSyncState from "../../models/QuarkSyncState";
import Whatsapp from "../../models/Whatsapp";

type CheckStatus = "OK" | "WARNING" | "CRITICAL" | "UNKNOWN";

interface HealthCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  checkedAt: Date;
  data?: unknown;
}

const ageMinutes = (value?: Date | string | null): number | null => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? Math.max(0, Math.round((Date.now() - timestamp) / 60000))
    : null;
};

const hostHealth = async (): Promise<HealthCheck> => {
  const checkedAt = new Date();
  const path = process.env.HOST_HEALTH_FILE;
  if (!path) {
    return {
      key: "backup",
      label: "Último backup",
      status: "UNKNOWN",
      detail: "Monitor de backup ainda não configurado no host.",
      checkedAt
    };
  }
  try {
    const raw = await fs.readFile(path, "utf8");
    const data = JSON.parse(raw) as { completedAt?: string; verified?: boolean; sizeBytes?: number };
    const minutes = ageMinutes(data.completedAt);
    const status: CheckStatus =
      data.verified && minutes !== null && minutes <= 36 * 60
        ? "OK"
        : minutes !== null && minutes <= 48 * 60
        ? "WARNING"
        : "CRITICAL";
    return {
      key: "backup",
      label: "Último backup",
      status,
      detail: data.verified
        ? `Backup verificado há ${minutes ?? "?"} min.`
        : "O último backup não foi verificado.",
      checkedAt,
      data
    };
  } catch {
    return {
      key: "backup",
      label: "Último backup",
      status: "CRITICAL",
      detail: "Não foi possível ler o comprovante do último backup.",
      checkedAt
    };
  }
};

const syncIncidents = async (checks: HealthCheck[]): Promise<void> => {
  const now = new Date();
  const activeKeys: string[] = [];
  for (const check of checks) {
    if (check.status !== "WARNING" && check.status !== "CRITICAL") continue;
    const incidentKey = `health:${check.key}`;
    activeKeys.push(incidentKey);
    const existing = await OperationalIncident.findOne({ where: { incidentKey } });
    const values = {
      status: "OPEN",
      severity: check.status,
      title: check.label,
      detail: check.detail,
      lastSeenAt: now,
      resolvedAt: null
    };
    if (existing)
      await existing.update({
        ...values,
        status: existing.status === "ACKNOWLEDGED" ? "ACKNOWLEDGED" : "OPEN"
      });
    else
      await OperationalIncident.create({
        incidentKey,
        ...values,
        startedAt: now,
        acknowledgedAt: null,
        acknowledgedByUserId: null
      });
  }
  await OperationalIncident.update(
    { status: "RESOLVED", resolvedAt: now },
    {
      where: {
        status: { [Op.in]: ["OPEN", "ACKNOWLEDGED"] },
        incidentKey: {
          [Op.and]: [
            { [Op.like]: "health:%" },
            { [Op.notIn]: activeKeys.length ? activeKeys : [""] }
          ]
        }
      }
    }
  );
};

const GetOperationalHealthService = async (persist = true) => {
  const now = new Date();
  const checks: HealthCheck[] = [];

  const dbStarted = Date.now();
  try {
    await sequelize.authenticate();
    checks.push({
      key: "database",
      label: "Banco de dados",
      status: "OK",
      detail: `Respondendo em ${Date.now() - dbStarted} ms.`,
      checkedAt: now
    });
  } catch {
    checks.push({ key: "database", label: "Banco de dados", status: "CRITICAL", detail: "Sem resposta do banco de dados.", checkedAt: now });
  }

  const redis = getRedisClient();
  if (!process.env.REDIS_URL) {
    checks.push({ key: "redis", label: "Redis", status: "UNKNOWN", detail: "Redis não configurado.", checkedAt: now });
  } else {
    try {
      const started = Date.now();
      if (!redis) throw new Error("not initialized");
      await redis.ping();
      checks.push({ key: "redis", label: "Redis", status: "OK", detail: `Respondendo em ${Date.now() - started} ms.`, checkedAt: now });
    } catch {
      checks.push({ key: "redis", label: "Redis", status: "CRITICAL", detail: "Redis configurado, mas indisponível.", checkedAt: now });
    }
  }

  const whatsapps = await Whatsapp.findAll({ attributes: ["id", "name", "status", "updatedAt"] });
  const connected = whatsapps.filter(item => item.status === "CONNECTED");
  checks.push({
    key: "whatsapp",
    label: "Canais WhatsApp",
    status: connected.length === whatsapps.length && connected.length > 0 ? "OK" : connected.length > 0 ? "WARNING" : "CRITICAL",
    detail: `${connected.length}/${whatsapps.length} canal(is) conectado(s).`,
    checkedAt: now,
    data: whatsapps.map(item => ({ id: item.id, name: item.name, status: item.status, updatedAt: item.updatedAt }))
  });

  const quark = await QuarkSyncState.findOne({ order: [["lastSuccessfulSyncAt", "DESC"]] });
  const quarkAge = ageMinutes(quark?.lastSuccessfulSyncAt);
  checks.push({
    key: "quark",
    label: "Sincronização Quark",
    status: quarkAge === null ? "WARNING" : quarkAge <= 20 ? "OK" : quarkAge <= 60 ? "WARNING" : "CRITICAL",
    detail: quarkAge === null ? "Ainda não há sincronização bem-sucedida registrada." : `Último sucesso há ${quarkAge} min.`,
    checkedAt: now,
    data: quark ? { status: quark.status, lastSuccessfulSyncAt: quark.lastSuccessfulSyncAt } : null
  });

  const [identityOpen, outboundFailed, latestReport, suggestionCount, backup] = await Promise.all([
    ContactIdentityIssue.count({ where: { status: "OPEN" } }),
    OutboundMessage.count({ where: { status: { [Op.in]: ["FAILED", "UNKNOWN", "BLOCKED"] } } }),
    DailyReportRun.findOne({ order: [["createdAt", "DESC"]] }),
    AiSuggestion.count({ where: { createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    hostHealth()
  ]);

  checks.push({
    key: "identity",
    label: "Identidade de pacientes",
    status: identityOpen > 50 ? "WARNING" : "OK",
    detail: `${identityOpen} contato(s) aguardando revisão.`,
    checkedAt: now,
    data: { open: identityOpen }
  });
  checks.push({
    key: "outbound",
    label: "Mensagens com falha",
    status: outboundFailed > 0 ? "WARNING" : "OK",
    detail: `${outboundFailed} envio(s) bloqueado(s), desconhecido(s) ou com falha.`,
    checkedAt: now,
    data: { failed: outboundFailed }
  });
  checks.push({
    key: "reports",
    label: "Relatórios diários",
    status: latestReport?.status === "FAILED" ? "WARNING" : latestReport ? "OK" : "UNKNOWN",
    detail: latestReport ? `Última execução: ${latestReport.status}.` : "Nenhuma execução registrada.",
    checkedAt: now,
    data: latestReport ? { status: latestReport.status, createdAt: latestReport.createdAt, completedAt: latestReport.completedAt } : null
  });
  checks.push(backup);

  if (persist) await syncIncidents(checks);
  const incidents = await OperationalIncident.findAll({
    where: { status: { [Op.in]: ["OPEN", "ACKNOWLEDGED"] } },
    order: [["severity", "ASC"], ["startedAt", "DESC"]]
  });
  const status: CheckStatus = checks.some(item => item.status === "CRITICAL")
    ? "CRITICAL"
    : checks.some(item => item.status === "WARNING")
    ? "WARNING"
    : "OK";
  const result = {
    status,
    checkedAt: now,
    checks,
    incidents,
    features: {
      identityCenter: process.env.IDENTITY_CENTER_ENABLED !== "false",
      aiAssistant: process.env.AI_ASSISTANT_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
      aiSuggestionsLast24h: suggestionCount
    }
  };
  if (persist) {
    try {
      getIO().to("admin").emit("operationsHealth", result);
    } catch {
      // Socket.IO may not be initialized in CLI jobs and tests.
    }
  }
  return result;
};

export default GetOperationalHealthService;
