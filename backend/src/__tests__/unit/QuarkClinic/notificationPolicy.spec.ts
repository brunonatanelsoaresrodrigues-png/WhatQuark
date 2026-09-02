import {
  appointmentStillMatchesNotification,
  quarkNotificationCanBeSent
} from "../../../services/QuarkClinicServices/notificationPolicy";

describe("QuarkClinic outbound notification policy", () => {
  it.each(["REMINDER", "MANUAL_REMINDER", "CANCELLED"])(
    "allows the intentional %s flow",
    eventType => {
      expect(quarkNotificationCanBeSent(eventType)).toBe(true);
    }
  );

  it.each(["CREATED", "UPDATED", "RESCHEDULED"])(
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
});
