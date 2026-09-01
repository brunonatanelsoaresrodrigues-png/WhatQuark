import { createHmac } from "crypto";
import {
  appointmentStatusesForPolicy,
  assertExecution,
  inServiceWindow,
  modeFrom
} from "../../../services/MessagingServices/policy";
import { readState } from "../../../services/MessagingServices/state";
import {
  canReceiveAppointmentNotices,
  preferenceCommand
} from "../../../services/MessagingServices/preferences";
import { validSignature } from "../../../services/MessagingServices/cloudSignature";
jest.mock("../../../services/MessagingServices/state", () => ({
  readState: jest.fn().mockResolvedValue(false)
}));
const original = { ...process.env };
beforeEach(() => {
  process.env = {
    ...original,
    WHATSAPP_PROVIDER: "cloud",
    MESSAGING_MODE: "test",
    MESSAGING_TEST_ALLOWLIST: "5511999990000",
    QUARK_INTEGRATION_ENABLED: "true",
    QUARK_DRY_RUN: "false"
  };
  (readState as jest.Mock).mockResolvedValue(false);
});
afterAll(() => {
  process.env = original;
});
it("defaults to simulation and rejects invalid modes", () => {
  delete process.env.MESSAGING_MODE;
  expect(modeFrom()).toBe("simulation");
  expect(() => modeFrom("invalid")).toThrow("ERR_INVALID_MESSAGING_MODE");
});
it.each(["off", "simulation"])("prevents all mutations in %s", async mode => {
  process.env.MESSAGING_MODE = mode;
  await expect(assertExecution("5511999990000")).rejects.toThrow(
    "ERR_MESSAGING_PAUSED"
  );
  await expect(assertExecution("5511999990000", true)).rejects.toThrow(
    "ERR_MESSAGING_PAUSED"
  );
});
it("fails closed with an empty test allowlist", async () => {
  process.env.MESSAGING_TEST_ALLOWLIST = "";
  await expect(assertExecution("5511999990000")).rejects.toThrow(
    "ERR_TEST_RECIPIENT_NOT_ALLOWED"
  );
});
it("allows only the configured test recipient", async () => {
  await expect(assertExecution("5511999990000")).resolves.toBeUndefined();
  await expect(assertExecution("5511988880000")).rejects.toThrow(
    "ERR_TEST_RECIPIENT_NOT_ALLOWED"
  );
});
it.each(["whaileys", "wwebjs"])(
  "keeps the existing %s transport enabled without requiring Meta",
  async provider => {
    process.env.WHATSAPP_PROVIDER = provider;
    await expect(assertExecution("5511999990000")).resolves.toBeUndefined();
    await expect(assertExecution("5511988880000")).rejects.toThrow(
      "ERR_TEST_RECIPIENT_NOT_ALLOWED"
    );
  }
);
it("honors the global kill switch", async () => {
  (readState as jest.Mock).mockResolvedValue(true);
  await expect(assertExecution("5511999990000")).rejects.toThrow(
    "ERR_MESSAGING_PAUSED"
  );
});
it("applies dry-run to Quark manual decisions too", async () => {
  process.env.QUARK_DRY_RUN = "true";
  await expect(assertExecution("5511999990000", true)).rejects.toThrow(
    "ERR_QUARK_SIMULATION"
  );
});
it("does not extend the 24h window using invalid or future dates", () => {
  const now = Date.now();
  expect(inServiceWindow(new Date(now - 1000).toISOString(), now)).toBe(true);
  expect(inServiceWindow(new Date(now - 86400000).toISOString(), now)).toBe(
    false
  );
  expect(inServiceWindow(new Date(now + 1000).toISOString(), now)).toBe(false);
  expect(inServiceWindow(null, now)).toBe(false);
});
it.each(["PARAR", "sair", "STOP", "Cancelar avisos"])(
  "recognizes opt-out %s",
  command => expect(preferenceCommand(command)).toBe("REVOKED")
);
it("does not infer consent from arbitrary affirmative text", () => {
  expect(preferenceCommand("sim")).toBeNull();
  expect(preferenceCommand("AUTORIZO AVISOS DE CONSULTA")).toBe("GRANTED");
});
it("allows operational appointment notices without a manual opt-in", () => {
  process.env.QUARK_APPOINTMENT_NOTICES_REQUIRE_OPT_IN = "false";
  expect(
    canReceiveAppointmentNotices({
      consent: "UNKNOWN",
      changedAt: null,
      source: null,
      actorUserId: null,
      relationship: null,
      version: "appointment-notices-v1"
    })
  ).toBe(true);
});
it("keeps opt-out as a hard block for appointment notices", () => {
  process.env.QUARK_APPOINTMENT_NOTICES_REQUIRE_OPT_IN = "false";
  expect(
    canReceiveAppointmentNotices({
      consent: "REVOKED",
      changedAt: new Date().toISOString(),
      source: "PARAR recebido pelo WhatsApp",
      actorUserId: null,
      relationship: "Próprio paciente",
      version: "appointment-notices-v1"
    })
  ).toBe(false);
});
it("can restore the stricter opt-in policy through configuration", () => {
  process.env.QUARK_APPOINTMENT_NOTICES_REQUIRE_OPT_IN = "true";
  expect(
    canReceiveAppointmentNotices({
      consent: "UNKNOWN",
      changedAt: null,
      source: null,
      actorUserId: null,
      relationship: null,
      version: "appointment-notices-v1"
    })
  ).toBe(false);
});
it("does not require opt-in on a non-official transport", () => {
  process.env.WHATSAPP_PROVIDER = "whaileys";
  process.env.QUARK_APPOINTMENT_NOTICES_REQUIRE_OPT_IN = "true";
  expect(
    canReceiveAppointmentNotices({
      consent: "UNKNOWN",
      changedAt: null,
      source: null,
      actorUserId: null,
      relationship: null,
      version: "appointment-notices-v1"
    })
  ).toBe(true);
});
it("allows the waiting status only for a same-day reschedule notice", () => {
  expect(
    appointmentStatusesForPolicy({
      allowConfirmedAppointment: true,
      allowSameDayRescheduledAppointment: true
    })
  ).toContain("AGUARDANDO_ATENDIMENTO");
  expect(
    appointmentStatusesForPolicy({ allowConfirmedAppointment: true })
  ).not.toContain("AGUARDANDO_ATENDIMENTO");
});
it("verifies the exact raw webhook body and rejects tampering", () => {
  const body = Buffer.from('{"hello":"test"}');
  const signature = `sha256=${createHmac("sha256", "test-secret")
    .update(body)
    .digest("hex")}`;
  expect(validSignature(body, signature, "test-secret")).toBe(true);
  expect(validSignature(Buffer.from("{}"), signature, "test-secret")).toBe(
    false
  );
  expect(validSignature(body, "invalid", "test-secret")).toBe(false);
  expect(validSignature(body, signature, "")).toBe(false);
});
