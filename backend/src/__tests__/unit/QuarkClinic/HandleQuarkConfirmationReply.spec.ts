import { Op } from "sequelize";
import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import QuarkAppointmentRecipient from "../../../models/QuarkAppointmentRecipient";
import QuarkAppointmentResponse from "../../../models/QuarkAppointmentResponse";
import Message from "../../../models/Message";
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
  default: { findAll: jest.fn(), findOne: jest.fn(), update: jest.fn() }
}));

jest.mock("../../../models/QuarkAppointmentRecipient", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../../../models/QuarkAppointmentResponse", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
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
jest.mock(
  "../../../services/QuarkClinicServices/RecordQuarkAppointmentEventService",
  () => jest.fn()
);

jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () =>
  jest.fn()
);

const appointment = (id: number, hour: number) => ({
  id,
  appointmentId: String(id),
  patientName: `Paciente ${id}`,
  snapshot: JSON.stringify({ profissionalNome: `Profissional ${id}` }),
  scheduledAt: new Date(2099, 0, 1, hour, 0),
  update: jest.fn().mockResolvedValue(undefined)
});

describe("HandleQuarkConfirmationReply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (QuarkAppointmentNotification.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([]);
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
    (Message.findOne as jest.Mock).mockResolvedValue(null);
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
      expect.objectContaining({
        body: expect.stringMatching(
          /Consulta confirmada com sucesso[\s\S]*Profissional 10\nAtendimento por ordem de chegada/
        )
      })
    );
  });

  it("accepts confirmation from an alternate phone linked to the appointment", async () => {
    const pending = appointment(10, 9);
    (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([
      { appointmentId: "10" }
    ]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([pending]);

    await HandleQuarkConfirmationReply({
      body: "SIM",
      phone: "5585988880000",
      ticket: {} as any,
      whatsappId: 1
    });

    const { where } = (QuarkAppointment.findAll as jest.Mock).mock.calls[0][0];
    expect(where[Op.or]).toContainEqual({
      appointmentId: { [Op.in]: ["10"] }
    });
    expect(confirmQuarkAppointment).toHaveBeenCalledWith(
      expect.any(Object),
      "10"
    );
    expect(QuarkAppointmentResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipientPhone: "5585988880000" })
    );
  });

  it("confirms from the ticket that received the reminder even when the old phone mapping is inactive", async () => {
    const pending = appointment(10, 9);
    (QuarkAppointmentNotification.findAll as jest.Mock).mockResolvedValue([
      {
        appointmentId: "10",
        payload: JSON.stringify({ requestsConfirmation: true })
      }
    ]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([pending]);

    await HandleQuarkConfirmationReply({
      body: "1",
      phone: "5585988880000",
      ticket: { id: 321 } as any,
      whatsappId: 1
    });

    const { where } = (QuarkAppointment.findAll as jest.Mock).mock.calls[0][0];
    expect(where[Op.or]).toContainEqual({
      appointmentId: { [Op.in]: ["10"] }
    });
    expect(confirmQuarkAppointment).toHaveBeenCalledWith(
      expect.any(Object),
      "10"
    );
  });

  it("uses a reply quoted to the exact reminder as confirmation context", async () => {
    const pending = appointment(10, 9);
    (QuarkAppointmentNotification.findAll as jest.Mock).mockResolvedValue([
      {
        id: 99,
        appointmentId: "10",
        messageId: "reminder-10",
        payload: JSON.stringify({ requestsConfirmation: true }),
        sentAt: new Date()
      }
    ]);
    (Message.findOne as jest.Mock).mockResolvedValue({ id: "human-message" });
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([pending]);

    await expect(
      HandleQuarkConfirmationReply({
        body: "1",
        phone: "5585988880000",
        ticket: { id: 321 } as any,
        whatsappId: 1,
        message: {
          id: "patient-reply",
          quotedMsgId: "reminder-10",
          createdAt: new Date()
        } as any
      })
    ).resolves.toBe(true);

    expect(confirmQuarkAppointment).toHaveBeenCalledWith(
      expect.any(Object),
      "10"
    );
    const { where } = (QuarkAppointment.findAll as jest.Mock).mock.calls[0][0];
    expect(where).toEqual(
      expect.objectContaining({
        appointmentId: { [Op.in]: ["10"] }
      })
    );
    expect(where[Op.or]).toBeUndefined();
  });

  it("does not treat an unrelated short reply to an attendant as a Quark decision", async () => {
    (QuarkAppointmentNotification.findAll as jest.Mock).mockResolvedValue([
      {
        id: 99,
        appointmentId: "10",
        messageId: "reminder-10",
        payload: JSON.stringify({ requestsConfirmation: true }),
        sentAt: new Date()
      }
    ]);
    (Message.findOne as jest.Mock).mockResolvedValue({ id: "human-message" });

    await expect(
      HandleQuarkConfirmationReply({
        body: "sim",
        phone: "5585988880000",
        ticket: { id: 321 } as any,
        whatsappId: 1,
        message: {
          id: "patient-reply",
          quotedMsgId: null,
          createdAt: new Date()
        } as any
      })
    ).resolves.toBe(false);

    expect(QuarkAppointment.findAll).not.toHaveBeenCalled();
    expect(confirmQuarkAppointment).not.toHaveBeenCalled();
    expect(cancelQuarkAppointment).not.toHaveBeenCalled();
  });

  it("accepts an explicit attendance phrase when a valid reminder exists in the ticket", async () => {
    const pending = appointment(10, 9);
    (QuarkAppointmentNotification.findAll as jest.Mock).mockResolvedValue([
      {
        id: 99,
        appointmentId: "10",
        messageId: "reminder-10",
        payload: JSON.stringify({ requestsConfirmation: true }),
        sentAt: new Date()
      }
    ]);
    (Message.findOne as jest.Mock).mockResolvedValue({ id: "human-message" });
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([pending]);

    await expect(
      HandleQuarkConfirmationReply({
        body: "Ok, eu vou",
        phone: "5585988880000",
        ticket: { id: 321 } as any,
        whatsappId: 1,
        message: {
          id: "patient-reply",
          quotedMsgId: null,
          createdAt: new Date()
        } as any
      })
    ).resolves.toBe(true);

    expect(confirmQuarkAppointment).toHaveBeenCalledWith(
      expect.any(Object),
      "10"
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
      expect.objectContaining({
        body: expect.stringMatching(/Paciente 10[\s\S]*Paciente 20[\s\S]*SIM 1/)
      })
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
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.stringContaining("Atendimento por ordem de chegada")
      })
    );
  });
});
