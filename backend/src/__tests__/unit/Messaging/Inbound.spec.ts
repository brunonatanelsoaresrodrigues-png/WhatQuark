import Intake from "../../../services/PatientIntakeServices/PatientIntakeService";
import AutomationState from "../../../models/AutomationState";
import { HandleInboundAutomation } from "../../../services/MessagingServices/HandleInboundAutomation";
import {
  digest,
  readState,
  writeState
} from "../../../services/MessagingServices/state";
import ShowTicket from "../../../services/TicketServices/ShowTicketService";
import ShowWhatsApp from "../../../services/WhatsappService/ShowWhatsAppService";
import UpdateTicket from "../../../services/TicketServices/UpdateTicketService";
import Send from "../../../services/WbotServices/SendWhatsAppMessage";
import HandleQuark from "../../../services/QuarkClinicServices/HandleQuarkConfirmationReply";
import { setPreference } from "../../../services/MessagingServices/preferences";
jest.mock("../../../models/AutomationState", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));
jest.mock("../../../services/MessagingServices/state", () => ({
  ...jest.requireActual("../../../services/MessagingServices/state"),
  withLease: (_: string, fn: Function) => fn(),
  readState: jest.fn(),
  writeState: jest.fn()
}));
jest.mock("../../../services/MessagingServices/policy", () => ({
  assertExecution: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("../../../services/MessagingServices/preferences", () => ({
  ...jest.requireActual("../../../services/MessagingServices/preferences"),
  setPreference: jest.fn()
}));
jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/WhatsappService/ShowWhatsAppService", () =>
  jest.fn()
);
jest.mock("../../../services/TicketServices/UpdateTicketService", () =>
  jest.fn()
);
jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);
jest.mock(
  "../../../services/QuarkClinicServices/HandleQuarkConfirmationReply",
  () => jest.fn()
);
jest.mock("../../../services/PatientIntakeServices/PatientIntakeService", () =>
  jest.fn()
);
jest.mock(
  "../../../services/PatientIntakeServices/PausePatientIntakeService",
  () => jest.fn().mockResolvedValue(false)
);
const state = new Map();
const input = {
  ticketId: 1,
  whatsappId: 1,
  phone: "5511999990000",
  body: "Olá",
  messageId: "in-1"
};
beforeEach(() => {
  jest.clearAllMocks();
  state.clear();
  (Intake as jest.Mock).mockResolvedValue({
    handled: false,
    showQueueMenu: false
  });
  (AutomationState.findOrCreate as jest.Mock).mockImplementation(
    async ({ defaults }) => {
      if (!state.has(defaults.id))
        state.set(defaults.id, JSON.parse(defaults.data));
      return [{}, true];
    }
  );
  (readState as jest.Mock).mockImplementation(async (key, fallback) =>
    state.has(key) ? state.get(key) : fallback
  );
  (writeState as jest.Mock).mockImplementation(async (key, value) =>
    state.set(key, value)
  );
  (ShowTicket as jest.Mock).mockResolvedValue({
    id: 1,
    status: "pending",
    userId: null,
    queueId: null
  });
  (ShowWhatsApp as jest.Mock).mockResolvedValue({
    queues: [
      { id: 1, name: "Recepção" },
      { id: 2, name: "Agendamento" }
    ]
  });
  (HandleQuark as jest.Mock).mockResolvedValue(false);
  (Send as jest.Mock).mockResolvedValue({ id: "out-1" });
});
it("does not process the same provider event twice", async () => {
  await HandleInboundAutomation(input);
  await HandleInboundAutomation(input);
  expect(Send).toHaveBeenCalledTimes(1);
  expect(HandleQuark).toHaveBeenCalledTimes(1);
});
it("recovers a provider event abandoned in PROCESSING", async () => {
  const eventId = `incoming:${digest(
    `${input.whatsappId}:${input.messageId}`
  )}`;
  state.set(eventId, {
    status: "PROCESSING",
    startedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString()
  });

  await HandleInboundAutomation(input);

  expect(HandleQuark).toHaveBeenCalledTimes(1);
  expect(state.get(eventId)).toEqual(
    expect.objectContaining({ status: "APPLIED", ticketId: 1 })
  );
});
it("hands off after one clarification instead of looping menus", async () => {
  await HandleInboundAutomation(input);
  await HandleInboundAutomation({
    ...input,
    messageId: "in-2",
    body: "não entendi"
  });
  await HandleInboundAutomation({
    ...input,
    messageId: "in-3",
    body: "ainda preciso de ajuda"
  });
  expect(UpdateTicket).toHaveBeenCalledWith(
    expect.objectContaining({ ticketData: { queueId: 1 } })
  );
  expect(state.get("bot-pause:1")).toBe(true);
  expect(Send).toHaveBeenCalledTimes(3);
  await HandleInboundAutomation({ ...input, messageId: "in-4" });
  expect(Send).toHaveBeenCalledTimes(3);
});
it("interprets menu numbers only after showing the menu", async () => {
  await HandleInboundAutomation({ ...input, body: "2" });
  expect(UpdateTicket).not.toHaveBeenCalled();
  await HandleInboundAutomation({ ...input, body: "2", messageId: "in-2" });
  expect(UpdateTicket).toHaveBeenCalledWith(
    expect.objectContaining({ ticketData: { queueId: 2 } })
  );
});
it("honors opt-out even during human attendance", async () => {
  (ShowTicket as jest.Mock).mockResolvedValue({
    id: 1,
    status: "open",
    userId: 9
  });
  await HandleInboundAutomation({ ...input, body: "PARAR" });
  expect(setPreference).toHaveBeenCalledWith(
    input.phone,
    "REVOKED",
    expect.any(String)
  );
  expect(HandleQuark).not.toHaveBeenCalled();
});
it("never runs the appointment bot during assigned attendance", async () => {
  (ShowTicket as jest.Mock).mockResolvedValue({
    id: 1,
    status: "open",
    userId: 9
  });
  await HandleInboundAutomation(input);
  expect(HandleQuark).not.toHaveBeenCalled();
  expect(Send).not.toHaveBeenCalled();
});

it("processes an explicit appointment command while the general bot is paused", async () => {
  state.set("bot-pause:1", true);
  (HandleQuark as jest.Mock).mockResolvedValue(true);

  await HandleInboundAutomation({
    ...input,
    body: "CONFIRMAR 7A3FF1AC"
  });

  expect(HandleQuark).toHaveBeenCalledWith(
    expect.objectContaining({
      body: "CONFIRMAR 7A3FF1AC",
      ticket: expect.objectContaining({ id: 1 })
    })
  );
  expect(Intake).not.toHaveBeenCalled();
});

it("keeps ordinary messages silent while the general bot is paused", async () => {
  state.set("bot-pause:1", true);

  await HandleInboundAutomation(input);

  expect(HandleQuark).not.toHaveBeenCalled();
  expect(Intake).not.toHaveBeenCalled();
  expect(Send).not.toHaveBeenCalled();
});

it("preserves intake and deduplicates it before processing menu choices", async () => {
  (Intake as jest.Mock).mockResolvedValue({
    handled: true,
    showQueueMenu: false
  });
  await HandleInboundAutomation({ ...input, body: "1" });
  await HandleInboundAutomation({ ...input, body: "1" });
  expect(Intake).toHaveBeenCalledTimes(1);
  expect(Intake).toHaveBeenCalledWith(
    expect.anything(),
    "1",
    expect.stringMatching(/^incoming:/)
  );
  expect(UpdateTicket).not.toHaveBeenCalled();
});

it("starts patient intake even when the channel has no linked queue", async () => {
  (ShowWhatsApp as jest.Mock).mockResolvedValue({ queues: [] });
  (Intake as jest.Mock).mockResolvedValue({
    handled: true,
    showQueueMenu: false
  });

  await HandleInboundAutomation(input);

  expect(Intake).toHaveBeenCalledTimes(1);
  expect(UpdateTicket).not.toHaveBeenCalled();
});

it("hands off an explicit ATENDENTE request during intake", async () => {
  await HandleInboundAutomation({ ...input, body: "ATENDENTE" });
  expect(Intake).not.toHaveBeenCalled();
  expect(HandleQuark).not.toHaveBeenCalled();
  expect(state.get("bot-pause:1")).toBe(true);
  expect(UpdateTicket).toHaveBeenCalled();
});
