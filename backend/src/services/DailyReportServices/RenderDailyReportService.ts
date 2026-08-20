import { DailyReportSnapshot } from "./DailyReportMetricsService";

const formatDateTime = (value: string, timezone: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const formatDuration = (seconds: unknown): string => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "sem amostra";
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return minutes
    ? `${minutes}m${String(remainder).padStart(2, "0")}s`
    : `${remainder}s`;
};

const RenderDailyReportService = (
  snapshot: DailyReportSnapshot,
  timezone: string
): string => {
  const a = snapshot.attendance;
  const m = snapshot.messages;
  const q = snapshot.appointments;
  const alerts = snapshot.alerts;
  const agentLines = snapshot.agents.length
    ? snapshot.agents.map(
        agent =>
          `${agent.name}: ${agent.tickets} atend. | ${
            agent.messages
          } mensagens | ${
            agent.resolved
          } resolvidos | resposta mediana ${formatDuration(
            agent.medianFirstResponseSeconds
          )}`
      )
    : ["Sem mensagens humanas atribuídas no período."];
  const warningLines = snapshot.dataQuality.warnings.length
    ? snapshot.dataQuality.warnings.map(warning => `⚠️ ${warning}`)
    : ["✅ Dados disponíveis sem ressalvas de auditoria."];

  return `📊 *ESSENCIAL SAÚDE — FECHAMENTO DIÁRIO*
📅 Período: ${formatDateTime(
    snapshot.periodStart,
    timezone
  )} → ${formatDateTime(snapshot.periodEnd, timezone)}
🕐 Gerado em: ${formatDateTime(snapshot.generatedAt, timezone)}
🔄 QuarkClinic atualizado: ${
    alerts.quarkLastSuccessfulSyncAt
      ? formatDateTime(String(alerts.quarkLastSuccessfulSyncAt), timezone)
      : "sem registro"
  }

*💬 ATENDIMENTO*
Novos contatos: ${a.newContacts}
Novas conversas: ${a.newConversations}
Atendimentos movimentados: ${a.moved}
Conversas reabertas: ${a.reopened}
Resolvidos: ${a.resolved}
Encerrados por inatividade: ${a.closedByInactivity}
Em atendimento agora: ${a.openNow}
Aguardando na fila: ${a.pendingNow}
Sem atendente responsável: ${a.unassignedNow}
Aguardando resposta do paciente: ${a.waitingPatientNow}
Transferências: ${a.transferred}
Taxa de resolução: ${a.resolutionRate}%
Maior movimento: ${a.busiestHour}

*✉️ MENSAGENS*
Recebidas dos pacientes: ${m.received}
Enviadas por atendentes: ${m.human}
Enviadas pelo bot/sistema: ${Number(m.bot) + Number(m.system)}
Automáticas do QuarkClinic: ${m.quark}
Encerramentos por inatividade: ${m.inactivity}
Áudios recebidos: ${m.audiosReceived}
Imagens/documentos recebidos: ${m.mediaReceived}
Falhas: ${m.failed}
Média por atendimento: ${m.averagePerConversation}

*📅 AGENDA E QUARKCLINIC*
Novos agendamentos: ${q.created}
Confirmados: ${q.confirmed}
Remarcados: ${q.rescheduled}
Outras alterações: ${q.updated}
Cancelados: ${q.cancelled}
Aguardando confirmação: ${q.awaitingConfirmation}
Confirmações pelo WhatsApp: ${q.confirmedViaWhatsapp}
Cancelamentos pelo WhatsApp: ${q.cancelledViaWhatsapp}
Mensagens enviadas: ${q.notificationsSent}
Entregues: ${q.notificationsDelivered}
Lidas: ${q.notificationsRead}
Falhas definitivas: ${q.notificationFailures}
Agenda prevista para amanhã: ${q.tomorrow}
Amanhã sem confirmação: ${q.tomorrowUnconfirmed}

*👩‍💻 POR ATENDENTE*
${agentLines.join("\n")}

*⚠️ PONTOS DE ATENÇÃO*
WhatsApps conectados: ${alerts.connectedWhatsapps}
Notificações aguardando envio: ${alerts.queuedNotifications}
Notificações em processamento: ${alerts.processingNotifications}
Falhas definitivas: ${alerts.deadLetters}
Telefones inválidos na agenda: ${alerts.invalidPhones}
Tickets sem atendente: ${alerts.unassignedTickets}
Consultas de amanhã sem confirmação: ${alerts.tomorrowUnconfirmed}

${warningLines.join("\n")}

_Relatório automático da Essencial Saúde. Dados agregados, sem identificação de pacientes._`;
};

export default RenderDailyReportService;
