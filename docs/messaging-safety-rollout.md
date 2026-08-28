# Atualização do atendimento sem troca da API do WhatsApp

Data: 27–28/08/2026. Implementação validada localmente e em cópia isolada do banco na VPS. Consulte `verification-local.md` para evidências e limites. A publicação deve seguir o procedimento abaixo, sem substituir as credenciais existentes.

## Decisão de compatibilidade

**A API não oficial atual foi mantida.** Os arquivos de produção e baixo consumo continuam usando `whaileys` por padrão; `wwebjs` também permanece disponível. Não houve alteração das credenciais, sessões ou números em produção. A integração Quark conserva seus endpoints e cabeçalhos de autenticação.

Não é necessário usar Cloud API, cadastrar templates na Meta ou preencher variáveis `CLOUD_*` para continuar com o conector atual. O adaptador Cloud adicionado durante a revisão é opcional, fica inativo sem seleção explícita e não foi homologado com uma conta real. Não selecione dois transportes para operar o mesmo número.

As proteções abaixo reduzem mensagens indevidas e repetidas. **Não garantem ausência de banimento:** clientes não oficiais continuam sujeitos às restrições da plataforma, independentemente do intervalo de envio. Não existe um limite universal de mensagens que torne esse transporte seguro. [Diretrizes do WhatsApp](https://www.whatsapp.com/legal/messaging-guidelines), [Política de mensagens comerciais](https://business.whatsapp.com/policy).

## Proteções implementadas

| Área | Regra aplicada |
| --- | --- |
| Saída central | Bot, Quark, atendentes, API HTTP, despedidas, inatividade e relatórios passam pela mesma fila persistida. |
| Consentimento | Avisos proativos exigem autorização registrada. Importar um telefone do Quark não o autoriza. |
| Descadastro | `PARAR`, `SAIR`, `STOP` e `CANCELAR AVISOS` desativam avisos e suprimem os pendentes. O paciente pode continuar solicitando atendimento. |
| Destinatário | A notificação Quark usa somente o destinatário principal selecionado e autorizado; não dispara para todos os números alternativos. |
| Limites | Tentativas de todas as origens contam para o limite horário do canal; avisos têm limite adicional por destinatário e intervalo mínimo de uma hora. |
| Horários | Avisos proativos respeitam o período de silêncio. Respostas humanas solicitadas não ficam limitadas a esse horário. |
| Duplicidades | Chaves estáveis por operação, registros únicos e travas no banco evitam repetir intenções simultâneas. |
| Resultado incerto | Falha após iniciar o transporte vira `UNKNOWN`; não há reenvio automático. Confirmação de aceitação já persistida permite recuperar somente o registro local. |
| Pausa | Administrador pode pausar a fila no painel; o bloqueio também impede novas alterações automáticas e manuais no Quark. Não desfaz uma operação já enviada ao fornecedor. |
| Estado atual | Antes de enviar, o servidor confere conexão, preferências, ticket, atendente e, quando aplicável, consulta atual no Quark. |
| Privacidade | Lembretes usam data, horário e unidade; não incluem procedimento, nome completo ou profissional no texto automático inicial. Logs brutos de mensagens enviadas foram removidos. |

Os padrões são **limites internos do produto**, não limites aprovados pelo WhatsApp: `MESSAGING_MAX_PER_HOUR=100`, `MESSAGING_MIN_INTERVAL_SECONDS=2`, `MESSAGING_MAX_NOTICES_PER_DAY=3` por janela móvel de 24 horas. Os intervalos adicionais do worker Quark continuam aplicáveis. Não aumente volume para testar essas proteções em números reais.

## Atendimento e consentimento

1. A primeira mensagem apresenta o assistente e os setores disponíveis. Números de setor só são interpretados depois que o menu foi apresentado.
2. `ATENDENTE`, `HUMANO`, `AJUDA` ou uma segunda resposta não compreendida encaminham à equipe. Configure `BOT_FALLBACK_QUEUE_ID` para a fila desejada; na ausência dele, usa-se a primeira fila configurada.
3. Ao encaminhar, o bot fica pausado. Um ticket com atendente responsável não recebe decisões automáticas de confirmação/cancelamento.
4. Na conversa, **Contexto** mostra autorização, modo de execução, automação, prazo de inatividade, consultas e pendências de envio. Registrar autorização exige evidência e vínculo com o paciente.
5. A frase exata `AUTORIZO AVISOS DE CONSULTA` registra autorização pelo WhatsApp. `SIM` isolado não autoriza avisos. Não preencha consentimento em massa sem evidência.

A autorização atual é por número e tem versão `appointment-notices-v1`. Confirme o vínculo antes de usar telefones compartilhados. Respostas a uma solicitação recebida nas últimas 24 horas podem continuar mesmo após o descadastro, sem reativar avisos. Fora desse contexto, é exigida autorização. No transporte atual não é exigido template da Meta; a regra de template aplica-se apenas ao adaptador Cloud opcional.

Relatórios internos continuam sujeitos às barreiras da fila. Verificar o cadastro do gestor não substitui a autorização; a finalidade de relatórios internos deve ser documentada antes de ativá-los. O comando de autorização de consultas não deve ser usado como autorização genérica para outras finalidades.

## Quark: confirmação sem ambiguidade

Cada aviso contém uma referência vinculada à consulta, à sua versão e ao destinatário. Exemplo fictício:

```text
CONFIRMAR AB12CD34
CANCELAR AB12CD34
```

Confirmar exige o comando com a referência atual. `SIM`, `NÃO`, `1` e `2` não modificam a agenda. Frases como “não quero cancelar” não são interpretadas como cancelamento.

`CANCELAR AB12CD34` abre uma confirmação de até 10 minutos. Somente `CONFIRMO CANCELAMENTO AB12CD34`, no contexto correspondente, conclui a solicitação. Alteração de horário, destinatário, paciente ou situação exige nova conferência. A lista nunca usa a posição de uma consulta como identidade.

As leituras do Quark podem ser repetidas em falhas transitórias. Escritas não são repetidas automaticamente: se um PATCH falhar de forma ambígua, o sistema consulta o estado remoto. Se não puder comprovar o resultado, bloqueia nova alteração e apresenta **Conferir no Quark**. Esse botão consulta, não repete o PATCH; só libera o registro quando o estado remoto corresponde ao resultado esperado. Divergências exigem análise operacional, sem apagar o histórico de tentativas.

A sincronização grava consulta, evento e notificação na mesma transação. A importação inicial faz duas passagens sem disparos. Uma consulta sem alterações conserva sua espera de confirmação. A janela próxima é consultada frequentemente; o horizonte completo, no máximo uma vez por dia após uma sincronização completa. Requisições usam blocos de até 30 dias. [Contrato público Quark](https://api.quark.tec.br/clinic/ext/swagger-ui.html).

O lembrete padrão usa uma janela de 24 horas, preservando a regra de consultas de segunda-feira avisadas na sexta-feira. Mudanças e lembretes concorrentes são suprimidos quando redundantes. Notificações antigas sem a identificação da versão da consulta são bloqueadas para revisão, não reenviadas automaticamente.

## Interface

- Atendimento adaptado ao celular: navegação sobreposta, cabeçalho e botão Resolver visíveis, editor dentro da conversa.
- Rascunhos de texto separados por usuário e ticket, mantidos ao alternar conversas; limpos no logout. Não persistem após recarregar a página e anexos não fazem parte desse rascunho.
- Retentativa do mesmo envio reutiliza a chave; erros não apagam o texto. HTTP 202 é exibido como enfileirado, nunca como entregue.
- Temas claro/escuro coerentes, foco visível, rótulos em controles e lista de atendimentos sem sobreposição de chips.
- Painel Quark abre na agenda mensal; consultas e pendências e indicadores ficam em abas próprias. Filtros adicionais recolhidos, prévia de lembrete e confirmação explícita antes de alterar a agenda. No celular, consultas são cartões com ações.
- Gráfico diário de atendimentos consulta o total no servidor, com 24 faixas horárias, respeitando o acesso do usuário, sem depender da primeira página da listagem.
- Rotas, gráficos e seletor de emojis são carregados separadamente. O bundle inicial ficou em cerca de 378 kB, além dos chunks compartilhados; isso não é uma medição de tempo de carregamento.

O portal incorporado Quark continua com autenticação independente; esta atualização não cria SSO nem encerra a sessão desse portal ao sair do atendimento. React/Material UI não foram migrados de versão principal.

## Atualização preservando o conector atual

**Não copie o `.env.example` sobre o ambiente existente.** Ele documenta padrões para configuração, não contém suas credenciais. Preserve `WHATSAPP_PROVIDER=whaileys` na implantação atual (ou `wwebjs`, caso essa seja a instalação em uso), os volumes de sessão, os IDs de conexão e os segredos do Quark. Não preencha `CLOUD_*`.

1. Faça backup verificável do banco, arquivos de mídia e sessões do WhatsApp. Pare workers antigos antes de introduzir a fila nova; não execute versões antigas e novas simultaneamente.
2. Use Node 22 ou superior. Instale dependências dos lockfiles com `npm ci --legacy-peer-deps` em backend e frontend. Execute `npm run build` e `npm test` em ambos.
3. Em banco exclusivo de homologação, rode `npm run db:migrate` no backend. A migration `20260828000000-messaging-safety` cria `AutomationStates`, `OutboundMessages`, índices e o campo de auditoria `actorUserId`. As migrations anteriores de segurança também são necessárias. Não execute seeds de demonstração em produção.
4. Publique backend e frontend da mesma revisão. Os arquivos `compose.production.yaml` e `compose.lowmem.yaml` usam imagens locais já nomeadas: **é preciso reconstruir essas imagens com o código novo**, pois apenas executar `compose up` pode reutilizar código antigo. Confirme o Dockerfile e as tags usados pela sua implantação. Os Dockerfiles em `deploy/vps` permitem publicar sobre os runtimes já usados na VPS, sem reinstalar nem atualizar o provedor.
5. Comece com `MESSAGING_MODE=simulation` e `QUARK_DRY_RUN=true`. São os padrões novos. Eles impedem envio e escrita no Quark, mas permitem analisar o painel. Instalar esta revisão sem configurar o modo deixará os envios pausados, de forma intencional.
6. Passe para `MESSAGING_MODE=test` apenas com `MESSAGING_TEST_ALLOWLIST` contendo números autorizados e isolados de teste. Mantenha o conector não oficial atual. Para testar escritas no Quark, use uma conta/agenda de homologação autorizada, `QUARK_INTEGRATION_ENABLED=true`, `QUARK_DRY_RUN=false`, `QUARK_TEST_ALLOWLIST` restrita e `QUARK_WHATSAPP_ID` explícito. Modo de teste realiza efeitos reais apenas para os destinatários permitidos; não é um simulador.
7. Valide os cenários abaixo antes de colocar `MESSAGING_MODE=production`. Configure o modo explicitamente, sem alterar o provedor. Mantenha `QUARK_DRY_RUN=true` até aprovar separadamente as alterações de agenda. Retomar fila no painel não altera variáveis do servidor.

As migrations preservam mensagens e sessões. A compatibilidade bloqueia notificações legadas sem referência atual e resultados incertos para revisão, sem disparar a fila antiga. Em um rollback, prefira restaurar as imagens anteriores mantendo o banco atual; não restaure um dump sobre mensagens recebidas depois do backup. Pause envios e planeje a reversão; não apague tabelas de estado para “liberar” mensagens. Isso perde consentimentos, deduplicação e evidências. Travas têm expiração e só são liberadas pelo proprietário; resultados externos incertos continuam exigindo conferência.

### Clientes da API HTTP de envio

O conector WhatsApp não foi substituído, mas clientes próprios que chamam a API HTTP do aplicativo precisam enviar `Idempotency-Key` com 16–100 caracteres (letras, números, `_` ou `-`). Use uma chave única por intenção de envio e repita a mesma em retentativas da mesma intenção. Não gere nova chave para contornar um resultado incerto. O frontend atualizado já faz isso.

HTTP 202 significa que a intenção ficou na fila; não repita com outra chave. Respostas 409 com `ERR_CONSENT_REQUIRED`, `ERR_RECIPIENT_OPTED_OUT`, `ERR_APPOINTMENT_CHANGED` ou `ERR_SEND_OUTCOME_UNKNOWN` exigem tratar a causa. A autenticação Bearer da atualização anterior permanece obrigatória. Esse ajuste deve ser homologado com qualquer sistema externo que use o endpoint de envio.

### Roteiro de homologação

- Administrador e dois atendentes de filas diferentes: permissões, aceitar, transferir, devolver, resolver, logout e anexos.
- Dois processos disputando a mesma mensagem: uma intenção persistida, sem envio duplicado. Reinício durante o transporte e falha do banco após aceitação devem exigir conferência, nunca novo envio automático.
- `PARAR` com aviso pendente, autorização ausente e revogação durante a fila: avisos bloqueados. A mensagem já aceita pelo fornecedor não pode ser recolhida pela pausa.
- Repetir o mesmo evento recebido, alternar consultas, responder texto ambíguo, cancelar sem segunda confirmação e enviar mensagem após assumir o atendimento: nenhuma alteração indevida no Quark.
- Remarcação externa, troca de telefone/paciente, timeout de PATCH e atualização remota durante polling: estado conferido e operação incerta bloqueada.
- Mesmo envio reenviado por erro HTTP: mesma chave, um envio. Rascunho preservado; 202 exibido como pendente.
- Texto, imagem, áudio e documento pelo Whaileys real, recebimento, eco de saída e indicadores de entrega. Conferir números que o WhatsApp normaliza com ou sem nono dígito: divergência de identidade é bloqueada, nunca autorizada automaticamente.
- Horários próximos da meia-noite e limites de dia. A instalação preserva a configuração de banco em UTC−03:00 para evitar reinterpretar dados existentes. Caso a clínica use outro fuso, homologue também as agregações SQL antes de ativar.

## Verificação local e limites

A compilação e a suíte isolada são descritas em `verification-local.md`. A interface foi inspecionada a 1280×720 e 390×844, com dados fictícios e sem comunicação com os fornecedores. Capturas da revisão ficam em `review-assets/2026-08-27/after-*`.

**Validado na VPS:** migrations e endpoints autenticados no clone MariaDB, usando o runtime atual. **Ainda não comprovado por esse ensaio:** concorrência entre processos e entrega/mutações reais nos fornecedores. Testes isolados não comprovam entrega real.

Não há medição de qualidade/restrição da conta não oficial nem garantia de sinais de bloqueio do fornecedor. O painel mostra falhas e permite pausa manual. Não foram implementadas rotação de números, simulação de comportamento humano ou mecanismos para contornar fiscalização.

Defina retenção de mensagens, mídias, autorizações e trilhas de auditoria com a clínica. Não há descarte automático desses dados nesta atualização. Não trate essa revisão técnica como certificação de conformidade ou autorização para disparos em massa.

## Recursos existentes preservados

A conciliação com a VPS preservou triagem/agendamento, contexto criptografado, histórico com cursor, calendário, filtro de atendentes, prioridade de notificações e serialização das requisições ao Quark. A permissão de visualizar outros atendentes não permite modificar suas conversas. O código novo aguarda tarefas em andamento ao encerrar; o deploy não deve usar logout nem recriar Redis/MariaDB. O Redis atual contém parte das chaves da sessão e também precisa de backup.
