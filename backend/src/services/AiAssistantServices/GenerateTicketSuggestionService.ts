import crypto from "crypto";
import Message from "../../models/Message";
import AiSuggestion from "../../models/AiSuggestion";
import Ticket from "../../models/Ticket";
import redactSensitiveText from "./redactSensitiveText";
import OpenAiResponsesClient from "./OpenAiResponsesClient";

const hash = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const GenerateTicketSuggestionService = async ({
  ticket,
  userId
}: {
  ticket: Ticket;
  userId: number;
}) => {
  const messages = await Message.findAll({
    where: { ticketId: ticket.id, isDeleted: false },
    attributes: ["body", "fromMe", "createdAt"],
    order: [["createdAt", "DESC"]],
    limit: 40
  });
  const removed = new Set<string>();
  const lines = messages.reverse().map(message => {
    const redacted = redactSensitiveText(message.body, ticket.contact?.name);
    redacted.removed.forEach(item => removed.add(item));
    return `${message.fromMe ? "ATENDENTE" : "PACIENTE"}: ${redacted.text}`;
  });
  const input = [
    "Analise esta conversa clínica já anonimizada.",
    `Situação do atendimento: ${ticket.status}.`,
    ...lines,
    `Categorias removidas antes do processamento: ${Array.from(removed).join(", ") || "nenhuma"}.`
  ].join("\n");
  const inputHash = hash(input);
  const safetyIdentifier = hash(`squadchat-user:${userId}`);
  const { output, responseId } = await OpenAiResponsesClient({ input, safetyIdentifier });
  output.dadosRemovidos = Array.from(new Set([...output.dadosRemovidos, ...Array.from(removed)]));
  const suggestion = await AiSuggestion.create({
    ticketId: ticket.id,
    generatedByUserId: userId,
    model: process.env.OPENAI_MODEL!,
    promptVersion: "2026-08-31-v1",
    inputHash,
    output: JSON.stringify({ ...output, responseId }),
    status: "GENERATED",
    reviewedByUserId: null,
    reviewedOutputHash: null,
    copiedAt: null,
    discardedAt: null
  });
  return { id: suggestion.id, ...output, createdAt: suggestion.createdAt };
};

export default GenerateTicketSuggestionService;
