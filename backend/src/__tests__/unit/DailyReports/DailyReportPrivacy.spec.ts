import {
  buildDailyReportCsv,
  maskManagerPhone
} from "../../../services/DailyReportServices/privacy";

describe("daily report privacy", () => {
  it("never exposes the complete manager phone in read models", () => {
    expect(maskManagerPhone("5585999991234")).toBe("+55 (85) *****-1234");
    expect(maskManagerPhone("5585999991234")).not.toContain("999991234");
  });

  it("exports only aggregate snapshot fields", () => {
    const csv = buildDailyReportCsv({
      attendance: { moved: 10 },
      messages: { received: 20 },
      appointments: { confirmed: 3 },
      alerts: { deadLetters: 0 },
      agents: [{ id: 7, name: "Atendente", messages: 5 }],
      dataQuality: { warnings: [] }
    });
    expect(csv).toContain('"attendance";"moved";"10"');
    expect(csv).not.toMatch(/\+?55\d{10,11}/);
  });
});
