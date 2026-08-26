/* eslint-disable no-await-in-loop */
import https from "https";
import { URL } from "url";
import { QuarkConfig } from "./config";
import {
  CreateQuarkAppointmentRequest,
  CreateQuarkPatientRequest,
  QuarkAgendaDto,
  QuarkAppointmentDto,
  QuarkFreeSlotDayDto,
  QuarkPagedResponse,
  QuarkPatientDto,
  QuarkProfessionalDto
} from "./types";

export class QuarkHttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, path: string) {
    super(`QuarkClinic API returned HTTP ${statusCode} for ${path}`);
    this.statusCode = statusCode;
  }
}

// The Quark API invalidates one of two requests made at the same time with the
// same credentials. Keep a process-wide queue so the appointment synchronizer,
// dashboard and patient intake never race each other for the same API key.
let requestQueue: Promise<void> = Promise.resolve();

const enqueueRequest = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = requestQueue.then(operation, operation);
  requestQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

const requestJsonOnce = <T>(
  config: QuarkConfig,
  method: "GET" | "PATCH" | "POST",
  path: string,
  query: Record<string, string | number | undefined> = {},
  payload?: unknown
): Promise<T> => {
  const url = new URL(`${config.baseUrl}${path}`);
  Object.keys(query).forEach(key => {
    const value = query[key];
    if (value !== undefined) url.searchParams.set(key, String(value));
  });

  return new Promise<T>((resolve, reject) => {
    const serializedPayload =
      payload === undefined ? undefined : JSON.stringify(payload);
    const req = https.request(
      url,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(serializedPayload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(serializedPayload)
              }
            : {}),
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
    if (serializedPayload) req.write(serializedPayload);
    req.end();
  });
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const requestJson = async <T>(
  config: QuarkConfig,
  method: "GET" | "PATCH" | "POST",
  path: string,
  query: Record<string, string | number | undefined> = {},
  payload?: unknown
): Promise<T> => {
  for (let attempt = 1; attempt <= config.maxRetryAttempts; attempt += 1) {
    try {
      return await enqueueRequest(() =>
        requestJsonOnce<T>(config, method, path, query, payload)
      );
    } catch (error) {
      const statusCode =
        error instanceof QuarkHttpError ? error.statusCode : undefined;
      // POST may have been applied even when the response was lost. Retrying it
      // here could create duplicate patients or appointments; the intake
      // booking ledger performs a recovery check before an explicit retry.
      const temporary =
        method !== "POST" &&
        (statusCode === undefined || statusCode === 429 || statusCode >= 500);
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

const listPaged = async <T>(
  config: QuarkConfig,
  path: string,
  operation: string
): Promise<T[]> => {
  const values: T[] = [];
  for (let page = 0; page < 100; page += 1) {
    const result = await requestJson<QuarkPagedResponse<T>>(
      config,
      "GET",
      path,
      { page }
    );
    assertSuccessfulResponse(result, operation);
    const currentPage = Array.isArray(result.response) ? result.response : [];
    values.push(...currentPage);
    if (currentPage.length < 100) break;
  }
  return values;
};

export const listQuarkAppointments = async (
  config: QuarkConfig,
  startDate: string,
  endDate: string
): Promise<QuarkAppointmentDto[]> => {
  const appointmentsById = new Map<string, QuarkAppointmentDto>();
  let consecutiveEmptyPages = 0;

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
    currentPage.forEach(appointment => {
      if (appointment.id !== undefined && appointment.id !== null) {
        appointmentsById.set(String(appointment.id), appointment);
      }
    });

    // Quark pages are one-based but also accept page=0, making pages 0 and 1
    // duplicates. More importantly, intermediate pages may contain fewer than
    // 100 records while later pages still exist. Require two consecutive empty
    // pages so a transient empty response cannot silently truncate the window.
    if (currentPage.length === 0) {
      consecutiveEmptyPages += 1;
      if (consecutiveEmptyPages >= 2) {
        return Array.from(appointmentsById.values());
      }
    } else {
      consecutiveEmptyPages = 0;
    }
  }

  throw new Error(
    `QuarkClinic appointment pagination exceeded 100 pages for ${startDate} - ${endDate}`
  );
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

export const listQuarkProfessionals = (
  config: QuarkConfig
): Promise<QuarkProfessionalDto[]> =>
  listPaged<QuarkProfessionalDto>(
    config,
    "/v1/profissionais",
    "listing professionals"
  );

export const listQuarkAgendas = (
  config: QuarkConfig
): Promise<QuarkAgendaDto[]> =>
  listPaged<QuarkAgendaDto>(config, "/v1/agendas", "listing agendas");

export const listQuarkFreeSlots = async (
  config: QuarkConfig,
  agendaId: number | string,
  date: string
): Promise<QuarkFreeSlotDayDto[]> => {
  const result = await requestJson<QuarkFreeSlotDayDto[]>(
    config,
    "GET",
    `/v1/agendas/${encodeURIComponent(String(agendaId))}/horarios-livres`,
    { data: date }
  );
  return Array.isArray(result) ? result : [];
};

const extractPatient = (value: unknown): QuarkPatientDto | null => {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return extractPatient(value[0]);
  const object = value as Record<string, unknown>;
  if (object.id !== undefined) {
    return object as unknown as QuarkPatientDto;
  }
  if (object.response !== undefined) return extractPatient(object.response);
  return null;
};

export const findQuarkPatientByCpf = async (
  config: QuarkConfig,
  cpf: string
): Promise<QuarkPatientDto | null> => {
  try {
    const result = await requestJson<unknown>(
      config,
      "GET",
      "/v1/pacientes/existe",
      { cpf }
    );
    return extractPatient(result);
  } catch (error) {
    if (error instanceof QuarkHttpError && error.statusCode === 404)
      return null;
    throw error;
  }
};

const numericApiId = (result: unknown, operation: string): number => {
  const direct = Number(result);
  if (Number.isInteger(direct) && direct > 0) return direct;
  if (result && typeof result === "object") {
    const object = result as Record<string, unknown>;
    const nested = Number(object.id || object.response);
    if (Number.isInteger(nested) && nested > 0) return nested;
  }
  throw new Error(`QuarkClinic API returned no id while ${operation}`);
};

export const createQuarkPatient = async (
  config: QuarkConfig,
  patient: CreateQuarkPatientRequest
): Promise<number> =>
  numericApiId(
    await requestJson<unknown>(config, "POST", "/v1/pacientes", {}, patient),
    "creating a patient"
  );

export const createQuarkAppointment = async (
  config: QuarkConfig,
  appointment: CreateQuarkAppointmentRequest
): Promise<number> =>
  numericApiId(
    await requestJson<unknown>(
      config,
      "POST",
      "/v1/agendamentos",
      {},
      appointment
    ),
    "creating an appointment"
  );
