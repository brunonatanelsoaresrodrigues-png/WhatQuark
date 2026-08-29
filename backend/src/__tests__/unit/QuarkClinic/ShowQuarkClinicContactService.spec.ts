import ShowQuarkClinicContactService from "../../../services/QuarkClinicServices/ShowQuarkClinicContactService";
import Contact from "../../../models/Contact";
import QuarkAppointment from "../../../models/QuarkAppointment";
import { getQuarkAppointment } from "../../../services/QuarkClinicServices/QuarkClinicClient";

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
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

describe("ShowQuarkClinicContactService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves the patient and CPF from the linked Quark appointment", async () => {
    const contact = {
      id: 10,
      number: "5511999990000",
      cpf: null,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Contact.findByPk as jest.Mock).mockResolvedValue(contact);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
      {
        appointmentId: "42",
        patientId: "7",
        patientName: "Paciente local",
        snapshot: JSON.stringify({})
      }
    ]);
    (getQuarkAppointment as jest.Mock).mockResolvedValue({
      id: 42,
      pacienteId: 7,
      nomePaciente: "Maria da Silva",
      cpf: "529.982.247-25",
      dataNascimento: "01/01/1990"
    });

    await expect(ShowQuarkClinicContactService("10")).resolves.toEqual(
      expect.objectContaining({
        contactId: 10,
        patientId: "7",
        patientName: "Maria da Silva",
        cpf: "52998224725",
        birthDate: "01/01/1990",
        appointmentId: "42"
      })
    );
    expect(contact.update).toHaveBeenCalledWith({ cpf: "52998224725" });
  });

  it("keeps the local CPF when Quark is temporarily unavailable", async () => {
    (Contact.findByPk as jest.Mock).mockResolvedValue({
      id: 10,
      number: "5511999990000",
      cpf: null,
      update: jest.fn().mockResolvedValue(undefined)
    });
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
      {
        appointmentId: "42",
        patientId: "7",
        patientName: "Maria da Silva",
        snapshot: JSON.stringify({ cpf: "52998224725" })
      }
    ]);
    await expect(ShowQuarkClinicContactService("10")).resolves.toEqual(
      expect.objectContaining({ cpf: "52998224725" })
    );
    expect(getQuarkAppointment).not.toHaveBeenCalled();
  });
});
