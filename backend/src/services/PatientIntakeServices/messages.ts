const hourInTimezone = (value: Date, timezone: string): number => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });
  const hour = Number(
    formatter.formatToParts(value).find(part => part.type === "hour")?.value ||
      0
  );
  return hour % 24;
};

export const greetingForTime = (
  value = new Date(),
  timezone = "America/Sao_Paulo"
): "Bom dia" | "Boa tarde" | "Boa noite" => {
  const hour = hourInTimezone(value, timezone);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
};

export const initialMenuMessage = (
  value = new Date(),
  timezone = "America/Sao_Paulo",
  registeredFirstName?: string
): string => `${greetingForTime(value, timezone)}${
  registeredFirstName ? `, ${registeredFirstName}` : ""
}! 👋 Seja bem-vindo(a) à *Essencial Saúde*.

Será um prazer atender você! 💚

Para começarmos, escolha uma opção:

1️⃣ Marcar uma consulta
2️⃣ Consultar horários disponíveis
3️⃣ Confirmar ou remarcar uma consulta
4️⃣ Cancelar uma consulta
5️⃣ Informações sobre convênios e valores
6️⃣ Falar com um atendente

Digite apenas o número da opção desejada.`;

export const CPF_PROMPT = `Para iniciarmos, informe o *CPF do paciente*.

Digite somente os 11 números.`;

export const NAME_PROMPT = `Agora informe o *nome completo do paciente*.`;

export const BIRTH_DATE_PROMPT = `Informe a *data de nascimento do paciente* no formato DD/MM/AAAA.`;

export const SPECIALTY_PROMPT = `Qual especialidade você deseja?

1️⃣ Psiquiatria
2️⃣ Psicologia
3️⃣ Laudo — particular

Digite apenas o número da opção desejada.`;

export const PROFESSIONAL_PREFERENCE_PROMPT = `Você deseja atendimento com algum profissional específico?

1️⃣ Sim, já tenho preferência
2️⃣ Não, pode ser o primeiro disponível

Digite apenas o número da opção desejada.`;

export const PROFESSIONAL_NAME_PROMPT = `Informe o *nome do profissional* de sua preferência.`;

export const PAYMENT_PROMPT = `O atendimento será:

1️⃣ Particular
2️⃣ Por convênio

Digite apenas o número da opção desejada.`;

export const INSURANCE_PROMPT = `Informe o *nome do convênio ou plano de saúde*.`;

export const HANDOFF_MESSAGE = `Obrigado! As informações iniciais foram recebidas. 😊

Seu atendimento será encaminhado para nossa equipe, que dará continuidade assim que possível. 💚`;

export const DIRECT_HANDOFF_MESSAGE = `Certo! Seu atendimento será encaminhado para um de nossos colaboradores. 👩‍💻

Por favor, aguarde um momento. Assim que possível, nossa equipe dará continuidade ao atendimento.`;
