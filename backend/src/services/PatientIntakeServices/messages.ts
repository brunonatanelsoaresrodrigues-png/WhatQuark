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

export const NAVIGATION_FOOTER = `

0️⃣ Voltar
Digite *MENU* para retornar ao início.`;

export const withIntakeNavigation = (body: string): string =>
  `${body}${NAVIGATION_FOOTER}`;

export const professionalOptionsMessage = (
  names: string[]
): string => `Estes são os profissionais disponíveis no Quark para a especialidade escolhida:

${names.map((name, index) => `${index + 1}️⃣ ${name}`).join("\n")}
${names.length + 1}️⃣ Primeiro profissional disponível

Digite apenas o número da opção desejada.${NAVIGATION_FOOTER}`;

export const availabilityDatesMessage = (
  professionalName: string,
  dates: Array<{ label: string; slots: number }>
): string => `Próximas datas com horários disponíveis para *${professionalName}*:

${dates
  .map(
    (date, index) =>
      `${index + 1}️⃣ ${date.label} — ${date.slots} horário${
        date.slots === 1 ? "" : "s"
      }`
  )
  .join("\n")}

Digite o número da data desejada.${NAVIGATION_FOOTER}`;

export const availabilityTimesMessage = (
  dateLabel: string,
  times: string[],
  hasMore: boolean
): string => `Horários livres para *${dateLabel}*:

${times.map((time, index) => `${index + 1}️⃣ ${time}`).join("\n")}${
  hasMore ? "\n\nDigite *MAIS* para ver os próximos horários." : ""
}

Digite o número do horário desejado.${NAVIGATION_FOOTER}`;

export const bookingSummaryMessage = (data: {
  patientName: string;
  specialty: string;
  professional: string;
  date: string;
  time: string;
  payment: string;
  automaticBooking: boolean;
}): string => `Confira os dados:

👤 Paciente: ${data.patientName}
🩺 Especialidade: ${data.specialty}
👩‍⚕️ Profissional: ${data.professional}
📅 Data: ${data.date}
🕐 Horário: ${data.time}
💳 Atendimento: ${data.payment}

1️⃣ ${data.automaticBooking ? "Confirmar e agendar" : "Confirmar escolha"}
2️⃣ Escolher outro horário${NAVIGATION_FOOTER}`;

export const NO_AVAILABILITY_MESSAGE = `Não encontrei horários livres para esse profissional nos próximos 30 dias.

Escolha outro profissional ou fale com nossa equipe.`;

export const QUARK_AVAILABILITY_FAILURE_MESSAGE = `Não consegui consultar a agenda do Quark neste momento.

Vou encaminhar seu atendimento para nossa equipe, mantendo as informações que você já enviou.`;

export const SLOT_NO_LONGER_AVAILABLE_MESSAGE = `Esse horário acabou de ser reservado por outra pessoa.

Vou mostrar as opções disponíveis novamente.`;

export const BOOKING_PROCESSING_MESSAGE = `Seu agendamento já está sendo processado. Aguarde alguns instantes.`;

export const BOOKING_FAILURE_MESSAGE = `Não foi possível concluir o agendamento automaticamente neste momento.

Vou encaminhar sua solicitação para nossa equipe, sem perder os dados informados.`;

export const bookingSuccessMessage = (data: {
  patientName: string;
  professional: string;
  date: string;
  time: string;
}): string => `✅ *Consulta agendada com sucesso!*

👤 Paciente: ${data.patientName}
👩‍⚕️ Profissional: ${data.professional}
📅 Data: ${data.date}
🕐 Horário: ${data.time}

O agendamento já foi registrado no QuarkClinic. 💚`;
