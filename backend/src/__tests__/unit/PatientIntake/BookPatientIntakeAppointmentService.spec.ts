import PatientIntakeBooking from "../../../models/PatientIntakeBooking";
import {
  createQuarkAppointment,
  createQuarkPatient,
  findQuarkPatientByCpf
} from "../../../services/QuarkClinicServices/QuarkClinicClient";
import BookPatientIntakeAppointmentService from "../../../services/PatientIntakeServices/BookPatientIntakeAppointmentService";
import {
  getIntakeAgenda,
  revalidateIntakeSlot
} from "../../../services/PatientIntakeServices/QuarkAvailabilityService";

jest.mock("../../../models/PatientIntakeBooking", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn(() => ({}))
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  createQuarkAppointment: jest.fn(),
  createQuarkPatient: jest.fn(),
  findQuarkPatientByCpf: jest.fn(),
  listQuarkAppointments: jest.fn()
}));
jest.mock(
  "../../../services/PatientIntakeServices/QuarkAvailabilityService",
  () => ({
    getIntakeAgenda: jest.fn(),
    revalidateIntakeSlot: jest.fn()
  })
);

const context: any = {
  cpf: "52998224725",
  patientName: "Maria da Silva",
  birthDate: "01/01/1990",
  specialty: "PSYCHIATRY",
  payment: "PRIVATE",
  selectedProfessional: {
    professionalId: "10",
    name: "Dra. Maria",
    agendaIds: ["20"],
    specialtyId: "30"
  },
  selectedSlot: {
    agendaId: "20",
    date: "26/08/2026",
    time: "09:00",
    interval: "09:00 - 09:30"
  }
};

describe("BookPatientIntakeAppointmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const attempt: any = {
      status: "PROCESSING",
      quarkAppointmentId: null,
      updatedAt: new Date(),
      update: jest.fn(async (values: Record<string, unknown>) =>
        Object.assign(attempt, values)
      )
    };
    (PatientIntakeBooking.findOrCreate as jest.Mock).mockResolvedValue([
      attempt,
      true
    ]);
    (findQuarkPatientByCpf as jest.Mock).mockResolvedValue({ id: 55 });
    (revalidateIntakeSlot as jest.Mock).mockResolvedValue(true);
    (getIntakeAgenda as jest.Mock).mockResolvedValue({
      id: 20,
      clinicaId: 40,
      telemedicina: false,
      convenios: [{ id: 148, nome: "PARTICULAR" }],
      procedimentos: [{ id: 60, nome: "Consulta Psiquiatria" }]
    });
    (createQuarkAppointment as jest.Mock).mockResolvedValue(999);
  });

  it("revalidates and creates exactly one appointment for an existing patient", async () => {
    const result = await BookPatientIntakeAppointmentService(
      {
        id: 7,
        contact: { number: "5585999990000" }
      } as any,
      context
    );

    expect(result).toEqual({ status: "SUCCESS", appointmentId: "999" });
    expect(revalidateIntakeSlot).toHaveBeenCalledWith(context.selectedSlot);
    expect(createQuarkPatient).not.toHaveBeenCalled();
    expect(createQuarkAppointment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        agendaId: 20,
        pacienteId: 55,
        especialidadeId: 30,
        procedimentosIds: [60]
      })
    );
  });

  it("does not create anything when the slot is no longer free", async () => {
    (revalidateIntakeSlot as jest.Mock).mockResolvedValue(false);

    await expect(
      BookPatientIntakeAppointmentService(
        { id: 7, contact: { number: "5585999990000" } } as any,
        context
      )
    ).resolves.toEqual({ status: "SLOT_UNAVAILABLE" });
    expect(createQuarkAppointment).not.toHaveBeenCalled();
  });
});
