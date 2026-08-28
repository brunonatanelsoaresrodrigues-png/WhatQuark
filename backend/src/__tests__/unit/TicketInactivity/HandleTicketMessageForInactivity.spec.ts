import SetTicketWaitingForPatientService from "../../../services/TicketInactivityServices/SetTicketWaitingForPatientService";
import HandleTicketMessageForInactivity from "../../../services/TicketInactivityServices/HandleTicketMessageForInactivity";

jest.mock(
  "../../../services/TicketInactivityServices/SetTicketWaitingForPatientService",
  () => jest.fn()
);

const ticket = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 10,
    status: "open",
    isGroup: false,
    awaitingPatientSince: null,
    inactivityClosingAt: null,
    ...overrides
  } as any);

describe("HandleTicketMessageForInactivity", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not start automatically after a clinic question", async () => {
    await HandleTicketMessageForInactivity({
      ticket: ticket(),
      message: { id: "question", fromMe: true, body: "Posso ajudar?" } as any
    });

    expect(SetTicketWaitingForPatientService).not.toHaveBeenCalled();
  });

  it("does not start waiting after an informational clinic message", async () => {
    await HandleTicketMessageForInactivity({
      ticket: ticket(),
      message: { id: "info", fromMe: true, body: "Consulta confirmada" } as any
    });

    expect(SetTicketWaitingForPatientService).not.toHaveBeenCalled();
  });

  it.each(["audio", "image", "chat"])(
    "cancels the timer for an incoming %s message",
    async mediaType => {
      await HandleTicketMessageForInactivity({
        ticket: ticket({ awaitingPatientSince: new Date() }),
        message: {
          id: `incoming-${mediaType}`,
          fromMe: false,
          body: "",
          mediaType
        } as any
      });

      expect(SetTicketWaitingForPatientService).toHaveBeenCalledWith({
        ticketId: 10,
        waiting: false,
        messageId: `incoming-${mediaType}`
      });
    }
  );
});
