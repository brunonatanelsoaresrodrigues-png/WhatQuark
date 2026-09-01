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
2️⃣ Confirmar ou remarcar uma consulta
3️⃣ Cancelar uma consulta
4️⃣ Informações sobre convênios e valores
5️⃣ Falar com um atendente
6️⃣ Ativar avisos de consulta neste número

Digite o número da opção desejada ou ATENDENTE para falar com nossa equipe.

Ao escolher a opção 6, você autoriza lembretes e avisos sobre agendamentos neste número. Para desativar depois, responda PARAR.`;

export const CPF_PROMPT = `Para iniciarmos, informe o *CPF do paciente*.

Digite somente os 11 números.`;

export const NAME_PROMPT = `Agora informe o *nome completo do paciente*.`;

export const BIRTH_DATE_PROMPT = `Informe a *data de nascimento do paciente* no formato DD/MM/AAAA.`;

export const SPECIALTY_PROMPT = `Qual especialidade você deseja?

1️⃣ Psiquiatria
2️⃣ Psicologia
3️⃣ Laudo — particular

Digite apenas o número da opção desejada.`;

// Kept only so conversations started by an older bot version can finish
// safely. New conversations go directly to the professional list/name.
export const PROFESSIONAL_PREFERENCE_PROMPT = `Para continuar, informe o *nome do profissional* de sua preferência.

Se não souber qual escolher, digite *ATENDENTE* para falar com nossa equipe.`;

export const PROFESSIONAL_NAME_PROMPT = `Informe o *nome do profissional* de sua preferência.`;

export const PAYMENT_PROMPT = `O atendimento será:

1️⃣ Particular
2️⃣ Por convênio

Digite apenas o número da opção desejada.`;

export const INSURANCE_PROMPT = `Informe o *nome do convênio ou plano de saúde*.`;

export const COVERAGE_INFO_PROMPT = `Você deseja informações sobre qual modalidade?

1️⃣ Hapvida
2️⃣ Particular

Digite apenas o número da opção desejada.`;

export const HAPVIDA_INFO_MESSAGE = `Você escolheu atendimento pelo *Hapvida*.

A cobertura e a disponibilidade para agendamento serão verificadas pela nossa equipe.`;

export const PRIVATE_PRICES_MESSAGE = `*Valores para atendimento particular:*

1️⃣ Psiquiatria — R$ 350,00 (em até 2x no cartão)
2️⃣ Psicologia
• Anamnese — R$ 100,00
• Sessões — R$ 80,00 cada
3️⃣ Laudo — particular — R$ 450,00 (em até 2x no cartão)`;

export const INFO_SCHEDULING_PROMPT = `Deseja marcar uma consulta?

1️⃣ Sim, falar com um atendente para agendar
2️⃣ Não, voltar ao menu`;

export const coverageInformationMessage = (
  coverage: "HAPVIDA" | "PRIVATE"
): string => `${
  coverage === "HAPVIDA" ? HAPVIDA_INFO_MESSAGE : PRIVATE_PRICES_MESSAGE
}

${INFO_SCHEDULING_PROMPT}${NAVIGATION_FOOTER}`;

export const HANDOFF_MESSAGE = `Obrigado! As informações iniciais foram recebidas. 😊

Seu atendimento será encaminhado para nossa equipe, que dará continuidade assim que possível. 💚`;

export const DIRECT_HANDOFF_MESSAGE = `Certo! Seu atendimento será encaminhado para um de nossos colaboradores. 👩‍💻

Por favor, aguarde um momento. Assim que possível, nossa equipe dará continuidade ao atendimento.`;

export const NAVIGATION_FOOTER = `

0️⃣ Voltar
Digite *MENU* para retornar ao início ou *ATENDENTE* para falar com nossa equipe.`;

export const withIntakeNavigation = (body: string): string =>
  `${body}${NAVIGATION_FOOTER}`;

export const professionalOptionsMessage = (
  names: string[]
): string => `Estes são os profissionais disponíveis no Quark para a especialidade escolhida:

${names.map((name, index) => `${index + 1}️⃣ ${name}`).join("\n")}

Digite apenas o número da opção desejada.${NAVIGATION_FOOTER}`;

export const EXISTING_APPOINTMENT_BIRTH_DATE_PROMPT = `Para localizar a consulta com segurança, informe a *data de nascimento do paciente* no formato DD/MM/AAAA.`;

export const appointmentOptionsMessage = (
  appointments: Array<{
    professionalName: string;
    date: string;
    time: string;
    status: "AGENDADO" | "CONFIRMADO";
  }>
): string => `Estas são as próximas consultas localizadas no QuarkClinic:

${appointments
  .map(
    (appointment, index) =>
      `${index + 1}️⃣ ${appointment.date} às ${appointment.time} — ${
        appointment.professionalName
      } (${
        appointment.status === "CONFIRMADO"
          ? "confirmada"
          : "aguardando confirmação"
      })`
  )
  .join("\n")}

Digite o número da consulta desejada.${NAVIGATION_FOOTER}`;

export const appointmentActionMessage = (appointment: {
  professionalName: string;
  date: string;
  time: string;
  status: "AGENDADO" | "CONFIRMADO";
}): string => `Consulta selecionada:

👩‍⚕️ Profissional: ${appointment.professionalName}
📅 Data: ${appointment.date}
🕐 Horário: ${appointment.time}
📌 Situação: ${
  appointment.status === "CONFIRMADO" ? "Confirmada" : "Aguardando confirmação"
}

1️⃣ Confirmar esta consulta
2️⃣ Remarcar esta consulta${NAVIGATION_FOOTER}`;

export const cancellationActionMessage = (appointment: {
  professionalName: string;
  date: string;
  time: string;
  status: "AGENDADO" | "CONFIRMADO";
}): string => `Consulta localizada:

👩‍⚕️ Profissional: ${appointment.professionalName}
📅 Data: ${appointment.date}
🕐 Horário: ${appointment.time}
📌 Situação: ${appointment.status === "CONFIRMADO" ? "Confirmada" : "Agendada"}

1️⃣ Cancelar esta consulta
2️⃣ Solicitar remarcação com um atendente${NAVIGATION_FOOTER}`;

export const NO_UPCOMING_APPOINTMENTS_MESSAGE = `Não localizei uma consulta futura vinculada a esses dados.

Seu atendimento será encaminhado para nossa equipe verificar.`;

export const APPOINTMENT_LOOKUP_FAILURE_MESSAGE = `Não consegui consultar suas próximas consultas com segurança neste momento.

Seu atendimento será encaminhado para nossa equipe verificar.`;

export const appointmentConfirmedMessage = (appointment: {
  professionalName: string;
  date: string;
  time: string;
}): string => `✅ *Consulta confirmada com sucesso!*

👩‍⚕️ Profissional: ${appointment.professionalName}
📅 Data: ${appointment.date}
🕐 Horário: ${appointment.time}

A confirmação já foi registrada no QuarkClinic. 💚`;

export const APPOINTMENT_CONFIRMATION_FAILURE_MESSAGE = `Não consegui confirmar a consulta com segurança neste momento.

O atendimento será encaminhado para nossa equipe. Evite repetir a confirmação agora.`;

export const appointmentCancelledMessage = (appointment: {
  professionalName: string;
  date: string;
  time: string;
}): string => `✅ *Consulta cancelada com sucesso!*

👩‍⚕️ Profissional: ${appointment.professionalName}
📅 Data: ${appointment.date}
🕐 Horário: ${appointment.time}

O cancelamento já foi registrado no QuarkClinic. 💚`;

export const APPOINTMENT_CANCELLATION_FAILURE_MESSAGE = `Não consegui cancelar a consulta com segurança neste momento.

O atendimento será encaminhado para nossa equipe. Evite repetir o cancelamento agora.`;

export const RESCHEDULE_HANDOFF_MESSAGE = `Certo! Vou encaminhar sua solicitação de remarcação para um atendente, que verificará a data mais próxima disponível. 💚

*Sua consulta atual permanece agendada e não foi cancelada.*`;

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
  reschedule?: boolean;
}): string => `Confira os dados:

👤 Paciente: ${data.patientName}
🩺 Especialidade: ${data.specialty}
👩‍⚕️ Profissional: ${data.professional}
📅 Data: ${data.date}
🕐 Horário: ${data.time}
💳 Atendimento: ${data.payment}

1️⃣ ${
  data.reschedule
    ? "Confirmar remarcação"
    : data.automaticBooking
    ? "Confirmar e agendar"
    : "Confirmar escolha"
}
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

export const rescheduleSuccessMessage = (data: {
  patientName: string;
  professional: string;
  date: string;
  time: string;
}): string => `✅ *Consulta remarcada com sucesso!*

👤 Paciente: ${data.patientName}
👩‍⚕️ Profissional: ${data.professional}
📅 Nova data: ${data.date}
🕐 Novo horário: ${data.time}

A nova consulta foi registrada e o agendamento anterior foi cancelado no QuarkClinic. 💚`;

export const RESCHEDULE_REVIEW_MESSAGE = `A nova consulta foi criada, mas não consegui encerrar o agendamento anterior com segurança.

Não repita a solicitação. Nossa equipe verificará os dois agendamentos antes de confirmar o resultado final.`;
