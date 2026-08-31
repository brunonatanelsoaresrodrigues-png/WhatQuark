import { EventEmitter } from "events";
import https from "https";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
  confirmQuarkAppointment,
  getQuarkPatient,
  listQuarkAppointments
} from "../../../services/QuarkClinicServices/QuarkClinicClient";

jest.mock("../../../services/MessagingServices/policy", () => ({
  assertExecution: jest.fn().mockResolvedValue(undefined)
}));

const config = {
  baseUrl: "https://api.example.test/clinic/ext",
  authToken: "fixture-auth-token",
  xChaveKey: "fixture-public-key",
  xSecretKey: "fixture-secret-key",
  requestTimeoutMs: 15000,
  maxRetryAttempts: 3
} as QuarkConfig;

interface FakeResponse {
  statusCode: number;
  body: unknown;
}

const mockHttps = (responses: FakeResponse[]) => {
  const calls: Array<{ url: URL; options: https.RequestOptions }> = [];
  const spy = jest.spyOn(https, "request").mockImplementation(((
    url: URL,
    options: https.RequestOptions,
    callback: Function
  ) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (!next) throw new Error("Missing fake HTTP response");

    const request = new EventEmitter() as any;
    request.setTimeout = jest.fn();
    request.destroy = jest.fn((error: Error) => request.emit("error", error));
    request.end = jest.fn(() => {
      const response = new EventEmitter() as any;
      response.statusCode = next.statusCode;
      response.setEncoding = jest.fn();
      callback(response);
      process.nextTick(() => {
        response.emit("data", JSON.stringify(next.body));
        response.emit("end");
      });
    });
    return request;
  }) as any);

  return { calls, spy };
};

describe("QuarkClinicClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the documented headers and returns an empty page", async () => {
    const { calls } = mockHttps([
      { statusCode: 200, body: { status: "OK", page: 0, response: [] } }
    ]);

    await expect(
      listQuarkAppointments(config, "20-08-2026", "18-09-2026")
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].options.headers).toMatchObject({
      "Auth-token": "fixture-auth-token",
      "X-Chave-Key": "fixture-public-key",
      "X-Secret-Key": "fixture-secret-key"
    });
    expect(calls[0].url.searchParams.get("data_agendamento_inicio")).toBe(
      "20-08-2026"
    );
    expect(calls[0].url.searchParams.get("page")).toBe("0");
  });

  it("reads every page until the API returns fewer than 100 records", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1
    }));
    const { calls } = mockHttps([
      {
        statusCode: 200,
        body: { status: "OK", page: 0, response: fullPage }
      },
      {
        statusCode: 200,
        body: { status: "OK", page: 1, response: [{ id: 101 }] }
      }
    ]);

    const result = await listQuarkAppointments(
      config,
      "20-08-2026",
      "18-09-2026"
    );

    expect(result).toHaveLength(101);
    expect(calls).toHaveLength(2);
    expect(calls[1].url.searchParams.get("page")).toBe("1");
  });

  it("reads a patient registration by id", async () => {
    const { calls } = mockHttps([
      {
        statusCode: 200,
        body: {
          status: "OK",
          response: [
            {
              id: 7,
              nome: "Maria da Silva",
              cpf: "529.982.247-25"
            }
          ]
        }
      }
    ]);

    await expect(getQuarkPatient(config, "7")).resolves.toEqual(
      expect.objectContaining({ id: 7, cpf: "529.982.247-25" })
    );
    expect(calls[0].url.pathname).toBe("/clinic/ext/v1/pacientes/7");
  });

  it("does not retry an authentication failure", async () => {
    const { calls } = mockHttps([
      { statusCode: 401, body: { status: "ERROR" } }
    ]);

    await expect(confirmQuarkAppointment(config, "42")).rejects.toThrow(
      "HTTP 401"
    );
    expect(calls).toHaveLength(1);
  });
  it("performs one PATCH only and reconciles a lost response with GET", async () => {
    const { calls } = mockHttps([
      {
        statusCode: 200,
        body: {
          status: "OK",
          response: [{ id: 42, statusMarcacao: "AGENDADO" }]
        }
      },
      { statusCode: 500, body: { status: "ERROR" } },
      {
        statusCode: 200,
        body: {
          status: "OK",
          response: [{ id: 42, statusMarcacao: "CONFIRMADO" }]
        }
      }
    ]);
    await expect(
      confirmQuarkAppointment(config, "42")
    ).resolves.toBeUndefined();
    expect(calls.filter(c => c.options.method === "PATCH")).toHaveLength(1);
  });
  it("keeps an uncertain PATCH blocked even if the read is still scheduled", async () => {
    const { calls } = mockHttps([
      {
        statusCode: 200,
        body: {
          status: "OK",
          response: [{ id: 42, statusMarcacao: "AGENDADO" }]
        }
      },
      { statusCode: 500, body: {} },
      {
        statusCode: 200,
        body: {
          status: "OK",
          response: [{ id: 42, statusMarcacao: "AGENDADO" }]
        }
      }
    ]);
    await expect(confirmQuarkAppointment(config, "42")).rejects.toThrow(
      "QUARK_OPERATION_OUTCOME_UNKNOWN"
    );
    expect(calls.filter(c => c.options.method === "PATCH")).toHaveLength(1);
  });
  it("rejects malformed success envelopes", async () => {
    mockHttps([{ statusCode: 200, body: { status: "OK", response: {} } }]);
    await expect(
      listQuarkAppointments(config, "01-08-2026", "02-08-2026")
    ).rejects.toThrow("QUARK_INVALID_RESPONSE");
  });
});
