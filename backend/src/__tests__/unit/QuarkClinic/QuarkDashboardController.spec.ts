import { confirmAppointment } from "../../../controllers/QuarkDashboardController";
import ConfirmQuarkAppointmentFromDashboardService from "../../../services/QuarkClinicServices/ConfirmQuarkAppointmentFromDashboardService";
import EnsureQuarkAutomationAccessService from "../../../services/QuarkClinicServices/EnsureQuarkAutomationAccessService";

jest.mock(
  "../../../services/QuarkClinicServices/ConfirmQuarkAppointmentFromDashboardService",
  () => jest.fn()
);
jest.mock(
  "../../../services/QuarkClinicServices/EnsureQuarkAutomationAccessService",
  () => jest.fn()
);

describe("QuarkDashboardController.confirmAppointment", () => {
  const response = {
    json: jest.fn()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (EnsureQuarkAutomationAccessService as jest.Mock).mockResolvedValue(
      undefined
    );
    (ConfirmQuarkAppointmentFromDashboardService as jest.Mock).mockResolvedValue(
      { confirmed: true, status: "CONFIRMADO" }
    );
    response.json.mockReturnValue(response);
  });

  it("allows a user with explicit Quark access and records the actor", async () => {
    const request = {
      params: { appointmentId: "42" },
      user: { id: "9", profile: "user" }
    } as any;

    await expect(confirmAppointment(request, response)).resolves.toBe(response);

    expect(EnsureQuarkAutomationAccessService).toHaveBeenCalledWith({
      userId: "9",
      profile: "user"
    });
    expect(ConfirmQuarkAppointmentFromDashboardService).toHaveBeenCalledWith({
      appointmentId: "42",
      actorUserId: 9
    });
  });

  it("does not confirm when the user lacks Quark access", async () => {
    (EnsureQuarkAutomationAccessService as jest.Mock).mockRejectedValue(
      new Error("ERR_NO_PERMISSION")
    );
    const request = {
      params: { appointmentId: "42" },
      user: { id: "10", profile: "user" }
    } as any;

    await expect(confirmAppointment(request, response)).rejects.toThrow(
      "ERR_NO_PERMISSION"
    );
    expect(ConfirmQuarkAppointmentFromDashboardService).not.toHaveBeenCalled();
  });
});
