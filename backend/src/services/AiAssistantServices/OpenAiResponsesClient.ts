import https from "https";
import AppError from "../../errors/AppError";

export interface AssistantOutput {
  resumo: string;
  pendencias: string[];
  riscos: Array<{
    tipo: "cpf" | "consulta" | "cancelamento" | "conflito" | "privacidade" | "outro";
    nivel: "info" | "atencao" | "alto";
    descricao: string;
  }>;
  respostaSugerida: string;
  dadosRemovidos: string[];
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    resumo: { type: "string" },
    pendencias: { type: "array", items: { type: "string" } },
    riscos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tipo: { type: "string", enum: ["cpf", "consulta", "cancelamento", "conflito", "privacidade", "outro"] },
          nivel: { type: "string", enum: ["info", "atencao", "alto"] },
          descricao: { type: "string" }
        },
        required: ["tipo", "nivel", "descricao"]
      }
    },
    respostaSugerida: { type: "string" },
    dadosRemovidos: { type: "array", items: { type: "string", enum: ["cpf", "telefone", "email", "nome"] } }
  },
  required: ["resumo", "pendencias", "riscos", "respostaSugerida", "dadosRemovidos"]
};

const extractOutputText = (response: any): string | null => {
  if (typeof response?.output_text === "string") return response.output_text;
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content?.text === "string") return content.text;
    }
  }
  return null;
};

const assertOutput = (value: any): AssistantOutput => {
  if (
    !value ||
    typeof value.resumo !== "string" ||
    !Array.isArray(value.pendencias) ||
    !Array.isArray(value.riscos) ||
    typeof value.respostaSugerida !== "string" ||
    !Array.isArray(value.dadosRemovidos)
  )
    throw new AppError("ERR_AI_INVALID_RESPONSE", 502);
  return value as AssistantOutput;
};

const OpenAiResponsesClient = async ({
  input,
  safetyIdentifier
}: {
  input: string;
  safetyIdentifier: string;
}): Promise<{ output: AssistantOutput; responseId: string | null }> => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (process.env.AI_ASSISTANT_ENABLED !== "true" || !apiKey || !model)
    throw new AppError("ERR_AI_ASSISTANT_NOT_CONFIGURED", 503);

  const body = JSON.stringify({
    model,
    store: false,
    safety_identifier: safetyIdentifier,
    max_output_tokens: 1200,
    instructions:
      "Você apoia atendentes de uma clínica. Responda em português do Brasil. Resuma somente o que estiver na conversa, destaque pendências e conflitos, e sugira uma resposta cordial. Não diagnostique, não invente dados, não confirme consultas sem evidência e nunca afirme que uma mensagem foi enviada. O atendente revisará tudo antes de usar.",
    input,
    text: {
      format: {
        type: "json_schema",
        name: "squadchat_assistant",
        strict: true,
        schema
      }
    }
  });

  const raw = await new Promise<string>((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/responses",
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        },
        timeout: Number(process.env.OPENAI_TIMEOUT_MS || 45000)
      },
      response => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const value = Buffer.concat(chunks).toString("utf8");
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new AppError(response.statusCode === 429 ? "ERR_AI_RATE_LIMIT" : "ERR_AI_PROVIDER", response.statusCode === 429 ? 429 : 502));
            return;
          }
          resolve(value);
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", () => reject(new AppError("ERR_AI_PROVIDER", 502)));
    request.end(body);
  });
  let response: any;
  try {
    response = JSON.parse(raw);
  } catch {
    throw new AppError("ERR_AI_INVALID_RESPONSE", 502);
  }
  const outputText = extractOutputText(response);
  if (!outputText) throw new AppError("ERR_AI_INVALID_RESPONSE", 502);
  try {
    return { output: assertOutput(JSON.parse(outputText)), responseId: response.id || null };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("ERR_AI_INVALID_RESPONSE", 502);
  }
};

export default OpenAiResponsesClient;
