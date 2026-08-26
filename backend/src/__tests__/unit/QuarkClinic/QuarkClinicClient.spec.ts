import { EventEmitter } from "events";
import https from "https";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
  createQuarkAppointment,
  confirmQuarkAppointment,
  listQuarkAgendas,
  listQuarkAppointments,
  listQuarkFreeSlots,
  listQuarkProfessionals
} from "../../../services/QuarkClinicServices/QuarkClinicClient";

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
  const writes: string[] = [];
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
    request.write = jest.fn((value: string) => writes.push(value));
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

  return { calls, writes, spy };
};

describe("QuarkClinicClient", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the documented headers and returns an empty page", async () => {
    const { calls } = mockHttps([
      { statusCode: 200, body: { status: "OK", page: 0, response: [] } },
      { statusCode: 200, body: { status: "OK", page: 0, response: [] } }
    ]);

    await expect(
      listQuarkAppointments(config, "20-08-2026", "18-09-2026")
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
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

  it("reads every page until the API returns an empty page", async () => {
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
      },
      {
        statusCode: 200,
        body: { status: "OK", page: 2, response: [] }
      },
      {
        statusCode: 200,
        body: { status: "OK", page: 3, response: [] }
      }
    ]);

    const result = await listQuarkAppointments(
      config,
      "20-08-2026",
      "18-09-2026"
    );

    expect(result).toHaveLength(101);
    expect(calls).toHaveLength(4);
    expect(calls[1].url.searchParams.get("page")).toBe("1");
    expect(calls[2].url.searchParams.get("page")).toBe("2");
    expect(calls[3].url.searchParams.get("page")).toBe("3");
  });

  it("continues after short and duplicate pages and deduplicates appointments", async () => {
    const { calls } = mockHttps([
      {
        statusCode: 200,
        body: { status: "OK", page: 0, response: [{ id: 1 }, { id: 2 }] }
      },
      {
        statusCode: 200,
        body: { status: "OK", page: 1, response: [{ id: 1 }, { id: 2 }] }
      },
      {
        statusCode: 200,
        body: { status: "OK", page: 2, response: [{ id: 3 }] }
      },
      {
        statusCode: 200,
        body: { status: "OK", page: 3, response: [] }
      },
      {
        statusCode: 200,
        body: { status: "OK", page: 4, response: [] }
      }
    ]);

    await expect(
      listQuarkAppointments(config, "25-08-2026", "23-09-2026")
    ).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(calls).toHaveLength(5);
    expect(calls[3].url.searchParams.get("page")).toBe("3");
    expect(calls[4].url.searchParams.get("page")).toBe("4");
  });

  it("continues after one transient empty page", async () => {
    const { calls } = mockHttps([
      {
        statusCode: 200,
        body: { status: "OK", page: 0, response: [{ id: 1 }] }
      },
      { statusCode: 200, body: { status: "OK", page: 1, response: [] } },
      {
        statusCode: 200,
        body: { status: "OK", page: 2, response: [{ id: 2 }] }
      },
      { statusCode: 200, body: { status: "OK", page: 3, response: [] } },
      { statusCode: 200, body: { status: "OK", page: 4, response: [] } }
    ]);

    await expect(
      listQuarkAppointments(config, "25-08-2026", "23-09-2026")
    ).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(calls).toHaveLength(5);
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

  it("serializes concurrent calls made with the same Quark credentials", async () => {
    const responses: any[] = [];
    const spy = jest.spyOn(https, "request").mockImplementation(((
      _url: URL,
      _options: https.RequestOptions,
      callback: Function
    ) => {
      const request = new EventEmitter() as any;
      request.setTimeout = jest.fn();
      request.destroy = jest.fn((error: Error) => request.emit("error", error));
      request.end = jest.fn(() => {
        const response = new EventEmitter() as any;
        response.statusCode = 200;
        response.setEncoding = jest.fn();
        responses.push(response);
        callback(response);
      });
      return request;
    }) as any);

    const professionals = listQuarkProfessionals(config);
    const agendas = listQuarkAgendas(config);
    await new Promise(resolve => setImmediate(resolve));

    expect(spy).toHaveBeenCalledTimes(1);
    responses[0].emit("data", JSON.stringify({ status: "OK", response: [] }));
    responses[0].emit("end");
    await new Promise(resolve => setImmediate(resolve));

    expect(spy).toHaveBeenCalledTimes(2);
    responses[1].emit("data", JSON.stringify({ status: "OK", response: [] }));
    responses[1].emit("end");
    await expect(Promise.all([professionals, agendas])).resolves.toEqual([
      [],
      []
    ]);
  });

  it("lists professionals and free slots from the documented endpoints", async () => {
    const { calls } = mockHttps([
      {
        statusCode: 200,
        body: { status: "OK", response: [{ id: 7, nome: "Dra. Maria" }] }
      },
      {
        statusCode: 200,
        body: [
          {
            data: "26/08/2026",
            horarios: [{ intervalo: "09:00 - 09:30", status: "LIVRE" }]
          }
        ]
      }
    ]);

    await expect(listQuarkProfessionals(config)).resolves.toHaveLength(1);
    await expect(
      listQuarkFreeSlots(config, 123, "26-08-2026")
    ).resolves.toHaveLength(1);
    expect(calls[0].url.pathname).toContain("/v1/profissionais");
    expect(calls[1].url.pathname).toContain("/v1/agendas/123/horarios-livres");
    expect(calls[1].url.searchParams.get("data")).toBe("26-08-2026");
  });

  it("sends an appointment as JSON and returns the Quark id", async () => {
    const { calls, writes } = mockHttps([{ statusCode: 200, body: 987 }]);

    await expect(
      createQuarkAppointment(config, {
        agendaId: 123,
        data: "26/08/2026",
        hora: "09:00",
        nomePaciente: "Maria da Silva",
        pacienteId: 456,
        telefonePaciente: "(85) 99999-0000"
      })
    ).resolves.toBe(987);
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.headers).toMatchObject({
      "Content-Type": "application/json"
    });
    expect(JSON.parse(writes[0])).toMatchObject({
      agendaId: 123,
      hora: "09:00"
    });
  });
});
