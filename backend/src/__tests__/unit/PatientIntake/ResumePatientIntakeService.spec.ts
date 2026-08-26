import AppError from "../../../errors/AppError";
import ResumePatientIntakeService from "../../../services/PatientIntakeServices/ResumePatientIntakeService";
import PatientIntakeService from "../../../services/PatientIntakeServices/PatientIntakeService";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import RecordTicketEventService from "../../../services/TicketServices/RecordTicketEventService";

jest.mock("../../../services/TicketServices/ShowTicketService", () => jest.fn());
jest.mock("../../../services/TicketServices/RecordTicketEventService", () =>
  jest.fn()
);
jest.mock("../../../services/PatientIntakeServices/PatientIntakeService", () =>
  jest.fn()
);

const pausedTicket = () => {
  const ticket: any = {
    id: 7,
    ticketType: "PATIENT",
    isGroup: false,
    status: "open",
    intakeStatus: "PAUSED_HUMAN",
    userId: 4,
    queueId: 2
  };
  ticket.update = jest.fn().mockImplementation(async data => {
    Object.assign(ticket, data);
  });
  return ticket;
};

describe("ResumePatientIntakeService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clears the paused state, audits and starts a fresh menu", async () => {
    const ticket = pausedTicket();
    const refreshed = { ...ticket, intakeStatus: "AWAITING_MENU" };
    (ShowTicketService as jest.Mock)
      .mockResolvedValueOnce(ticket)
      .mockResolvedValueOnce(refreshed);
    (PatientIntakeService as jest.Mock).mockResolvedValue({
      handled: true,
      showQueueMenu: false
    });

    await expect(
      ResumePatientIntakeService({ ticketId: 7, userId: 12 })
    ).resolves.toBe(refreshed);

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ intakeStatus: null, intakePausedAt: null })
    );
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 7,
        eventType: "INTAKE_RESTARTED",
        performedByUserId: 12
      })
    );
    expect(PatientIntakeService).toHaveBeenCalledWith(ticket, "");
  });

  it("does not resume a ticket that was not paused by a human", async () => {
    (ShowTicketService as jest.Mock).mockResolvedValue({
      ...pausedTicket(),
      intakeStatus: "AWAITING_MENU"
    });

    await expect(
      ResumePatientIntakeService({ ticketId: 7, userId: 12 })
    ).rejects.toEqual(expect.any(AppError));
    expect(PatientIntakeService).not.toHaveBeenCalled();
  });
});
