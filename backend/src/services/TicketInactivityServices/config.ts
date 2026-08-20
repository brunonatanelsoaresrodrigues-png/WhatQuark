export const INACTIVITY_CLOSE_REASON =
  "Sem retorno do paciente — 15 minutos";

export const DEFAULT_INACTIVITY_MESSAGE = `Olá! 😊

Como não tivemos seu retorno nos últimos *15 minutos*, este atendimento será encerrado automaticamente.

Mas fique tranquilo(a): se ainda precisar de ajuda, basta enviar uma nova mensagem e retomaremos seu atendimento.

Se você estava realizando um agendamento, o horário somente estará confirmado caso tenha recebido a mensagem *“Consulta agendada com sucesso”*.

A *Essencial Saúde* permanece à disposição. 💚`;

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export interface TicketInactivityConfig {
  enabled: boolean;
  timeoutMinutes: number;
  pollIntervalSeconds: number;
  claimTimeoutMinutes: number;
  sendIntervalMinSeconds: number;
  sendIntervalMaxSeconds: number;
  message: string;
}

export const getTicketInactivityConfig = (): TicketInactivityConfig => {
  const sendIntervalMinSeconds = positiveInteger(
    process.env.TICKET_INACTIVITY_SEND_INTERVAL_MIN_SECONDS,
    15
  );
  const configuredMax = positiveInteger(
    process.env.TICKET_INACTIVITY_SEND_INTERVAL_MAX_SECONDS,
    45
  );

  return {
    enabled: process.env.TICKET_INACTIVITY_ENABLED === "true",
    timeoutMinutes: positiveInteger(
      process.env.TICKET_INACTIVITY_TIMEOUT_MINUTES,
      15
    ),
    pollIntervalSeconds: positiveInteger(
      process.env.TICKET_INACTIVITY_POLL_INTERVAL_SECONDS,
      30
    ),
    claimTimeoutMinutes: positiveInteger(
      process.env.TICKET_INACTIVITY_CLAIM_TIMEOUT_MINUTES,
      5
    ),
    sendIntervalMinSeconds,
    sendIntervalMaxSeconds: Math.max(sendIntervalMinSeconds, configuredMax),
    message:
      process.env.TICKET_INACTIVITY_MESSAGE || DEFAULT_INACTIVITY_MESSAGE
  };
};
