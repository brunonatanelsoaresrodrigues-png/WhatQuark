import {
  DEFAULT_INACTIVITY_MESSAGE,
  INACTIVITY_CLOSE_REASON
} from "../../../services/TicketInactivityServices/config";

describe("ticket inactivity message", () => {
  it("uses the approved Essencial Saúde closing copy", () => {
    expect(DEFAULT_INACTIVITY_MESSAGE)
      .toBe(`Seu atendimento será encerrado por falta de interação.

Caso ainda precise de ajuda, basta enviar uma nova mensagem para iniciarmos outro atendimento.

A Essencial Saúde agradece pelo contato e permanece à disposição! 💚`);
    expect(INACTIVITY_CLOSE_REASON).toBe(
      "Sem retorno do paciente — 15 minutos"
    );
  });
});
