import QuarkAppointment from "../../../models/QuarkAppointment";
import { findQuarkPatientByCpf } from "../../../services/QuarkClinicServices/QuarkClinicClient";
import ListPatientIntakeAppointmentsService from "../../../services/PatientIntakeServices/ListPatientIntakeAppointmentsService";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn(() => ({ defaultCountryCode: "55" }))
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  findQuarkPatientByCpf: jest.fn()
}));

describe("ListPatientIntakeAppointmentsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (findQuarkPatientByCpf as jest.Mock).mockResolvedValue({
      id: 55,
      nome: "Maria da Silva",
      dataNascimento: "1990-01-01"
    });
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
      {
        appointmentId: "42",
        patientId: "55",
        phone: "5585999990000",
        patientName: "Maria da Silva",
        status: "AGENDADO",
        scheduledAt: new Date("2027-01-10T12:00:00.000Z"),
        scheduleFingerprint: "fingerprint",
        snapshot: JSON.stringify({ profissionalNome: "Dra. Maria" })
      }
    ]);
  });

  it("verifies date of birth and returns upcoming appointments for the phone", async () => {
    await expect(
      ListPatientIntakeAppointmentsService(
        "529.982.247-25",
        "01/01/1990",
        "5585999990000"
      )
    ).resolves.toEqual({
      status: "FOUND",
      patientName: "Maria da Silva",
      appointments: [
        expect.objectContaining({
          appointmentId: "42",
          professionalName: "Dra. Maria",
          status: "AGENDADO"
        })
      ]
    });
    expect(findQuarkPatientByCpf).toHaveBeenCalledWith(
      expect.anything(),
      "52998224725"
    );
  });

  it("does not disclose appointments when the date of birth differs", async () => {
    await expect(
      ListPatientIntakeAppointmentsService(
        "52998224725",
        "02/01/1990",
        "5585999990000"
      )
    ).resolves.toEqual({ status: "IDENTITY_MISMATCH" });
    expect(QuarkAppointment.findAll).not.toHaveBeenCalled();
  });

  it("can verify the full patient name for the cancellation flow", async () => {
    await expect(
      ListPatientIntakeAppointmentsService(
        "52998224725",
        undefined,
        "5585999990000",
        "MARIA DA SILVA"
      )
    ).resolves.toEqual(
      expect.objectContaining({
        status: "FOUND",
        patientName: "Maria da Silva"
      })
    );
  });

  it("does not disclose appointments when the full patient name differs", async () => {
    await expect(
      ListPatientIntakeAppointmentsService(
        "52998224725",
        undefined,
        "5585999990000",
        "Outra Pessoa"
      )
    ).resolves.toEqual({ status: "IDENTITY_MISMATCH" });
    expect(QuarkAppointment.findAll).not.toHaveBeenCalled();
  });

  it("does not expose an appointment linked to another phone", async () => {
    await expect(
      ListPatientIntakeAppointmentsService(
        "52998224725",
        "01/01/1990",
        "5585888880000"
      )
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });
});
