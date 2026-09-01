# Integração QuarkClinic + WhaTicket

> Atualização: regras anteriores de resposta por SIM/NÃO, múltiplos destinatários e retry foram substituídas. Siga o [guia atual de mensageria](messaging-safety-rollout.md), mantendo o conector não oficial.

Esta integração consulta a API oficial do QuarkClinic por polling, detecta
eventos de agenda e grava cada mensagem em uma outbox persistente antes de usar
os serviços internos de envio do WhaTicket.

## Comportamento

- O período começa sempre no início do dia atual.
- O horizonte é configurável, com padrão de 365 dias. Como a API aceita no
  máximo cerca de 30 dias por consulta, o backend divide o horizonte em janelas
  consecutivas de até 30 dias e pagina cada uma.
- A primeira ativação executa duas varreduras e salva uma linha de base
  silenciosa. Nenhum agendamento que já existia vira disparo em massa.
- Se a linha de base falhar, seu estado permanece BASELINING. A retomada
  continua silenciosa e só muda para ACTIVE depois de todas as janelas.
- Depois da baseline, um novo agendamento gera CREATED; alterações de data,
  hora, profissional, unidade, procedimento ou telefone geram RESCHEDULED ou
  UPDATED; status de cancelamento gera CANCELLED.
- Agendamentos anteriores ao dia atual são ignorados. A ausência isolada de um
  registro na resposta não é interpretada como cancelamento.
- Lembretes usam QUARK_REMINDER_HOURS. Lembretes que já estariam vencidos na
  baseline e lembretes coincidentes com uma mensagem de criação/alteração são
  suprimidos para evitar mensagens em sequência.
- Respostas SIM/1 e NÃO/2 são aplicadas ao agendamento futuro pendente do
  número que respondeu. Quando o mesmo telefone tem mais de uma consulta
  pendente, o sistema pede SIM 1, NÃO 1, SIM 2 ou NÃO 2 e não escolhe
  silenciosamente. SIM/1 confirma no Quark e NÃO/2 cancela no Quark.

## Persistência e idempotência

A migration cria:

- QuarkAppointments: último estado mínimo conhecido, fingerprints, primeira e
  última observação, última mudança e indicação de origem na baseline.
- QuarkAppointmentNotifications: outbox com chave única, payload mínimo,
  tentativas, retry, lock do worker, envio, erro sanitizado, dead letter,
  identificador da mensagem do WhaTicket e horários de entrega/leitura.
- QuarkAppointmentResponses: auditoria da decisão recebida pelo WhatsApp,
  resultado da aplicação no Quark e tempo de resposta, sem armazenar o texto
  livre enviado pelo paciente.
- QuarkSyncStates: estado da baseline, último ciclo bem-sucedido, versão do
  fingerprint e lock do sincronizador.

O sincronizador usa lock no banco. O worker reivindica uma linha da outbox em
transação com lock e skip locked. Itens presos em PROCESSING são recuperados
depois do timeout configurado. Falhas temporárias usam backoff exponencial com
jitter; telefone inválido e conexão inexistente vão para DEAD_LETTER.
Notificações que chegam à vez depois do horário da consulta são suprimidas.

## Painel Automação Quark

Usuários administradores acessam `/quark-dashboard` pelo item **Automação
Quark** do menu. O painel possui filtros de período e situação, cartões de
agendas, fila, envios, entregas, leituras, falhas, confirmações e cancelamentos,
além de série diária, detalhamento por profissional e tabela operacional com
nome e telefone mascarados.

Os endpoints autenticados usados pela página são:

- `GET /quark/dashboard/summary`
- `GET /quark/dashboard/timeseries`
- `GET /quark/dashboard/breakdown`
- `GET /quark/dashboard/appointments`

O backend emite `quarkDashboard` pelo Socket.IO após sincronização, envio,
entrega/leitura ou resposta. A tela atualiza em tempo real e também permite
atualização manual. O acesso é recusado no backend para perfis que não sejam
administradores; esconder o item de menu não é a única proteção.

Métricas de envio existentes antes da migration podem ser contabilizadas como
SENT, mas entrega, leitura e origem exata da confirmação passam a ser completas
somente para mensagens processadas depois da implantação da auditoria.

## Configuração

As credenciais ficam somente no .env/gerenciador de secrets. O .env já está
ignorado pelo Git. Não coloque tokens em Compose versionado, testes ou logs.

    QUARK_INTEGRATION_ENABLED=false
    QUARK_DRY_RUN=true
    QUARK_API_BASE_URL=https://api.quark.tec.br/clinic/ext
    QUARK_AUTH_TOKEN=
    QUARK_X_CHAVE_KEY=
    QUARK_X_SECRET_KEY=
    QUARK_WHATSAPP_ID=
    QUARK_POLL_INTERVAL_SECONDS=300
    QUARK_STARTUP_DELAY_SECONDS=20
    QUARK_REQUEST_TIMEOUT_MS=15000
    QUARK_SYNC_HORIZON_DAYS=365
    QUARK_TIMEZONE=America/Sao_Paulo
    QUARK_DEFAULT_COUNTRY_CODE=55
    QUARK_CLINIC_ADDRESS=
    QUARK_REMINDER_HOURS=24,2
    QUARK_SEND_INTERVAL_MIN_SECONDS=15
    QUARK_SEND_INTERVAL_MAX_SECONDS=45
    QUARK_MAX_MESSAGES_PER_HOUR=100
    QUARK_QUIET_HOURS_START=20:00
    QUARK_QUIET_HOURS_END=08:00
    QUARK_MAX_RETRY_ATTEMPTS=5
    QUARK_PROCESSING_TIMEOUT_MINUTES=10
    QUARK_WORKER_POLL_INTERVAL_SECONDS=5
    QUARK_TEST_ALLOWLIST=
    QUARK_CANCEL_REASON=Cancelado pelo paciente atraves da confirmacao no WhatsApp

QUARK_WHATSAPP_ID vazio usa a conexão marcada como padrão. Quando preenchido,
o worker exige que essa conexão exista e esteja CONNECTED.

QUARK_DRY_RUN=true mantém o worker pausado. A sincronização e a baseline
funcionam, mas nenhuma outbox é marcada como enviada. QUARK_TEST_ALLOWLIST
aceita números de teste com DDI separados por vírgula. Quando a lista existe,
itens de outros números permanecem pendentes.

O horário silencioso usa QUARK_TIMEZONE. O container também recebe
TZ=America/Sao_Paulo; mantenha ambos coerentes.

QUARK_CLINIC_ADDRESS completa a mensagem com o endereço da unidade. A API de
agendamentos informa o nome da clínica, mas não retorna seu endereço. Deixe a
variável vazia se houver unidades com endereços diferentes até existir uma
fonte confiável por clinicaId; nunca envie um endereço fixo para a unidade
errada.

## Rollout seguro

1. Suba a nova imagem com QUARK_INTEGRATION_ENABLED=false.
2. Aplique a migration pelo comando normal de inicialização do Compose.
3. Configure as credenciais diretamente no servidor/EasyPanel.
4. Use QUARK_INTEGRATION_ENABLED=true e QUARK_DRY_RUN=true.
5. Aguarde o log estruturado QuarkClinic appointments synchronized com
   baselineMode: true; confirme no banco que QuarkSyncStates.status virou
   ACTIVE.
6. Defina uma QUARK_TEST_ALLOWLIST, mude QUARK_DRY_RUN=false e valide apenas
   números autorizados.
7. Para produção completa, limpe a allowlist e recrie somente o backend.
8. Para pausar imediatamente, use QUARK_INTEGRATION_ENABLED=false e recrie o
   backend. O histórico e a outbox permanecem no banco.

Para reprocessar uma dead letter, primeiro corrija a causa. Depois altere apenas
o item confirmado para FAILED_RETRY, zere processingStartedAt e defina
nextAttemptAt para o horário desejado. Nunca faça atualização em massa sem
revisar destinatário, evento e validade.

## Deploy e rollback

compose.production.yaml e compose.lowmem.yaml já encaminham todas as variáveis.
A inicialização executa as migrations antes de iniciar o servidor.
O backend usa stop_grace_period de 40 segundos para parar novos trabalhos,
aguardar mensagens do WhatsApp em processamento, salvar credenciais da sessão
e então fechar o socket sem logout. Não reduza esse período no deploy.

Para rollback de aplicação, desative a integração e volte para a imagem anterior;
as tabelas novas podem permanecer sem afetar o WhaTicket. A migration é
reversível, mas db:migrate:undo apaga as três tabelas e todo o histórico da
integração, portanto só deve ser usado após backup e decisão explícita.

## Privacidade e WhatsApp

Os templates não incluem diagnóstico, convênio, documento ou prontuário. Logs
usam apenas IDs técnicos, tipo do evento, contagens e códigos de erro
sanitizados; não registram headers ou payloads da API.

A cadência aleatória, o limite horário e o horário silencioso reduzem rajadas,
mas não garantem proteção contra bloqueio. Este fork pode usar automação não
oficial do WhatsApp. Envie somente mensagens esperadas, para pacientes que
autorizaram o contato, com volume compatível com a operação real.

Documentação da API:
<https://api.quark.tec.br/clinic/ext/swagger-ui.html#/>
