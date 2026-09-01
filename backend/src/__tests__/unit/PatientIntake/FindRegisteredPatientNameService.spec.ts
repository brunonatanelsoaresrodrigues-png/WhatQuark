import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentRecipient from "../../../models/QuarkAppointmentRecipient";
import FindRegisteredPatientNameService from "../../../services/PatientIntakeServices/FindRegisteredPatientNameService";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentRecipient", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

describe("FindRegisteredPatientNameService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses the first name when the phone belongs to one Quark patient", async () => {
    (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([
      { appointmentId: "10" },
      { appointmentId: "11" }
    ]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
      { patientId: "7", patientName: "MARIA DA SILVA" },
      { patientId: "7", patientName: "MARIA DA SILVA" }
    ]);

    await expect(
      FindRegisteredPatientNameService("+55 (11) 99999-0000")
    ).resolves.toBe("Maria");
  });

  it("keeps the greeting generic when a phone is shared by patients", async () => {
    (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([
      { appointmentId: "10" },
      { appointmentId: "11" }
    ]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
      { patientId: "7", patientName: "MARIA DA SILVA" },
      { patientId: "8", patientName: "JOÃO DA SILVA" }
    ]);

    await expect(
      FindRegisteredPatientNameService("5511999990000")
    ).resolves.toBeUndefined();
  });

  it("keeps the greeting generic for an unknown phone", async () => {
    (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([]);

    await expect(
      FindRegisteredPatientNameService("5511888880000")
    ).resolves.toBeUndefined();
    expect(QuarkAppointment.findAll).not.toHaveBeenCalled();
  });
});
