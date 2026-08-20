import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import QuarkAppointmentResponse from "../../../models/QuarkAppointmentResponse";
import HandleQuarkConfirmationReply from "../../../services/QuarkClinicServices/HandleQuarkConfirmationReply";
import {
  cancelQuarkAppointment,
  confirmQuarkAppointment
} from "../../../services/QuarkClinicServices/QuarkClinicClient";
import SendWhatsAppMessage from "../../../services/WbotServices/SendWhatsAppMessage";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn() }
}));

jest.mock("../../../models/QuarkAppointmentResponse", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));

jest.mock("../../../services/QuarkClinicServices/dashboardEvents", () => ({
  emitQuarkDashboardUpdate: jest.fn()
}));

jest.mock("../../../services/QuarkClinicServices/config", () => ({
  isQuarkIntegrationEnabled: jest.fn(() => true),
  getQuarkConfig: jest.fn(() => ({
    defaultCountryCode: "55",
    cancelReason: "Cancelado pelo paciente"
  }))
}));

jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  confirmQuarkAppointment: jest.fn(),
  cancelQuarkAppointment: jest.fn()
}));

jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);

const appointment = (id: number, hour: number) => ({
  id,
  appointmentId: String(id),
  snapshot: JSON.stringify({ profissionalNome: `Profissional ${id}` }),
  scheduledAt: new Date(2099, 0, 1, hour, 0),
  update: jest.fn().mockResolvedValue(undefined)
});

describe("HandleQuarkConfirmationReply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(null);
    (QuarkAppointment.update as jest.Mock).mockResolvedValue([1]);
    (QuarkAppointmentNotification.update as jest.Mock).mockResolvedValue([0]);
    (QuarkAppointmentNotification.findOne as jest.Mock).mockResolvedValue({
      id: 99,
      sentAt: new Date()
    });
    (QuarkAppointmentResponse.create as jest.Mock).mockResolvedValue({
      id: 1,
      update: jest.fn().mockResolvedValue(undefined)
    });
    (SendWhatsAppMessage as jest.Mock).mockResolvedValue({});
  });

  it("confirms the only pending appointment when the patient replies SIM", async () => {
    const pending = appointment(10, 9);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([pending]);

    await expect(
      HandleQuarkConfirmationReply({
        body: "Sim, confirmo",
        phone: "5585999990000",
        ticket: {} as any,
        whatsappId: 1
      })
    ).resolves.toBe(true);

    expect(confirmQuarkAppointment).toHaveBeenCalledWith(
      expect.any(Object),
      "10"
    );
    expect(cancelQuarkAppointment).not.toHaveBeenCalled();
    expect(QuarkAppointmentResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "10",
        decision: "CONFIRMED",
        status: "PROCESSING"
      })
    );
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("confirmada") })
    );
  });

  it("asks for an appointment number when the phone has multiple pending appointments", async () => {
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
      appointment(10, 9),
      appointment(20, 10)
    ]);

    await HandleQuarkConfirmationReply({
      body: "SIM",
      phone: "5585999990000",
      ticket: {} as any,
      whatsappId: 1
    });

    expect(confirmQuarkAppointment).not.toHaveBeenCalled();
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("SIM 1") })
    );
  });

  it("does not reopen a confirmed appointment when only the acknowledgement send fails", async () => {
    const pending = appointment(10, 9);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([pending]);
    (SendWhatsAppMessage as jest.Mock).mockRejectedValueOnce(
      new Error("temporary WhatsApp failure")
    );

    await expect(
      HandleQuarkConfirmationReply({
        body: "SIM",
        phone: "5585999990000",
        ticket: {} as any,
        whatsappId: 1
      })
    ).resolves.toBe(true);

    expect(confirmQuarkAppointment).toHaveBeenCalled();
    expect(pending.update).toHaveBeenCalledWith({ status: "CONFIRMADO" });
    expect(pending.update).not.toHaveBeenCalledWith({
      awaitingConfirmation: true
    });
  });

  it("cancels the selected appointment when the patient replies NÃO 2", async () => {
    const first = appointment(10, 9);
    const second = appointment(20, 10);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([first, second]);

    await HandleQuarkConfirmationReply({
      body: "NÃO 2",
      phone: "5585999990000",
      ticket: {} as any,
      whatsappId: 1
    });

    expect(cancelQuarkAppointment).toHaveBeenCalledWith(
      expect.any(Object),
      "20"
    );
    expect(second.update).toHaveBeenCalledWith({ status: "CANCELADO" });
    expect(QuarkAppointmentResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "20",
        decision: "CANCELLED"
      })
    );
  });
});
