import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import QuarkAppointmentResponse from "../../../models/QuarkAppointmentResponse";
import { ApplyQuarkDecision } from "../../../services/QuarkClinicServices/ApplyQuarkDecision";
import {
  confirmQuarkAppointment,
  getQuarkAppointment
} from "../../../services/QuarkClinicServices/QuarkClinicClient";
import { buildAppointmentSnapshot } from "../../../services/QuarkClinicServices/appointmentUtils";
import {
  readState,
  writeState
} from "../../../services/MessagingServices/state";

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
  getQuarkConfig: () => ({
    defaultCountryCode: "55",
    timezone: "America/Sao_Paulo"
  })
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  getQuarkAppointment: jest.fn(),
  confirmQuarkAppointment: jest.fn(),
  cancelQuarkAppointment: jest.fn()
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

const currentPhone = "5585992413638";
const legacyPhone = "558592413638";
const raw = {
  id: 42,
  pacienteId: 10,
  dataAgendamento: "21-08-2099",
  horaAgendamento: "16:00:00",
  telefoneComDDI: currentPhone,
  statusMarcacao: "AGENDADO"
};
const config = {
  defaultCountryCode: "55",
  timezone: "America/Sao_Paulo"
} as any;
let record: any;
const auditUpdate = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  record = {
    ...buildAppointmentSnapshot(raw, config),
    update: jest.fn().mockResolvedValue(undefined)
  };
  (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(record);
  (QuarkAppointmentResponse.create as jest.Mock).mockResolvedValue({
    id: 10,
    update: auditUpdate
  });
  (getQuarkAppointment as jest.Mock).mockResolvedValue(raw);
  (readState as jest.Mock).mockImplementation((_: string, fallback: any) =>
    Promise.resolve(fallback)
  );
  (writeState as jest.Mock).mockResolvedValue(undefined);
});

it("accepts the deterministic Brazilian ninth-digit variant", async () => {
  await expect(
    ApplyQuarkDecision({
      appointmentId: "42",
      phone: legacyPhone,
      choice: 1,
      fingerprint: record.scheduleFingerprint
    })
  ).resolves.toBeUndefined();

  expect(confirmQuarkAppointment).toHaveBeenCalledWith(
    expect.anything(),
    "42",
    legacyPhone
  );
  expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "SUPPRESSED" }),
    expect.anything()
  );
});

it("still rejects an unrelated recipient", async () => {
  await expect(
    ApplyQuarkDecision({
      appointmentId: "42",
      phone: "5585888880000",
      choice: 1,
      fingerprint: record.scheduleFingerprint
    })
  ).rejects.toThrow("ERR_APPOINTMENT_CHANGED");

  expect(getQuarkAppointment).not.toHaveBeenCalled();
  expect(confirmQuarkAppointment).not.toHaveBeenCalled();
});
