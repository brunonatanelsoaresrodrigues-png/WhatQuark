import ShowQuarkClinicPatientService from "../../../services/QuarkClinicServices/ShowQuarkClinicPatientService";
import QuarkAppointment from "../../../models/QuarkAppointment";
import { getQuarkAppointment } from "../../../services/QuarkClinicServices/QuarkClinicClient";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn(() => ({ timezone: "America/Sao_Paulo" }))
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  getQuarkAppointment: jest.fn()
}));

it("shows a patient registration linked to the local Quark mirror", async () => {
  (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
    {
      appointmentId: "42",
      patientId: "7",
      patientName: "Maria da Silva",
      snapshot: JSON.stringify({ cpf: "52998224725" })
    }
  ]);
  (getQuarkAppointment as jest.Mock).mockResolvedValue({
    id: 42,
    pacienteId: 7,
    nomePaciente: "Maria da Silva",
    cpf: "52998224725"
  });
  await expect(ShowQuarkClinicPatientService("7")).resolves.toEqual(
    expect.objectContaining({
      patientId: "7",
      patientName: "Maria da Silva",
      cpf: "52998224725",
      appointmentId: "42"
    })
  );
});
