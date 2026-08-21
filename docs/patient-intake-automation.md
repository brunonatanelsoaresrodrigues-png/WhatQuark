# Atendimento inicial automático

O atendimento inicial automático organiza a solicitação antes do
encaminhamento para as filas já cadastradas no WhaTicket. Ele é aplicado apenas
a conversas individuais de pacientes, nunca a grupos ou relatórios internos.

## Início e saudação

- Das 05h às 11h59, a saudação usa **Bom dia**.
- Das 12h às 17h59, usa **Boa tarde**.
- Das 18h às 04h59, usa **Boa noite**.
- O cálculo usa `America/Sao_Paulo`.
- Quando o telefone pertence inequivocamente a um único paciente nos registros
  sincronizados do QuarkClinic, a saudação usa o primeiro nome.
- Se o telefone estiver ligado a pacientes diferentes, a saudação permanece
  genérica para evitar identificar a pessoa errada.

## Menu e coleta

O menu oferece marcação, consulta de horários, confirmação/remarcação,
cancelamento, convênios/valores e atendimento humano.

- Opções 1 a 5 começam solicitando e validando o CPF.
- Marcação e horários coletam nome, nascimento, especialidade, preferência de
  profissional e forma de atendimento. Se houver convênio, solicitam o plano.
- Confirmação/remarcação e cancelamento coletam CPF e nome antes do
  encaminhamento, sem alterar automaticamente o QuarkClinic.
- Convênios/valores coletam CPF, nome e forma de atendimento.
- Falar com atendente encaminha imediatamente, sem coleta adicional.
- O CPF permanece no histórico normal da mensagem recebida pelo WhatsApp, mas
  não é duplicado em uma nova coluna ou tabela estruturada.

## Intervenção humana

Qualquer mensagem enviada por um usuário do WhaTicket durante a coleta altera
o estado para `PAUSED_HUMAN`. A partir desse momento o bot permanece silencioso,
mesmo que o paciente continue respondendo.

O fluxo só é zerado quando um atendente resolve/fecha o ticket e uma mensagem
posterior do paciente reabre ou cria o atendimento. Fechamentos automáticos por
inatividade não reativam um fluxo que havia sido pausado por intervenção
humana.

## Compatibilidade com o QuarkClinic

Respostas de confirmação do Quark têm prioridade quando não existe uma coleta
em andamento. Durante a coleta, respostas numéricas pertencem ao passo atual do
bot, evitando que uma opção `2` de especialidade ou convênio cancele uma
consulta. Respostas textuais `SIM` e `NÃO` continuam sendo oferecidas ao Quark.

O fluxo registra somente estado, motivo e horários operacionais no ticket. Os
eventos `INTAKE_STARTED`, `INTAKE_COMPLETED`, `INTAKE_PAUSED` e
`INTAKE_RESTARTED` permitem auditar o comportamento sem copiar as respostas
livres do paciente para os metadados de auditoria.
