import {
  appointmentStillMatchesNotification,
  quarkNotificationCanBeSent
} from "../../../services/QuarkClinicServices/notificationPolicy";

describe("QuarkClinic outbound notification policy", () => {
  it.each([
    "CREATED",
    "REMINDER",
    "MANUAL_REMINDER",
    "RESCHEDULED",
    "CANCELLED",
    "COVERAGE_RECOVERY"
  ])("allows the intentional %s flow", eventType => {
    expect(quarkNotificationCanBeSent(eventType)).toBe(true);
  });

  it.each(["UPDATED"])(
    "blocks automatic %s messages outside reminder windows",
    eventType => {
      expect(quarkNotificationCanBeSent(eventType)).toBe(false);
    }
  );

  it("accepts only the same still-scheduled appointment at delivery time", () => {
    const scheduledAt = new Date("2026-10-19T19:00:00.000Z");

    expect(
      appointmentStillMatchesNotification(
        "AGENDADO",
        scheduledAt,
        scheduledAt.toISOString()
      )
    ).toBe(true);
    expect(
      appointmentStillMatchesNotification(
        "CANCELADO",
        scheduledAt,
        scheduledAt.toISOString()
      )
    ).toBe(false);
    expect(
      appointmentStillMatchesNotification(
        "AGENDADO",
        new Date("2026-10-20T19:00:00.000Z"),
        scheduledAt.toISOString()
      )
    ).toBe(false);
  });

  it("allows a reschedule notice for a still-confirmed appointment", () => {
    const scheduledAt = new Date("2026-10-19T19:00:00.000Z");

    expect(
      appointmentStillMatchesNotification(
        "CONFIRMADO",
        scheduledAt,
        scheduledAt.toISOString(),
        "RESCHEDULED"
      )
    ).toBe(true);
    expect(
      appointmentStillMatchesNotification(
        "CONFIRMADO",
        new Date("2026-10-20T19:00:00.000Z"),
        scheduledAt.toISOString(),
        "RESCHEDULED"
      )
    ).toBe(false);
  });

  it.each(["CANCELADO", "CANCELADO_VIA_SMS", "EXCLUIDO"])(
    "allows a cancellation notice while the Quark status is %s",
    status => {
      const scheduledAt = new Date("2026-10-19T19:00:00.000Z");

      expect(
        appointmentStillMatchesNotification(
          status,
          scheduledAt,
          scheduledAt.toISOString(),
          "CANCELLED"
        )
      ).toBe(true);
      expect(
        appointmentStillMatchesNotification(
          "AGENDADO",
          scheduledAt,
          scheduledAt.toISOString(),
          "CANCELLED"
        )
      ).toBe(false);
    }
  );
});
