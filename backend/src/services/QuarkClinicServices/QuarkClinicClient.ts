import https from "https";
import { URL } from "url";
import { QuarkConfig } from "./config";
import { QuarkAppointmentDto, QuarkPagedResponse } from "./types";

class QuarkHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, path: string) {
    super(`QuarkClinic API returned HTTP ${statusCode} for ${path}`);
    this.statusCode = statusCode;
  }
}

const requestJsonOnce = <T>(
  config: QuarkConfig,
  method: "GET" | "PATCH",
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> => {
  const url = new URL(`${config.baseUrl}${path}`);
  Object.keys(query).forEach(key => {
    const value = query[key];
    if (value !== undefined) url.searchParams.set(key, String(value));
  });

  return new Promise<T>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          Accept: "application/json",
          "Auth-token": config.authToken,
          "X-Chave-Key": config.xChaveKey,
          "X-Secret-Key": config.xSecretKey
        }
      },
      response => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          const statusCode = response.statusCode || 0;
          if (statusCode < 200 || statusCode >= 300) {
            reject(new QuarkHttpError(statusCode, path));
            return;
          }

          try {
            resolve(JSON.parse(body || "{}") as T);
          } catch {
            reject(
              new Error(`QuarkClinic API returned invalid JSON for ${path}`)
            );
          }
        });
      }
    );

    req.setTimeout(config.requestTimeoutMs, () => {
      req.destroy(new Error(`QuarkClinic API timed out for ${path}`));
    });
    req.on("error", reject);
    req.end();
  });
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const requestJson = async <T>(
  config: QuarkConfig,
  method: "GET" | "PATCH",
  path: string,
  query: Record<string, string | number | undefined> = {}
): Promise<T> => {
  for (let attempt = 1; attempt <= config.maxRetryAttempts; attempt += 1) {
    try {
      return await requestJsonOnce<T>(config, method, path, query);
    } catch (error) {
      const statusCode =
        error instanceof QuarkHttpError ? error.statusCode : undefined;
      const temporary =
        statusCode === undefined || statusCode === 429 || statusCode >= 500;
      if (!temporary || attempt >= config.maxRetryAttempts) throw error;

      const backoff = Math.min(30000, 1000 * 2 ** (attempt - 1));
      await wait(backoff + Math.floor(Math.random() * 1000));
    }
  }

  throw new Error(`QuarkClinic API request failed for ${path}`);
};

const assertSuccessfulResponse = <T>(
  result: QuarkPagedResponse<T>,
  operation: string
): void => {
  if (result.status && result.status !== "OK") {
    throw new Error(`QuarkClinic API failed while ${operation}`);
  }
};

export const listQuarkAppointments = async (
  config: QuarkConfig,
  startDate: string,
  endDate: string
): Promise<QuarkAppointmentDto[]> => {
  const appointments: QuarkAppointmentDto[] = [];

  for (let page = 0; page < 100; page += 1) {
    const result = await requestJson<QuarkPagedResponse<QuarkAppointmentDto>>(
      config,
      "GET",
      "/v1/agendamentos",
      {
        data_agendamento_inicio: startDate,
        data_agendamento_fim: endDate,
        page
      }
    );

    assertSuccessfulResponse(result, "listing appointments");
    const currentPage = Array.isArray(result.response) ? result.response : [];
    appointments.push(...currentPage);

    if (currentPage.length < 100) break;
  }

  return appointments;
};

export const confirmQuarkAppointment = async (
  config: QuarkConfig,
  appointmentId: string
): Promise<void> => {
  const result = await requestJson<QuarkPagedResponse<never>>(
    config,
    "PATCH",
    `/v1/agendamentos/${encodeURIComponent(appointmentId)}/confirmar`
  );
  assertSuccessfulResponse(result, "confirming an appointment");
};

export const cancelQuarkAppointment = async (
  config: QuarkConfig,
  appointmentId: string
): Promise<void> => {
  const result = await requestJson<QuarkPagedResponse<never>>(
    config,
    "PATCH",
    `/v1/agendamentos/${encodeURIComponent(appointmentId)}/cancelar`,
    { motivo: config.cancelReason }
  );
  assertSuccessfulResponse(result, "cancelling an appointment");
};
