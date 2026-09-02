import Ticket from "../../../models/Ticket";
import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentRecipient from "../../../models/QuarkAppointmentRecipient";
import Handle from "../../../services/QuarkClinicServices/HandleQuarkConfirmationReply";
import Send from "../../../services/WbotServices/SendWhatsAppMessage";
import { ApplyQuarkDecision } from "../../../services/QuarkClinicServices/ApplyQuarkDecision";
import { appointmentReference } from "../../../services/QuarkClinicServices/appointmentUtils";
import { Op } from "sequelize";
import {
  readState,
  writeState
} from "../../../services/MessagingServices/state";
import { assertExecution } from "../../../services/MessagingServices/policy";
jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentRecipient", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);
jest.mock("../../../services/QuarkClinicServices/ApplyQuarkDecision", () => ({
  ApplyQuarkDecision: jest.fn()
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  isQuarkIntegrationEnabled: () => true,
  getQuarkConfig: () => ({ whatsappId: 1 })
}));
jest.mock("../../../services/MessagingServices/policy", () => ({
  assertExecution: jest.fn()
}));
jest.mock("../../../services/MessagingServices/state", () => ({
  readState: jest.fn(),
  writeState: jest.fn()
}));
const phone = "5585999990000";
const record = {
  appointmentId: "42",
  scheduleFingerprint: "a".repeat(64),
  scheduledAt: new Date("2099-08-21T19:00:00Z"),
  status: "AGENDADO"
};
const reference = appointmentReference("42", record.scheduleFingerprint, phone);
const ticket = { id: 1, status: "pending", userId: null } as unknown as Ticket;
const call = (body: string, overrides = {}) =>
  Handle({ body, phone, whatsappId: 1, ticket, messageId: body, ...overrides });
const state = new Map();
beforeEach(() => {
  jest.resetAllMocks();
  state.clear();
  (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record]);
  (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([]);
  (Send as jest.Mock).mockResolvedValue({ id: "reply" });
  (readState as jest.Mock).mockImplementation(
    (key, fallback) => state.get(key) || fallback
  );
  (writeState as jest.Mock).mockImplementation((key, value) => {
    state.set(key, value);
    return Promise.resolve();
  });
});
it.each([
  "2 pessoas",
  "Não quero cancelar",
  "Não sei o endereço",
  "Sim, preciso remarcar"
])("does not act on ambiguous text: %s", async body => {
  expect(await call(body)).toBe(false);
  expect(ApplyQuarkDecision).not.toHaveBeenCalled();
});
it.each(["CONFIRMAR", "SIM", "1"])(
  "confirms a single pending appointment with the simple answer %s",
  async body => {
    expect(await call(body)).toBe(true);
    expect(ApplyQuarkDecision).toHaveBeenCalledWith({
      appointmentId: "42",
      phone,
      choice: 1,
      fingerprint: record.scheduleFingerprint
    });
  }
);
it.each(["CANCELAR", "NÃO", "2"])(
  "cancels a single pending appointment with the simple answer %s",
  async body => {
    expect(await call(body)).toBe(true);
    expect(ApplyQuarkDecision).toHaveBeenCalledWith({
      appointmentId: "42",
      phone,
      choice: 2,
      fingerprint: record.scheduleFingerprint
    });
  }
);
it("confirms only an explicit current reference", async () => {
  await call(`CONFIRMAR ${reference}`);
  expect(ApplyQuarkDecision).toHaveBeenCalledWith({
    appointmentId: "42",
    phone,
    choice: 1,
    fingerprint: record.scheduleFingerprint
  });
  expect(Send).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.stringContaining("confirmada"),
      policy: expect.objectContaining({ allowPausedBot: true })
    })
  );
});
it("accepts a reference generated for the Brazilian ninth-digit variant", async () => {
  const legacyPhone = "558592413638";
  const currentPhone = "5585992413638";
  const currentReference = appointmentReference(
    "42",
    record.scheduleFingerprint,
    currentPhone
  );

  await call(`CONFIRMAR ${currentReference}`, { phone: legacyPhone });

  expect(QuarkAppointmentRecipient.findAll).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        phone: { [Op.in]: [legacyPhone, currentPhone] }
      })
    })
  );
  expect(ApplyQuarkDecision).toHaveBeenCalledWith(
    expect.objectContaining({ appointmentId: "42", phone: legacyPhone })
  );
});
it("asks for an appointment number when more than one is pending", async () => {
  const second = {
    ...record,
    appointmentId: "43",
    scheduleFingerprint: "b".repeat(64),
    scheduledAt: new Date("2099-08-22T19:00:00Z")
  };
  (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([record, second]);

  await call("CONFIRMAR");

  expect(ApplyQuarkDecision).not.toHaveBeenCalled();
  expect(Send).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.stringMatching(/1 — .*\n2 — .*CONFIRMAR 1 ou CANCELAR 1/s)
    })
  );

  (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([second, record]);
  await call("CONFIRMAR 2");
  expect(ApplyQuarkDecision).toHaveBeenCalledWith(
    expect.objectContaining({ appointmentId: "43", choice: 1 })
  );
});
it("does not interfere with an assigned human conversation", async () => {
  expect(
    await call(`CONFIRMAR ${reference}`, { ticket: { ...ticket, userId: 9 } })
  ).toBe(false);
  expect(ApplyQuarkDecision).not.toHaveBeenCalled();
});
it("requires the configured channel", async () => {
  expect(await call(`CONFIRMAR ${reference}`, { whatsappId: 2 })).toBe(false);
  expect(ApplyQuarkDecision).not.toHaveBeenCalled();
});
it("does not reset the decision if sending the acknowledgment fails", async () => {
  (Send as jest.Mock).mockRejectedValue(new Error("network"));
  await expect(call(`CONFIRMAR ${reference}`)).resolves.toBe(true);
  expect(ApplyQuarkDecision).toHaveBeenCalledTimes(1);
});
it("honors the simulation guard", async () => {
  (assertExecution as jest.Mock).mockRejectedValue(
    new Error("ERR_QUARK_SIMULATION")
  );
  await expect(call(`CONFIRMAR ${reference}`)).rejects.toThrow(
    "ERR_QUARK_SIMULATION"
  );
  expect(ApplyQuarkDecision).not.toHaveBeenCalled();
});
