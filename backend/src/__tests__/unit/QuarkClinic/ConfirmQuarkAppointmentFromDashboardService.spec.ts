import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentNotification from "../../../models/QuarkAppointmentNotification";
import QuarkAppointmentResponse from "../../../models/QuarkAppointmentResponse";
import ConfirmQuarkAppointmentFromDashboardService from "../../../services/QuarkClinicServices/ConfirmQuarkAppointmentFromDashboardService";
import { getQuarkConfig } from "../../../services/QuarkClinicServices/config";
import { confirmQuarkAppointment } from "../../../services/QuarkClinicServices/QuarkClinicClient";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), update: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentNotification", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentResponse", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn()
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  confirmQuarkAppointment: jest.fn()
}));
jest.mock(
  "../../../services/QuarkClinicServices/RecordQuarkAppointmentEventService",
  () => jest.fn()
);
jest.mock("../../../services/QuarkClinicServices/dashboardEvents", () => ({
  emitQuarkDashboardUpdate: jest.fn()
}));

const localUpdate = jest.fn();
const auditUpdate = jest.fn();
const appointment = {
  id: 42,
  appointmentId: "quark-42",
  status: "AGENDADO",
  awaitingConfirmation: true,
  scheduledAt: new Date("2099-08-21T16:00:00-03:00"),
  update: localUpdate
};

describe("ConfirmQuarkAppointmentFromDashboardService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(appointment);
    (QuarkAppointment.update as jest.Mock).mockResolvedValue([1]);
    (QuarkAppointmentNotification.update as jest.Mock).mockResolvedValue([1]);
    (QuarkAppointmentResponse.create as jest.Mock).mockResolvedValue({
      id: 10,
      update: auditUpdate
    });
    (getQuarkConfig as jest.Mock).mockReturnValue({ baseUrl: "https://quark" });
    (confirmQuarkAppointment as jest.Mock).mockResolvedValue(undefined);
    localUpdate.mockResolvedValue(undefined);
    auditUpdate.mockResolvedValue(undefined);
  });

  it("confirms in Quark, audits the dashboard source and suppresses stale reminders", async () => {
    await expect(
      ConfirmQuarkAppointmentFromDashboardService({
        appointmentId: "quark-42"
      })
    ).resolves.toEqual({ confirmed: true, status: "CONFIRMADO" });

    expect(QuarkAppointment.update).toHaveBeenCalledWith(
      { status: "CONFIRMING", awaitingConfirmation: false },
      { where: { id: 42, status: "AGENDADO" } }
    );
    expect(confirmQuarkAppointment).toHaveBeenCalledWith(
      expect.any(Object),
      "quark-42"
    );
    expect(QuarkAppointmentResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: "quark-42",
        decision: "CONFIRMED",
        source: "DASHBOARD",
        status: "PROCESSING"
      })
    );
    expect(localUpdate).toHaveBeenCalledWith({
      status: "CONFIRMADO",
      awaitingConfirmation: false
    });
    expect(QuarkAppointmentNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SUPPRESSED" }),
      expect.objectContaining({
        where: expect.objectContaining({ appointmentId: "quark-42" })
      })
    );
  });

  it("restores the local scheduled state when Quark rejects the confirmation", async () => {
    (confirmQuarkAppointment as jest.Mock).mockRejectedValue(
      new Error("Quark unavailable")
    );

    await expect(
      ConfirmQuarkAppointmentFromDashboardService({
        appointmentId: "quark-42"
      })
    ).rejects.toEqual(expect.objectContaining({ statusCode: 502 }));
    expect(QuarkAppointment.update).toHaveBeenLastCalledWith(
      { status: "AGENDADO", awaitingConfirmation: true },
      { where: { id: 42, status: "CONFIRMING" } }
    );
    expect(auditUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED" })
    );
    expect(localUpdate).not.toHaveBeenCalled();
  });

  it("refuses an appointment that is already confirmed", async () => {
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue({
      ...appointment,
      status: "CONFIRMADO"
    });

    await expect(
      ConfirmQuarkAppointmentFromDashboardService({
        appointmentId: "quark-42"
      })
    ).rejects.toEqual(expect.objectContaining({ statusCode: 409 }));
    expect(confirmQuarkAppointment).not.toHaveBeenCalled();
  });
});
