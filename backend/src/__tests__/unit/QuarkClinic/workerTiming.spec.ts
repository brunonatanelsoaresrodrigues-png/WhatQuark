import { QuarkConfig } from "../../../services/QuarkClinicServices/config";
import {
  quietHoursDelayMs,
  randomSendIntervalMs
} from "../../../services/QuarkClinicServices/workerTiming";

const config = {
  sendIntervalMinMs: 15000,
  sendIntervalMaxMs: 45000,
  quietHoursStart: "20:00",
  quietHoursEnd: "08:00",
  timezone: "America/Sao_Paulo"
} as QuarkConfig;

describe("QuarkClinic worker timing", () => {
  it("always picks a fresh interval inside the configured inclusive range", () => {
    const values = Array.from({ length: 100 }, () =>
      randomSendIntervalMs(config)
    );

    expect(Math.min(...values)).toBeGreaterThanOrEqual(15000);
    expect(Math.max(...values)).toBeLessThanOrEqual(45000);
  });

  it("pauses during cross-midnight quiet hours", () => {
    const atNinePmSaoPaulo = new Date("2026-08-21T00:00:00.000Z");
    const delay = quietHoursDelayMs(config, atNinePmSaoPaulo);

    expect(delay).toBe(11 * 60 * 60 * 1000);
  });

  it("does not pause outside quiet hours", () => {
    const atNoonSaoPaulo = new Date("2026-08-20T15:00:00.000Z");

    expect(quietHoursDelayMs(config, atNoonSaoPaulo)).toBe(0);
  });

  it("releases the queue exactly when quiet hours end", () => {
    const oneMinuteBefore = new Date("2026-08-20T10:59:00.000Z");
    const atEightAm = new Date("2026-08-20T11:00:00.000Z");

    expect(quietHoursDelayMs(config, oneMinuteBefore)).toBe(60 * 1000);
    expect(quietHoursDelayMs(config, atEightAm)).toBe(0);
  });
});
