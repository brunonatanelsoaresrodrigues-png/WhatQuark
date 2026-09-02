import SendWhatsAppMessage from "../../../services/WbotServices/SendWhatsAppMessage";
import RecordTicketEventService from "../../../services/TicketServices/RecordTicketEventService";
import PatientIntakeService from "../../../services/PatientIntakeServices/PatientIntakeService";
import BookPatientIntakeAppointmentService from "../../../services/PatientIntakeServices/BookPatientIntakeAppointmentService";
import {
  decryptIntakeContext,
  encryptIntakeContext
} from "../../../services/PatientIntakeServices/PatientIntakeContextService";
import {
  isPatientIntakeAvailabilityEnabled,
  isPatientIntakeBookingEnabled,
  listIntakeAvailabilityDates,
  listIntakeProfessionals
} from "../../../services/PatientIntakeServices/QuarkAvailabilityService";
import { ApplyQuarkDecision } from "../../../services/QuarkClinicServices/ApplyQuarkDecision";

jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);
jest.mock("../../../services/TicketServices/RecordTicketEventService", () =>
  jest.fn()
);
jest.mock(
  "../../../services/PatientIntakeServices/FindRegisteredPatientNameService",
  () => jest.fn().mockResolvedValue(undefined)
);
jest.mock(
  "../../../services/PatientIntakeServices/BookPatientIntakeAppointmentService",
  () => jest.fn()
);
jest.mock("../../../services/QuarkClinicServices/ApplyQuarkDecision", () => ({
  ApplyQuarkDecision: jest.fn()
}));
jest.mock(
  "../../../services/PatientIntakeServices/QuarkAvailabilityService",
  () => ({
    isPatientIntakeAvailabilityEnabled: jest.fn(),
    isPatientIntakeBookingEnabled: jest.fn(),
    listIntakeAvailabilityDates: jest.fn(),
    listIntakeProfessionals: jest.fn()
  })
);

const professional = {
  professionalId: "10",
  name: "Dra. Maria",
  agendaIds: ["20"],
  specialtyId: "30"
};

const availability = [
  {
    date: "26/08/2026",
    label: "Quarta-feira, 26/08",
    slots: [
      {
        agendaId: "20",
        date: "26/08/2026",
        time: "09:00",
        interval: "09:00 - 09:30"
      }
    ]
  }
];

const ticket = () => {
  const value: any = {
    id: 55,
    intakeStatus: "AWAITING_SPECIALTY",
    intakeReason: "SCHEDULE",
    intakeContext: encryptIntakeContext({
      cpf: "52998224725",
      patientName: "Maria da Silva",
      birthDate: "01/01/1990"
    }),
    intakeContextExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    queueId: null,
    userId: null,
    contact: { number: "5585999990000" },
    reload: jest.fn().mockResolvedValue(undefined),
    update: jest.fn(async (fields: Record<string, unknown>) => {
      Object.assign(value, fields);
    })
  };
  return value;
};

describe("PatientIntakeService Quark availability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SendWhatsAppMessage as jest.Mock).mockResolvedValue({ id: "bot-1" });
    (RecordTicketEventService as jest.Mock).mockResolvedValue({});
    (isPatientIntakeAvailabilityEnabled as jest.Mock).mockReturnValue(true);
    (isPatientIntakeBookingEnabled as jest.Mock).mockReturnValue(true);
    (listIntakeProfessionals as jest.Mock).mockResolvedValue([professional]);
    (listIntakeAvailabilityDates as jest.Mock).mockResolvedValue(availability);
    (BookPatientIntakeAppointmentService as jest.Mock).mockResolvedValue({
      status: "SUCCESS",
      appointmentId: "999"
    });
    (ApplyQuarkDecision as jest.Mock).mockResolvedValue(undefined);
  });

  it("lists Quark professionals, dates and times before confirmation", async () => {
    const current = ticket();

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("AWAITING_PAYMENT");

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("AWAITING_PROFESSIONAL_NAME");
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: expect.stringContaining("Dra. Maria") })
    );

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("AWAITING_AVAILABILITY_DATE");

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("AWAITING_AVAILABILITY_TIME");

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("AWAITING_BOOKING_CONFIRMATION");
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("26/08/2026")
      })
    );
  });

  it("never offers the removed first-available-professional fallback", async () => {
    (isPatientIntakeAvailabilityEnabled as jest.Mock).mockReturnValue(false);
    const current = ticket();

    await PatientIntakeService(current, "1");
    await PatientIntakeService(current, "1");

    expect(current.intakeStatus).toBe("AWAITING_PROFESSIONAL_NAME");
    const calls = (SendWhatsAppMessage as jest.Mock).mock.calls;
    const lastBody = calls[calls.length - 1]?.[0]?.body;
    expect(lastBody).toContain("nome do profissional");
    expect(lastBody).not.toContain("primeiro disponível");
  });

  it("returns one step with zero and resets with MENU", async () => {
    const current = ticket();
    await PatientIntakeService(current, "1");
    await PatientIntakeService(current, "1");
    await PatientIntakeService(current, "1");
    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("AWAITING_AVAILABILITY_TIME");

    await PatientIntakeService(current, "0");
    expect(current.intakeStatus).toBe("AWAITING_AVAILABILITY_DATE");

    await PatientIntakeService(current, "MENU");
    expect(current.intakeStatus).toBe("AWAITING_MENU");
    expect(current.intakeReason).toBeNull();
    expect(decryptIntakeContext(current.intakeContext)).toEqual({
      menuVersion: 2
    });
  });

  it("creates the appointment and confirms it to the patient", async () => {
    const current = ticket();
    for (const answer of ["1", "1", "1", "1", "1"]) {
      await PatientIntakeService(current, answer);
    }
    expect(current.intakeStatus).toBe("AWAITING_BOOKING_CONFIRMATION");

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("COMPLETED");
    expect(BookPatientIntakeAppointmentService).toHaveBeenCalledWith(
      current,
      expect.objectContaining({ selectedSlot: availability[0].slots[0] })
    );
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Consulta agendada com sucesso")
      })
    );
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INTAKE_COMPLETED",
        metadata: expect.objectContaining({ source: "QUARK_BOOKING" })
      })
    );
  });

  it("creates a replacement before cancelling the previous appointment", async () => {
    const current = ticket();
    current.intakeStatus = "AWAITING_BOOKING_CONFIRMATION";
    current.intakeReason = "CONFIRM_OR_RESCHEDULE";
    current.intakeContext = encryptIntakeContext({
      cpf: "52998224725",
      patientName: "Maria da Silva",
      birthDate: "01/01/1990",
      specialty: "PSYCHIATRY",
      payment: "PRIVATE",
      selectedProfessional: professional,
      selectedSlot: availability[0].slots[0],
      selectedAppointment: {
        appointmentId: "42",
        patientId: "55",
        patientName: "Maria da Silva",
        professionalName: "Dra. Antiga",
        date: "25/08/2026",
        time: "08:00",
        status: "AGENDADO",
        scheduleFingerprint: "fingerprint"
      },
      appointmentAction: "RESCHEDULE"
    });

    await PatientIntakeService(current, "1");

    expect(BookPatientIntakeAppointmentService).toHaveBeenCalledTimes(1);
    expect(ApplyQuarkDecision).toHaveBeenCalledWith({
      appointmentId: "42",
      phone: current.contact.number,
      choice: 2,
      fingerprint: "fingerprint"
    });
    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Consulta remarcada com sucesso")
      })
    );
  });

  it("does not claim a successful reschedule when the old appointment needs review", async () => {
    (ApplyQuarkDecision as jest.Mock).mockRejectedValueOnce(
      new Error("QUARK_OPERATION_OUTCOME_UNKNOWN")
    );
    const current = ticket();
    current.intakeStatus = "AWAITING_BOOKING_CONFIRMATION";
    current.intakeReason = "CONFIRM_OR_RESCHEDULE";
    current.intakeContext = encryptIntakeContext({
      cpf: "52998224725",
      patientName: "Maria da Silva",
      birthDate: "01/01/1990",
      specialty: "PSYCHIATRY",
      payment: "PRIVATE",
      selectedProfessional: professional,
      selectedSlot: availability[0].slots[0],
      selectedAppointment: {
        appointmentId: "42",
        patientId: "55",
        patientName: "Maria da Silva",
        professionalName: "Dra. Antiga",
        date: "25/08/2026",
        time: "08:00",
        status: "AGENDADO",
        scheduleFingerprint: "fingerprint"
      },
      appointmentAction: "RESCHEDULE"
    });

    await PatientIntakeService(current, "1");

    expect(SendWhatsAppMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          "A nova consulta foi criada, mas não consegui encerrar"
        )
      })
    );
    expect(SendWhatsAppMessage).not.toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Consulta remarcada com sucesso")
      })
    );
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "QUARK_RESCHEDULE_REVIEW_REQUIRED",
          previousAppointmentId: "42",
          newAppointmentId: "999"
        })
      })
    );
  });
});
