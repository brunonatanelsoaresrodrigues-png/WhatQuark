import {
  coverageInformationMessage,
  greetingForTime,
  initialMenuMessage,
  professionalOptionsMessage
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

  it("includes the dynamic greeting, service options and explicit notice consent", () => {
    const body = initialMenuMessage(
      new Date("2026-08-21T11:00:00.000Z"),
      "America/Sao_Paulo",
      "Maria"
    );

    expect(body).toContain("Bom dia, Maria!");
    expect(body).toContain("1️⃣ Marcar uma consulta");
    expect(body).toContain("2️⃣ Confirmar ou remarcar uma consulta");
    expect(body).not.toContain("Consultar horários disponíveis");
    expect(body).toContain("5️⃣ Falar com um atendente");
    expect(body).toContain("6️⃣ Ativar avisos de consulta neste número");
    expect(body).toContain("você autoriza lembretes e avisos");
  });

  it("lists only named professionals", () => {
    const body = professionalOptionsMessage(["Dra. Maria", "Dr. João"]);

    expect(body).toContain("1️⃣ Dra. Maria");
    expect(body).toContain("2️⃣ Dr. João");
    expect(body).not.toContain("Primeiro profissional disponível");
  });

  it("shows the supplied private prices and sends scheduling to an attendant", () => {
    const body = coverageInformationMessage("PRIVATE");

    expect(body).toContain("Psiquiatria — R$ 350,00");
    expect(body).toContain("Anamnese — R$ 100,00");
    expect(body).toContain("Sessões — R$ 80,00 cada");
    expect(body).toContain("Laudo — particular — R$ 450,00");
    expect(body).toContain("falar com um atendente para agendar");
  });
});
