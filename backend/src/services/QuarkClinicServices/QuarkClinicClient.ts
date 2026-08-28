/* eslint-disable no-await-in-loop */
import https from "https";
import { URL } from "url";
import { assertNotShuttingDown } from "../../utils/shutdownState";
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
import { assertExecution } from "../MessagingServices/policy";

export class QuarkHttpError extends Error {
  statusCode: number;
  retryAfterMs: number;

  constructor(statusCode: number, path: string, retryAfter = "") {
    super(`QuarkClinic API returned HTTP ${statusCode} for ${path}`);
    this.statusCode = statusCode;
    const seconds = Number(retryAfter);
    this.retryAfterMs =
      Math.max(
        0,
        Number.isFinite(seconds)
          ? seconds * 1000
          : Date.parse(retryAfter) - Date.now()
      ) || 0;
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
  assertNotShuttingDown();
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
          if (body.length + String(chunk).length > 10 * 1024 * 1024) {
            req.destroy(new Error("QUARK_RESPONSE_TOO_LARGE"));
            return;
          }
          body += chunk;
        });
        response.on("end", () => {
          const statusCode = response.statusCode || 0;
          if (statusCode < 200 || statusCode >= 300) {
            reject(
              new QuarkHttpError(
                statusCode,
                path,
                String(response.headers?.["retry-after"] || "")
              )
            );
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
      if (error instanceof Error && error.message === "ERR_SHUTTING_DOWN")
        throw error;
      const statusCode =
        error instanceof QuarkHttpError ? error.statusCode : undefined;
      // POST may have been applied even when the response was lost. Retrying it
      // here could create duplicate patients or appointments; the intake
      // booking ledger performs a recovery check before an explicit retry.
      const temporary =
        statusCode === undefined || statusCode === 429 || statusCode >= 500;
      if (method !== "GET" || !temporary || attempt >= config.maxRetryAttempts)
        throw error;

      const backoff = Math.min(30000, 1000 * 2 ** (attempt - 1));
      const retryAfter =
        error instanceof QuarkHttpError ? error.retryAfterMs : 0;
      if (retryAfter > 30000) throw error;
      await wait(Math.max(backoff, retryAfter));
    }
  }

  throw new Error(`QuarkClinic API request failed for ${path}`);
};

const assertSuccessfulResponse = <T>(
  result: QuarkPagedResponse<T>,
  operation: string
): void => {
  if (!result || result.status !== "OK") {
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
    if (!Array.isArray(result.response))
      throw new Error("QUARK_INVALID_RESPONSE");
    const currentPage = result.response;
    appointments.push(...currentPage);

    if (currentPage.length < 100) break;
    if (page === 99) throw new Error("QUARK_PAGINATION_LIMIT_REACHED");
  }

  return appointments;
};

export const getQuarkAppointment = async (
  config: QuarkConfig,
  appointmentId: string
): Promise<QuarkAppointmentDto> => {
  const result = await requestJson<QuarkPagedResponse<QuarkAppointmentDto>>(
    config,
    "GET",
    `/v1/agendamentos/${encodeURIComponent(appointmentId)}`
  );
  assertSuccessfulResponse(result, "reading appointment");
  if (!Array.isArray(result.response))
    throw new Error("QUARK_INVALID_RESPONSE");
  const appointment = result.response.find(
    item => String(item.id) === appointmentId
  );
  if (!appointment) throw new Error("QUARK_APPOINTMENT_NOT_FOUND");
  return appointment;
};

const applyStatus = async (
  config: QuarkConfig,
  appointmentId: string,
  desired: "CONFIRMADO" | "CANCELADO",
  phone?: string
): Promise<void> => {
  await assertExecution(phone, true);
  const before = await getQuarkAppointment(config, appointmentId);
  if (before.statusMarcacao === desired) return;
  if (before.statusMarcacao !== "AGENDADO")
    throw new Error("QUARK_APPOINTMENT_STATE_CHANGED");
  await assertExecution(phone, true);
  try {
    const result = await enqueueRequest(async () => {
      await assertExecution(phone, true);
      return requestJsonOnce<QuarkPagedResponse<never>>(
        config,
        "PATCH",
        `/v1/agendamentos/${encodeURIComponent(appointmentId)}/${
          desired === "CONFIRMADO" ? "confirmar" : "cancelar"
        }`,
        desired === "CANCELADO" ? { motivo: config.cancelReason } : {}
      );
    });
    assertSuccessfulResponse(result, "applying appointment decision");
  } catch (error) {
    try {
      const after = await getQuarkAppointment(config, appointmentId);
      if (after.statusMarcacao === desired) return;
    } catch (_) {
      /* An unavailable read must not authorize a repeated PATCH. */
    }
    if (
      error instanceof QuarkHttpError &&
      error.statusCode >= 400 &&
      error.statusCode < 500 &&
      error.statusCode !== 408
    )
      throw error;
    throw new Error("QUARK_OPERATION_OUTCOME_UNKNOWN");
  }
};
export const confirmQuarkAppointment = (
  config: QuarkConfig,
  appointmentId: string,
  phone?: string
) => applyStatus(config, appointmentId, "CONFIRMADO", phone);
export const cancelQuarkAppointment = (
  config: QuarkConfig,
  appointmentId: string,
  phone?: string
) => applyStatus(config, appointmentId, "CANCELADO", phone);

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
): Promise<number> => {
  await assertExecution(
    patient.telefone?.replace(/\D/g, "").replace(/^(?=\d{10,11}$)/, "55"),
    true
  );
  return numericApiId(
    await requestJson<unknown>(config, "POST", "/v1/pacientes", {}, patient),
    "creating a patient"
  );
};

export const createQuarkAppointment = async (
  config: QuarkConfig,
  appointment: CreateQuarkAppointmentRequest
): Promise<number> => {
  await assertExecution(
    appointment.telefonePaciente
      ?.replace(/\D/g, "")
      .replace(/^(?=\d{10,11}$)/, "55"),
    true
  );
  return numericApiId(
    await requestJson<unknown>(
      config,
      "POST",
      "/v1/agendamentos",
      {},
      appointment
    ),
    "creating an appointment"
  );
};
