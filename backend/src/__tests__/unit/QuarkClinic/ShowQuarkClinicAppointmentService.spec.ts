import AppError from "../../../errors/AppError";
import QuarkAppointment from "../../../models/QuarkAppointment";
import ShowQuarkClinicAppointmentService from "../../../services/QuarkClinicServices/ShowQuarkClinicAppointmentService";
import { getQuarkConfig } from "../../../services/QuarkClinicServices/config";
import { getQuarkAppointment } from "../../../services/QuarkClinicServices/QuarkClinicClient";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn()
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  getQuarkAppointment: jest.fn()
}));

const config = {
  defaultCountryCode: "55",
  timezone: "America/Sao_Paulo"
} as any;

describe("ShowQuarkClinicAppointmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getQuarkConfig as jest.Mock).mockReturnValue(config);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      appointmentId: "FE830EC3"
    });
    (getQuarkAppointment as jest.Mock).mockResolvedValue({
      id: "FE830EC3",
      nomePaciente: "Julia Ribeiro",
      dataAgendamento: "29-09-2026",
      horaAgendamento: "15:00:00",
      statusMarcacao: "AGENDADO",
      clinicaNome: "Essencial Saúde",
      profissional: { nome: "Dra. Ana" },
      procedimento: { nome: "Consulta" },
      especialidade: { nome: "Clínica geral" }
    });
  });

  it("returns the exact appointment refreshed from Quark", async () => {
    await expect(
      ShowQuarkClinicAppointmentService("FE830EC3")
    ).resolves.toEqual(
      expect.objectContaining({
        appointmentId: "FE830EC3",
        patientName: "Julia Ribeiro",
        scheduledAt: "2026-09-29T18:00:00.000Z",
        status: "AGENDADO",
        clinicName: "Essencial Saúde",
        professionalName: "Dra. Ana",
        procedureName: "Consulta",
        specialtyName: "Clínica geral",
        clinicTimezone: "America/Sao_Paulo"
      })
    );
    expect(getQuarkAppointment).toHaveBeenCalledWith(config, "FE830EC3");
  });

  it("does not query arbitrary appointment IDs absent from the local sync", async () => {
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(null);

    await expect(ShowQuarkClinicAppointmentService("UNKNOWN")).rejects.toEqual(
      expect.any(AppError)
    );
    expect(getQuarkAppointment).not.toHaveBeenCalled();
  });

  it.each(["", "abc/123", "x".repeat(65)])(
    "rejects an invalid appointment ID",
    async appointmentId => {
      await expect(
        ShowQuarkClinicAppointmentService(appointmentId)
      ).rejects.toEqual(expect.any(AppError));
      expect(QuarkAppointment.findOne).not.toHaveBeenCalled();
    }
  );
});
