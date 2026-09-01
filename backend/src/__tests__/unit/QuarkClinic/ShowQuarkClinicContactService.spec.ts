import ShowQuarkClinicContactService from "../../../services/QuarkClinicServices/ShowQuarkClinicContactService";
import Contact from "../../../models/Contact";
import QuarkAppointment from "../../../models/QuarkAppointment";
import {
  getQuarkAppointment,
  getQuarkPatient
} from "../../../services/QuarkClinicServices/QuarkClinicClient";
import { Op } from "sequelize";

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
  getQuarkAppointment: jest.fn(),
  getQuarkPatient: jest.fn()
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
        appointmentId: "invalid",
        patientId: "null",
        patientName: "Registro sem paciente",
        snapshot: JSON.stringify({})
      },
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
    expect(getQuarkPatient).not.toHaveBeenCalled();
  });

  it("loads the CPF from the patient registration when the appointment omits it", async () => {
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
      nomePaciente: "Maria da Silva"
    });
    (getQuarkPatient as jest.Mock).mockResolvedValue({
      id: 7,
      nome: "Maria da Silva",
      cpf: "529.982.247-25",
      dataNascimento: "01/01/1990"
    });

    await expect(ShowQuarkClinicContactService("10")).resolves.toEqual(
      expect.objectContaining({
        patientId: "7",
        patientName: "Maria da Silva",
        cpf: "52998224725",
        birthDate: "01/01/1990"
      })
    );
    expect(getQuarkPatient).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: "America/Sao_Paulo" }),
      "7"
    );
    expect(contact.update).toHaveBeenCalledWith({ cpf: "52998224725" });
    expect(QuarkAppointment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          [Op.or]: expect.arrayContaining([
            { phone: { [Op.in]: ["5511999990000", "551199990000"] } }
          ])
        })
      })
    );
  });

  it("matches a Quark patient stored with the Brazilian ninth digit", async () => {
    const contact = {
      id: 881,
      number: "558592413638",
      cpf: null,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Contact.findByPk as jest.Mock).mockResolvedValue(contact);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
      {
        appointmentId: "466160802",
        patientId: "177569708",
        patientName: "ANTONIO GLEUTON CRAVO MENDONCA",
        snapshot: JSON.stringify({})
      }
    ]);
    (getQuarkAppointment as jest.Mock).mockResolvedValue({
      id: 466160802,
      pacienteId: 177569708,
      nomePaciente: "ANTONIO GLEUTON CRAVO MENDONCA"
    });
    (getQuarkPatient as jest.Mock).mockResolvedValue({
      id: 177569708,
      nome: "ANTONIO GLEUTON CRAVO MENDONCA",
      cpf: "049.647.324-98"
    });

    await expect(ShowQuarkClinicContactService("881")).resolves.toEqual(
      expect.objectContaining({
        patientId: "177569708",
        cpf: "04964732498"
      })
    );
    expect(QuarkAppointment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          [Op.or]: expect.arrayContaining([
            {
              phone: {
                [Op.in]: ["558592413638", "5585992413638"]
              }
            }
          ])
        })
      })
    );
    expect(contact.update).toHaveBeenCalledWith({ cpf: "04964732498" });
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
    expect(getQuarkPatient).not.toHaveBeenCalled();
  });

  it("refuses to import a CPF when the phone belongs to multiple patients", async () => {
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
        patientName: "Paciente um",
        snapshot: JSON.stringify({ cpf: "52998224725" })
      },
      {
        appointmentId: "43",
        patientId: "8",
        patientName: "Paciente dois",
        snapshot: JSON.stringify({ cpf: "11144477735" })
      }
    ]);

    await expect(ShowQuarkClinicContactService("10")).rejects.toMatchObject({
      message: "ERR_QUARK_PATIENT_AMBIGUOUS",
      statusCode: 409
    });
    expect(contact.update).not.toHaveBeenCalled();
    expect(getQuarkAppointment).not.toHaveBeenCalled();
    expect(getQuarkPatient).not.toHaveBeenCalled();
  });
});
