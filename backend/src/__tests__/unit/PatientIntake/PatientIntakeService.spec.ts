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
import {
  decryptIntakeContext,
  encryptIntakeContext
} from "../../../services/PatientIntakeServices/PatientIntakeContextService";
import ListPatientIntakeAppointmentsService from "../../../services/PatientIntakeServices/ListPatientIntakeAppointmentsService";
import { ApplyQuarkDecision } from "../../../services/QuarkClinicServices/ApplyQuarkDecision";

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
jest.mock(
  "../../../services/PatientIntakeServices/ListPatientIntakeAppointmentsService",
  () => jest.fn()
);
jest.mock("../../../services/QuarkClinicServices/ApplyQuarkDecision", () => ({
  ApplyQuarkDecision: jest.fn()
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
    (ApplyQuarkDecision as jest.Mock).mockResolvedValue(undefined);
  });

  it("starts with a personalized menu for a registered patient", async () => {
    const current = ticket();

    await expect(PatientIntakeService(current, "Olá")).resolves.toEqual({
      handled: true,
      showQueueMenu: false
    });

    expect(current.intakeStatus).toBe("AWAITING_MENU");
    expect(decryptIntakeContext(current.intakeContext)).toEqual({
      menuVersion: 2
    });
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

  it("starts confirmation or rescheduling from the new menu option 2", async () => {
    const current = ticket({
      intakeStatus: "AWAITING_MENU",
      intakeContext: encryptIntakeContext({ menuVersion: 2 }),
      intakeContextExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await PatientIntakeService(current, "2");

    expect(current.intakeReason).toBe("CONFIRM_OR_RESCHEDULE");
    expect(current.intakeStatus).toBe("AWAITING_CPF");
  });

  it("registers explicit notice consent from the renumbered menu option 6", async () => {
    const current = ticket({
      intakeStatus: "AWAITING_MENU",
      intakeContext: encryptIntakeContext({ menuVersion: 2 }),
      intakeContextExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await PatientIntakeService(current, "6");

    expect(setPreference).toHaveBeenCalledWith(
      current.contact.number,
      "GRANTED",
      expect.stringContaining("opção 6"),
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

  it("shows private prices and hands scheduling to an attendant from menu option 4", async () => {
    const current = ticket({
      intakeStatus: "AWAITING_MENU",
      intakeContext: encryptIntakeContext({ menuVersion: 2 }),
      intakeContextExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await PatientIntakeService(current, "4");
    expect(current.intakeReason).toBe("INSURANCE_OR_PRICE");
    expect(current.intakeStatus).toBe("AWAITING_COVERAGE_INFO");
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/1️⃣ Hapvida[\s\S]*2️⃣ Particular/)
      })
    );

    await PatientIntakeService(current, "2");
    expect(current.intakeStatus).toBe("AWAITING_INFO_SCHEDULING");
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(
          /Psiquiatria — R\$ 350,00[\s\S]*Sessões — R\$ 80,00[\s\S]*Laudo — particular — R\$ 450,00/
        )
      })
    );

    await expect(PatientIntakeService(current, "1")).resolves.toEqual({
      handled: true,
      showQueueMenu: true
    });
    expect(current.intakeStatus).toBe("COMPLETED");
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          "encaminhado para um de nossos colaboradores"
        )
      })
    );
  });

  it("keeps the old menu option 5 connected to the coverage information flow", async () => {
    const current = ticket({ intakeStatus: "AWAITING_MENU" });

    await PatientIntakeService(current, "5");

    expect(current.intakeReason).toBe("INSURANCE_OR_PRICE");
    expect(current.intakeStatus).toBe("AWAITING_COVERAGE_INFO");
  });

  it("keeps the old option 7 working for a menu already sent", async () => {
    const current = ticket({ intakeStatus: "AWAITING_MENU" });

    await PatientIntakeService(current, "7");

    expect(setPreference).toHaveBeenCalledWith(
      current.contact.number,
      "GRANTED",
      expect.stringContaining("opção 7"),
      null,
      "Solicitante pelo WhatsApp"
    );
  });

  it("finds and confirms an existing appointment from menu option 2", async () => {
    const appointment = {
      appointmentId: "42",
      patientId: "55",
      patientName: "Maria da Silva",
      professionalName: "Dra. Maria",
      date: "26/08/2026",
      time: "09:00",
      status: "AGENDADO" as const,
      scheduleFingerprint: "fingerprint"
    };
    (ListPatientIntakeAppointmentsService as jest.Mock).mockResolvedValue({
      status: "FOUND",
      patientName: "Maria da Silva",
      appointments: [appointment]
    });
    const current = ticket({
      intakeStatus: "AWAITING_CPF",
      intakeReason: "CONFIRM_OR_RESCHEDULE",
      intakeContext: encryptIntakeContext({ menuVersion: 2 }),
      intakeContextExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await PatientIntakeService(current, "52998224725");
    expect(current.intakeStatus).toBe("AWAITING_EXISTING_BIRTH_DATE");

    await PatientIntakeService(current, "01/01/1990");
    expect(current.intakeStatus).toBe("AWAITING_APPOINTMENT_SELECTION");

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("AWAITING_APPOINTMENT_ACTION");

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("COMPLETED");
    expect(ApplyQuarkDecision).toHaveBeenCalledWith({
      appointmentId: "42",
      phone: current.contact.number,
      choice: 1,
      fingerprint: "fingerprint"
    });
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Consulta confirmada com sucesso")
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

  it("shows the appointment and cancels it in Quark after CPF and patient name", async () => {
    const appointment = {
      appointmentId: "84",
      patientId: "55",
      patientName: "Maria da Silva",
      professionalName: "Dra. Ana",
      date: "02/09/2026",
      time: "14:30",
      status: "CONFIRMADO" as const,
      scheduleFingerprint: "cancel-fingerprint"
    };
    (ListPatientIntakeAppointmentsService as jest.Mock).mockResolvedValue({
      status: "FOUND",
      patientName: "Maria da Silva",
      appointments: [appointment]
    });
    const current = ticket({
      intakeStatus: "AWAITING_NAME",
      intakeReason: "CANCEL",
      intakeContext: encryptIntakeContext({
        menuVersion: 2,
        cpf: "52998224725"
      }),
      intakeContextExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await PatientIntakeService(current, "Maria da Silva");

    expect(ListPatientIntakeAppointmentsService).toHaveBeenCalledWith(
      "52998224725",
      undefined,
      current.contact.number,
      "Maria da Silva"
    );
    expect(current.intakeStatus).toBe("AWAITING_APPOINTMENT_ACTION");
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/Dra\. Ana[\s\S]*02\/09\/2026[\s\S]*14:30/)
      })
    );

    await expect(PatientIntakeService(current, "1")).resolves.toEqual({
      handled: true,
      showQueueMenu: true
    });

    expect(current.intakeStatus).toBe("COMPLETED");
    expect(ApplyQuarkDecision).toHaveBeenCalledWith({
      appointmentId: "84",
      phone: current.contact.number,
      choice: 2,
      fingerprint: "cancel-fingerprint"
    });
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Consulta cancelada com sucesso")
      })
    );
  });

  it("hands rescheduling to the team without cancelling the current appointment", async () => {
    const appointment = {
      appointmentId: "84",
      patientId: "55",
      patientName: "Maria da Silva",
      professionalName: "Dra. Ana",
      date: "02/09/2026",
      time: "14:30",
      status: "AGENDADO" as const,
      scheduleFingerprint: "reschedule-fingerprint"
    };
    const current = ticket({
      intakeStatus: "AWAITING_APPOINTMENT_ACTION",
      intakeReason: "CANCEL",
      intakeContext: encryptIntakeContext({
        menuVersion: 2,
        selectedAppointment: appointment
      }),
      intakeContextExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    await expect(PatientIntakeService(current, "2")).resolves.toEqual({
      handled: true,
      showQueueMenu: true
    });

    expect(ApplyQuarkDecision).not.toHaveBeenCalled();
    expect(current.intakeStatus).toBe("COMPLETED");
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/consulta atual permanece agendada/i)
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
