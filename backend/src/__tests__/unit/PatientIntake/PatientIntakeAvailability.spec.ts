import SendWhatsAppMessage from "../../../services/WbotServices/SendWhatsAppMessage";
import RecordTicketEventService from "../../../services/TicketServices/RecordTicketEventService";
import PatientIntakeService from "../../../services/PatientIntakeServices/PatientIntakeService";
import {
  decryptIntakeContext,
  encryptIntakeContext
} from "../../../services/PatientIntakeServices/PatientIntakeContextService";
import {
  findFirstIntakeAvailability,
  isPatientIntakeAvailabilityEnabled,
  isPatientIntakeBookingEnabled,
  listIntakeAvailabilityDates,
  listIntakeProfessionals
} from "../../../services/PatientIntakeServices/QuarkAvailabilityService";

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
jest.mock(
  "../../../services/PatientIntakeServices/QuarkAvailabilityService",
  () => ({
    findFirstIntakeAvailability: jest.fn(),
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
    (isPatientIntakeBookingEnabled as jest.Mock).mockReturnValue(false);
    (listIntakeProfessionals as jest.Mock).mockResolvedValue([professional]);
    (listIntakeAvailabilityDates as jest.Mock).mockResolvedValue(availability);
    (findFirstIntakeAvailability as jest.Mock).mockResolvedValue({
      professional,
      dates: availability
    });
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
    expect(decryptIntakeContext(current.intakeContext)).toEqual({});
  });

  it("hands the selected slot to the team when automatic booking is disabled", async () => {
    const current = ticket();
    for (const answer of ["1", "1", "1", "1", "1"]) {
      await PatientIntakeService(current, answer);
    }
    expect(current.intakeStatus).toBe("AWAITING_BOOKING_CONFIRMATION");

    await PatientIntakeService(current, "1");
    expect(current.intakeStatus).toBe("COMPLETED");
    expect(RecordTicketEventService).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INTAKE_COMPLETED",
        metadata: expect.objectContaining({ source: "QUARK_SLOT_SELECTED" })
      })
    );
  });
});
