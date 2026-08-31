import redactSensitiveText from "../../../services/AiAssistantServices/redactSensitiveText";

describe("redactSensitiveText", () => {
  it("removes CPF, phone, email and the patient name", () => {
    const result = redactSensitiveText(
      "Maria Silva, CPF 123.456.789-01, telefone +55 (85) 99999-1234 e maria@example.com",
      "Maria Silva"
    );
    expect(result.text).not.toContain("123.456.789-01");
    expect(result.text).not.toContain("99999-1234");
    expect(result.text).not.toContain("maria@example.com");
    expect(result.text).not.toContain("Maria Silva");
    expect(result.removed.sort()).toEqual(["cpf", "email", "nome", "telefone"]);
  });

  it("preserves dates and appointment times", () => {
    const result = redactSensitiveText("Consulta em 01/09/2026 às 08:00.");
    expect(result.text).toBe("Consulta em 01/09/2026 às 08:00.");
    expect(result.removed).toEqual([]);
  });

  it("removes long WhatsApp technical identifiers", () => {
    const result = redactSensitiveText("Contato 276299574685761");
    expect(result.text).toContain("[TELEFONE REMOVIDO]");
  });
});
