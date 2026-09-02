import {
  nextBusinessFollowUpAt,
  noShowInitialAttemptAt
} from "../../../services/QuarkClinicServices/recoveryTiming";

describe("QuarkClinic no-show recovery timing", () => {
  it("waits thirty minutes before the first recovery message", () => {
    const now = new Date("2026-09-02T13:00:00.000Z");
    expect(noShowInitialAttemptAt(now).toISOString()).toBe(
      "2026-09-02T13:30:00.000Z"
    );
  });

  it("schedules the follow-up for 09:00 on the next weekday", () => {
    expect(
      nextBusinessFollowUpAt(
        new Date("2026-09-02T15:00:00.000Z"),
        "America/Sao_Paulo"
      ).toISOString()
    ).toBe("2026-09-03T12:00:00.000Z");
  });

  it("skips the weekend for a Friday no-show", () => {
    expect(
      nextBusinessFollowUpAt(
        new Date("2026-09-04T15:00:00.000Z"),
        "America/Sao_Paulo"
      ).toISOString()
    ).toBe("2026-09-07T12:00:00.000Z");
  });
});
