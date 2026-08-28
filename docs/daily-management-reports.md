# Fechamento gerencial diário

O SquadChat gera um fechamento agregado diariamente às 17h no fuso
`America/Sao_Paulo`. O período operacional é contínuo: 17h do dia anterior até
17h do dia atual. Um quadro separado mostra a agenda civil do dia seguinte.

O relatório não contém nomes, telefones, mensagens ou dados clínicos de
pacientes. Os destinatários são administrados em **Relatórios Diários** e os
telefones aparecem mascarados.

## Segurança de ativação

O recurso nasce desativado e em homologação:

```env
DAILY_REPORT_ENABLED=false
DAILY_REPORT_TEST_MODE=true
DAILY_REPORT_TIME=17:00
DAILY_REPORT_TIMEZONE=America/Sao_Paulo
DAILY_REPORT_WHATSAPP_ID=
DAILY_REPORT_POLL_INTERVAL_SECONDS=30
DAILY_REPORT_SEND_INTERVAL_SECONDS=20
DAILY_REPORT_MAX_RETRY_ATTEMPTS=5
DAILY_REPORT_ALLOW_WEEKENDS=true
```

`DAILY_REPORT_WHATSAPP_ID` deve apontar explicitamente para o canal conectado
da Essencial Saúde. O worker nunca escolhe silenciosamente outro canal.

Em `DAILY_REPORT_TEST_MODE=true`, a execução automática pode gerar o snapshot,
mas as entregas ficam `SUPPRESSED`. O botão **Enviar teste** é uma ação
administrativa explícita e envia somente para o gestor selecionado.

## Fluxo de homologação

1. Configure o ID do canal, mantendo `ENABLED=false` e `TEST_MODE=true`.
2. Cadastre o gestor no painel; o telefone deve conter DDI 55, DDD e número.
3. Clique em **Validar**. A validação exige que o canal esteja `CONNECTED`.
4. Gere prévias sem envio e compare os totais com o SquadChat e o QuarkClinic.
5. Use **Enviar teste** somente para um contato interno autorizado.
6. Ative o destinatário depois da validação.
7. Defina `DAILY_REPORT_ENABLED=true` ainda com `TEST_MODE=true` para observar a
   geração automática sem entregas.
8. Depois da homologação, use `DAILY_REPORT_TEST_MODE=false`.

## Auditoria e idempotência

- `Messages.sentByUserId` registra o autor humano.
- `Messages.origin` separa `HUMAN`, `BOT`, `QUARK`, `INACTIVITY`,
  `DAILY_REPORT`, `SYSTEM`, `PATIENT` e histórico `UNKNOWN`.
- `TicketEvents` registra aceites, transferências, encerramentos e reaberturas.
- `QuarkAppointmentEvents` registra antes/depois das alterações observadas.
- `DailyReportRuns` guarda o snapshot e o texto exato do fechamento.
- `DailyReportDeliveries` controla cada gestor separadamente.
- `DailyReportRecipientEvents` registra quem cadastrou, validou, ativou, pausou
  ou executou um teste, sempre com o telefone mascarado.
- A chave única por data/fuso impede dois relatórios para o mesmo fechamento.
- A chave por relatório/destinatário impede duas entregas lógicas iguais.
- Uma falha é repetida somente para o destinatário afetado.
- Uma entrega abandonada após reinício procura o eco persistido da mensagem
  antes de voltar à fila, reduzindo o risco de duplicidade.

Os contatos gerenciais são internos e seus tickets usam `INTERNAL_REPORT`.
Esses tickets são excluídos das métricas, do bot de pacientes, da integração
QuarkClinic e da automação de inatividade. Se o mesmo contato possuir uma
conversa de paciente ativa, o envio gerencial é bloqueado para evitar mistura
de contextos.

## Recuperação e falhas

Se o backend estiver desligado às 17h, ao iniciar depois desse horário ele
gera o fechamento ausente. As tentativas usam intervalos progressivos de 5,
15, 30, 60 e 120 minutos. Depois do limite configurado, a entrega fica em
`DEAD_LETTER` e pode ser reenviada individualmente pelo painel.

O painel mostra execução, canal, modo de homologação, destinatários, prévia,
histórico, entrega, leitura, tentativas e erro sanitizado. Números completos e
corpos de relatório não são escritos nos logs técnicos.
