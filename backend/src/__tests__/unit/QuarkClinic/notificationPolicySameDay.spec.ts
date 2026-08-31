import {
  isSameDayReschedule,
  quarkNotificationExpiresAt
} from "../../../services/QuarkClinicServices/notificationPolicy";

const timezone = "America/Sao_Paulo";

describe("same-day reschedule notification policy", () => {
  it("keeps a reschedule deliverable until the end of the clinic day", () => {
    const scheduledAt = new Date("2026-08-31T17:00:00.000Z");
    const changedAt = new Date("2026-08-31T17:54:06.000Z");

    expect(
      isSameDayReschedule("RESCHEDULED", scheduledAt, changedAt, timezone)
    ).toBe(true);
    expect(
      quarkNotificationExpiresAt(
        "RESCHEDULED",
        scheduledAt.toISOString(),
        changedAt,
        timezone
      )
    ).toBe("2026-09-01T03:00:00.000Z");
  });

  it("does not extend reminders or reschedules from another day", () => {
    const scheduledAt = new Date("2026-08-30T17:00:00.000Z");
    const changedAt = new Date("2026-08-31T17:54:06.000Z");

    expect(
      quarkNotificationExpiresAt(
        "REMINDER",
        scheduledAt.toISOString(),
        changedAt,
        timezone
      )
    ).toBe(scheduledAt.toISOString());
    expect(
      quarkNotificationExpiresAt(
        "RESCHEDULED",
        scheduledAt.toISOString(),
        changedAt,
        timezone
      )
    ).toBe(scheduledAt.toISOString());
  });
});
