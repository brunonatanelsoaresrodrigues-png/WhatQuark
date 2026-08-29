import { Op } from "sequelize";
import QuarkAppointment from "../../../models/QuarkAppointment";
import QuarkAppointmentRecipient from "../../../models/QuarkAppointmentRecipient";
import ListContactAppointmentsService from "../../../services/QuarkClinicServices/ListContactAppointmentsService";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/QuarkAppointmentRecipient", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

describe("ListContactAppointmentsService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the last and upcoming appointments for every linked phone", async () => {
    const phone = "5585999990000";
    const now = new Date("2026-08-28T15:00:00.000Z");
    const upcoming = {
      appointmentId: "future",
      scheduledAt: new Date("2026-09-02T12:30:00.000Z"),
      status: "CONFIRMADO",
      scheduleFingerprint: "a".repeat(64)
    } as QuarkAppointment;
    const last = {
      appointmentId: "past",
      scheduledAt: new Date("2026-08-20T12:30:00.000Z"),
      status: "AGENDADO",
      scheduleFingerprint: "b".repeat(64)
    } as QuarkAppointment;
    (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([
      { appointmentId: "future" },
      { appointmentId: "past" }
    ]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([upcoming]);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(last);

    const result = await ListContactAppointmentsService({ phone, now });

    expect(result.appointments).toEqual([
      expect.objectContaining({ appointmentId: "future" })
    ]);
    expect(result.lastAppointment).toEqual(
      expect.objectContaining({ appointmentId: "past" })
    );
    expect(result.serverNow).toBe(now.toISOString());
    expect(result.clinicTimezone).toBe("America/Sao_Paulo");

    const futureWhere = (QuarkAppointment.findAll as jest.Mock).mock.calls[0][0]
      .where;
    expect(futureWhere[Op.or]).toEqual([
      { phone },
      { appointmentId: { [Op.in]: ["future", "past"] } }
    ]);
    expect(futureWhere.status[Op.notIn]).toEqual([
      "CANCELADO",
      "CANCELADO_VIA_SMS",
      "EXCLUIDO"
    ]);
    expect(futureWhere.scheduledAt[Op.gte]).toBe(now);

    const pastWhere = (QuarkAppointment.findOne as jest.Mock).mock.calls[0][0]
      .where;
    expect(pastWhere.scheduledAt[Op.lt]).toBe(now);
  });

  it("keeps the last appointment empty for a new patient", async () => {
    (QuarkAppointmentRecipient.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([]);
    (QuarkAppointment.findOne as jest.Mock).mockResolvedValue(null);

    const result = await ListContactAppointmentsService({
      phone: "5511888880000",
      now: new Date("2026-08-28T15:00:00.000Z")
    });

    expect(result.appointments).toEqual([]);
    expect(result.lastAppointment).toBeNull();
  });
});
