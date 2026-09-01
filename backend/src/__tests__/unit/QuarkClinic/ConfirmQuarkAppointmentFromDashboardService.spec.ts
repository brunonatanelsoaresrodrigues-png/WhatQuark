import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import QuarkAppointmentResponse from "../../../models/QuarkAppointmentResponse";
import Confirm from "../../../services/QuarkClinicServices/ConfirmQuarkAppointmentFromDashboardService";
import { getQuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
  confirmQuarkAppointment,
  getQuarkAppointment
} from "../../../services/QuarkClinicServices/QuarkClinicClient";
import { buildAppointmentSnapshot } from "../../../services/QuarkClinicServices/appointmentUtils";
import {
  readState,
  writeState
} from "../../../services/MessagingServices/state";
import { assertExecution } from "../../../services/MessagingServices/policy";
jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentResponse", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn()
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  getQuarkAppointment: jest.fn(),
  confirmQuarkAppointment: jest.fn()
}));
jest.mock(
  "../../../services/QuarkClinicServices/RecordQuarkAppointmentEventService",
  () => jest.fn()
);
jest.mock("../../../services/QuarkClinicServices/dashboardEvents", () => ({
  emitQuarkDashboardUpdate: jest.fn()
}));
jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: (_: string, fn: Function) => fn(),
  readState: jest.fn(),
  writeState: jest.fn()
}));
jest.mock("../../../services/MessagingServices/policy", () => ({
  assertExecution: jest.fn()
}));
const raw = {
  id: 42,
  dataAgendamento: "21-08-2099",
  horaAgendamento: "16:00:00",
  telefoneComDDI: "5585999990000",
  statusMarcacao: "AGENDADO"
};
const config = {
  defaultCountryCode: "55",
  timezone: "America/Sao_Paulo"
} as any;
let record: any;
const auditUpdate = jest.fn();
const state = new Map();
beforeEach(() => {
  jest.resetAllMocks();
  state.clear();
  record = {
    ...buildAppointmentSnapshot(raw, config),
    id: 42,
    update: jest.fn().mockResolvedValue(undefined)
  };
  (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(record);
  (QuarkAppointmentResponse.create as jest.Mock).mockResolvedValue({
    id: 10,
    update: auditUpdate
  });
  (getQuarkConfig as jest.Mock).mockReturnValue(config);
  (getQuarkAppointment as jest.Mock).mockResolvedValue(raw);
  (readState as jest.Mock).mockImplementation(
    (key, fallback) => state.get(key) || fallback
  );
  (writeState as jest.Mock).mockImplementation((key, value) => {
    state.set(key, value);
    return Promise.resolve();
  });
});
it("audits the actor, applies once and suppresses stale notices", async () => {
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 9 })
  ).resolves.toEqual({ confirmed: true, status: "CONFIRMADO" });
  expect(QuarkAppointmentResponse.create).toHaveBeenCalledWith(
    expect.objectContaining({
      actorUserId: 9,
      source: "DASHBOARD",
      status: "PROCESSING"
    })
  );
  expect(confirmQuarkAppointment).toHaveBeenCalledWith(
    config,
    "42",
    record.phone
  );
  expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "SUPPRESSED" }),
    expect.anything()
  );
});
it("requires an authenticated actor", async () => {
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 0 })
  ).rejects.toThrow();
  expect(confirmQuarkAppointment).not.toHaveBeenCalled();
});
it("does not bypass simulation for a manual action", async () => {
  (assertExecution as jest.Mock).mockRejectedValue(
    new Error("ERR_QUARK_SIMULATION")
  );
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 9 })
  ).rejects.toThrow("ERR_QUARK_SIMULATION");
  expect(confirmQuarkAppointment).not.toHaveBeenCalled();
});
it("refuses stale remote status", async () => {
  (getQuarkAppointment as jest.Mock).mockResolvedValue({
    ...raw,
    statusMarcacao: "CONFIRMADO"
  });
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 9 })
  ).rejects.toThrow("ERR_APPOINTMENT_CHANGED");
  expect(confirmQuarkAppointment).not.toHaveBeenCalled();
});
it("blocks a second mutation after an uncertain result", async () => {
  (confirmQuarkAppointment as jest.Mock).mockRejectedValue(
    new Error("QUARK_OPERATION_OUTCOME_UNKNOWN")
  );
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 9 })
  ).rejects.toThrow("ERR_QUARK_REVIEW_REQUIRED");
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 9 })
  ).rejects.toThrow("ERR_QUARK_REVIEW_REQUIRED");
  expect(confirmQuarkAppointment).toHaveBeenCalledTimes(1);
  expect(auditUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ status: "UNKNOWN" })
  );
});
it("does not repeat a successful PATCH if local persistence fails", async () => {
  record.update
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("DB offline"));
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 9 })
  ).rejects.toThrow("DB offline");
  await expect(
    Confirm({ appointmentId: "42", actorUserId: 9 })
  ).rejects.toThrow("ERR_QUARK_REVIEW_REQUIRED");
  expect(confirmQuarkAppointment).toHaveBeenCalledTimes(1);
});

it.each([{ telefoneComDDI: "5511999991111" }, { pacienteId: 100 }])(
  "does not mutate a consultation whose recipient or patient changed remotely",
  async changed => {
    (getQuarkAppointment as jest.Mock).mockResolvedValue({
      ...raw,
      ...changed
    });
    await expect(
      Confirm({ appointmentId: "42", actorUserId: 9 })
    ).rejects.toThrow("ERR_APPOINTMENT_CHANGED");
    expect(confirmQuarkAppointment).not.toHaveBeenCalled();
  }
);
