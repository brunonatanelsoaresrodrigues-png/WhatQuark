import SendWhatsAppMessage from "../../../services/WbotServices/SendWhatsAppMessage";
import RecordTicketEventService from "../../../services/TicketServices/RecordTicketEventService";
import FindRegisteredPatientNameService from "../../../services/PatientIntakeServices/FindRegisteredPatientNameService";
import PatientIntakeService, {
  isValidBirthDate,
  isValidCpf,
  patientIntakeOwnsNumericInput
} from "../../../services/PatientIntakeServices/PatientIntakeService";
import PausePatientIntakeService from "../../../services/PatientIntakeServices/PausePatientIntakeService";
import { setPreference } from "../../../services/MessagingServices/preferences";
import { emitTicketEvent } from "../../../libs/socket";

jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);
jest.mock("../../../services/TicketServices/RecordTicketEventService", () =>
  jest.fn()
);
jest.mock(
  "../../../services/PatientIntakeServices/FindRegisteredPatientNameService",
  () => jest.fn()
);
jest.mock("../../../services/MessagingServices/preferences", () => ({
  setPreference: jest.fn()
}));
jest.mock("../../../libs/socket", () => ({
  emitTicketEvent: jest.fn().mockResolvedValue(undefined)
}));

const ticket = (overrides: Record<string, unknown> = {}) => {
  const value: any = {
    id: 10,
    intakeStatus: null,
    intakeReason: null,
    queueId: null,
    userId: null,
    contact: { number: "5511999990000" },
    reload: jest.fn().mockResolvedValue(undefined),
    update: jest.fn(async (fields: Record<string, unknown>) => {
      Object.assign(value, fields);
    }),
    ...overrides
  };
  return value;
};

describe("PatientIntakeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SendWhatsAppMessage as jest.Mock).mockResolvedValue({ id: "message-1" });
    (RecordTicketEventService as jest.Mock).mockResolvedValue({});
    (FindRegisteredPatientNameService as jest.Mock).mockResolvedValue("Maria");
  });

  it("starts with a personalized menu for a registered patient", async () => {
    const current = ticket();

    await expect(PatientIntakeService(current, "Olá")).resolves.toEqual({
      handled: true,
      showQueueMenu: false
    });

    expect(current.intakeStatus).toBe("AWAITING_MENU");
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket: current,
        origin: "BOT",
        body: expect.stringMatching(/(Bom dia|Boa tarde|Boa noite), Maria!/)
      })
    );
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "INTAKE_STARTED", ticketId: 10 })
    );
  });

  it("asks for CPF first after selecting an automated service", async () => {
    const current = ticket({ intakeStatus: "AWAITING_MENU" });

    await PatientIntakeService(current, "1");

    expect(current.intakeReason).toBe("SCHEDULE");
    expect(current.intakeStatus).toBe("AWAITING_CPF");
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("CPF do paciente")
      })
    );
  });

  it("registers explicit notice consent from menu option 7", async () => {
    const current = ticket({ intakeStatus: "AWAITING_MENU" });

    await PatientIntakeService(current, "7");

    expect(setPreference).toHaveBeenCalledWith(
      current.contact.number,
      "GRANTED",
      expect.stringContaining("opção 7"),
      null,
      "Solicitante pelo WhatsApp"
    );
    expect(current.intakeStatus).toBe("AWAITING_MENU");
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Avisos de consulta ativados")
      })
    );
  });

  it("does not advance with an invalid CPF", async () => {
    const current = ticket({
      intakeStatus: "AWAITING_CPF",
      intakeReason: "SCHEDULE"
    });

    await PatientIntakeService(current, "11111111111");

    expect(current.intakeStatus).toBe("AWAITING_CPF");
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("parece inválido")
      })
    );
  });

  it("persists a validated CPF before a flow can be handed to a human", async () => {
    const contact: any = {
      id: 20,
      number: "5511999990000",
      cpf: null,
      update: jest.fn(async (fields: Record<string, unknown>) => {
        Object.assign(contact, fields);
      })
    };
    const current = ticket({
      contact,
      contactId: contact.id,
      intakeStatus: "AWAITING_CPF",
      intakeReason: "CANCEL"
    });

    await PatientIntakeService(current, "529.982.247-25");

    expect(contact.update).toHaveBeenCalledWith({ cpf: "52998224725" });
    expect(contact.cpf).toBe("52998224725");
    expect(emitTicketEvent).toHaveBeenCalledWith(current, "contact", {
      action: "update",
      contact
    });
    expect(current.intakeStatus).toBe("AWAITING_NAME");
  });

  it("does not replace a CPF already reviewed on the contact", async () => {
    const contact: any = {
      id: 20,
      number: "5511999990000",
      cpf: "11144477735",
      update: jest.fn()
    };
    const current = ticket({
      contact,
      contactId: contact.id,
      intakeStatus: "AWAITING_CPF",
      intakeReason: "CANCEL"
    });

    await PatientIntakeService(current, "529.982.247-25");

    expect(contact.update).not.toHaveBeenCalled();
    expect(contact.cpf).toBe("11144477735");
  });

  it("hands a cancellation request to the team after CPF and patient name", async () => {
    const current = ticket({
      intakeStatus: "AWAITING_NAME",
      intakeReason: "CANCEL"
    });

    await expect(
      PatientIntakeService(current, "Maria da Silva")
    ).resolves.toEqual({ handled: true, showQueueMenu: true });

    expect(current.intakeStatus).toBe("COMPLETED");
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("encaminhado para nossa equipe")
      })
    );
  });

  it("remains silent after a human pauses the intake", async () => {
    const current = ticket({ intakeStatus: "PAUSED_HUMAN" });

    await expect(PatientIntakeService(current, "1")).resolves.toEqual({
      handled: true,
      showQueueMenu: false
    });
    expect(SendWhatsAppMessage).not.toHaveBeenCalled();
  });

  it("pauses an active intake when a human sends a message", async () => {
    const current = ticket({ intakeStatus: "AWAITING_SPECIALTY" });

    await expect(PausePatientIntakeService(current, 7)).resolves.toBe(true);

    expect(current.intakeStatus).toBe("PAUSED_HUMAN");
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INTAKE_PAUSED",
        performedByUserId: 7
      })
    );
  });

  it("validates CPF and birth dates before advancing", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("123.456.789-00")).toBe(false);
    expect(isValidBirthDate("29/02/2024", new Date("2026-08-21"))).toBe(true);
    expect(isValidBirthDate("31/02/2024", new Date("2026-08-21"))).toBe(false);
  });

  it("reserves numeric replies for the intake until queue routing", () => {
    expect(patientIntakeOwnsNumericInput("AWAITING_PAYMENT")).toBe(true);
    expect(patientIntakeOwnsNumericInput("COMPLETED")).toBe(true);
    expect(patientIntakeOwnsNumericInput("PAUSED_HUMAN")).toBe(false);
    expect(patientIntakeOwnsNumericInput(null)).toBe(false);
  });
});
