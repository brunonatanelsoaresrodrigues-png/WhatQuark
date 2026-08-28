import {
  greetingForTime,
  initialMenuMessage
} from "../../../services/PatientIntakeServices/messages";

describe("Patient intake greeting", () => {
  it("uses Bom dia in the morning in Sao Paulo", () => {
    expect(greetingForTime(new Date("2026-08-21T11:00:00.000Z"))).toBe(
      "Bom dia"
    );
  });

  it("uses Boa tarde in the afternoon in Sao Paulo", () => {
    expect(greetingForTime(new Date("2026-08-21T18:00:00.000Z"))).toBe(
      "Boa tarde"
    );
  });

  it("uses Boa noite in the evening in Sao Paulo", () => {
    expect(greetingForTime(new Date("2026-08-22T00:00:00.000Z"))).toBe(
      "Boa noite"
    );
  });

  it("includes the dynamic greeting and all six menu options", () => {
    const body = initialMenuMessage(
      new Date("2026-08-21T11:00:00.000Z"),
      "America/Sao_Paulo",
      "Maria"
    );

    expect(body).toContain("Bom dia, Maria!");
    expect(body).toContain("1️⃣ Marcar uma consulta");
    expect(body).toContain("6️⃣ Falar com um atendente");
  });
});
