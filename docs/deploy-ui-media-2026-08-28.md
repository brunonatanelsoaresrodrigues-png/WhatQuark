# Publicação de interface e mídia — 28/08/2026

## Versão publicada

- Revisão: `9ce4275f6c0b2324b154496944be83e2378b273f`, incluindo mídia/figurinhas de `66eb693` e a correção do bot de `0a6f499`.
- Backend: `whaticket-backend:ui-media-9ce4275`.
- Frontend: `whaticket-frontend:ui-media-9ce4275`.
- Aplicação: https://atendimento.bfontes.online.
- API: https://api.bfontes.online.

As imagens foram derivadas das imagens em produção, substituindo somente os artefatos compilados.
Não houve atualização de dependências durante o deploy. Mantidos Whaileys 6.5.1, API não oficial,
modo de envio `production`, regras de consentimento, limites, bot, configurações Quark e segredos.
O histórico Git foi transferido em bundle; não foi usado remoto Git externo.

## Troca e continuidade

Horários de Brasília (UTC−03:00):

| Evento | Horário |
| --- | --- |
| Início da troca | 19:41:54 |
| Encerramento controlado concluído, código 0 | 19:41:55 |
| Backup final conferido | 19:42:07 |
| Novo servidor HTTP iniciado | 19:42:25 |
| Conexão WhatsApp confirmada pelo provedor | 19:42:27 |
| Backend e sessão aprovados pela verificação | 19:42:32 |
| Interface e deploy aprovados | 19:42:35 |

A janela total de troca foi de 41 segundos. Houve uma breve interrupção do backend e reconexão
do WhatsApp; não foi executado logout nem solicitado QR Code. MariaDB e Redis mantiveram os
mesmos containers e horários de início, sem reinício.

Uma tentativa anterior, às 14:53:44, foi abortada antes do backup final e da migração. O comando
`docker stop` sinalizou também o shell pai, interrompendo o encerramento do Node. A proteção
restaurou as imagens anteriores e a sessão voltou a conectar. Nenhuma migração foi aplicada
nessa tentativa. Para a troca concluída, o reinício automático foi desativado temporariamente
e SIGTERM foi enviado somente ao processo `node dist/server.js`. O procedimento exigiu o log
`Graceful shutdown completed`, saída 0 e ausência de OOM antes de prosseguir. As imagens novas
voltaram à política `unless-stopped`, conferida depois da publicação.

## Dados e verificações

| Conferência | Resultado |
| --- | --- |
| Mensagens anteriores | 11.989 IDs e conteúdo conferidos individualmente por SHA-256 |
| Conversas anteriores | 1.162 tickets preservados |
| Contatos anteriores | 902 contatos preservados |
| Mídias anteriores | 98 arquivos conferidos por SHA-256 |
| WhatsApp | `CONNECTED`, sessão presente e QR vazio; evento real `Session connected` no log |
| Volumes e variáveis de ambiente | Preservados e comparados antes/depois |
| Migração | Somente `20260901000000-create-saved-stickers.js`; 28 tabelas preexistentes preservadas por checksum |
| API autenticada | Tickets, atendentes, métricas diárias, biblioteca de figurinhas e cinco endpoints do painel Quark aprovados |
| Mídia autenticada | Amostra existente com bytes idênticos ao arquivo; acesso sem autenticação retorna 401 |
| Acesso externo HTTPS | Frontend e três assets de entrada retornam 200; tickets/figurinhas sem autenticação retornam 401 |
| Navegador | Login da nova interface renderizado; nenhum erro ou aviso de console capturado |
| Quark | Duas sincronizações concluídas após a troca, 97 registros, janela de 30 dias, sem recriar baseline |
| Containers da aplicação | Sem OOM ou reinício inesperado nas conferências |

A tela de login apresentou o aviso de sessão de operador expirada no navegador sem autenticação.
Isso não corresponde à sessão do WhatsApp, que permaneceu autenticada após a reconexão.

Antes da publicação, os testes locais passaram: 18 testes de frontend, build frontend,
compilação backend e 53 suítes/257 testes unitários de backend. Permanece o aviso conhecido
do chunk de emojis de aproximadamente 571 kB.

Um clone isolado do banco recebeu a migração e passou no ensaio de API: autenticação,
salvar/listar/baixar/excluir figurinha, deduplicação, histórico, acesso protegido às mídias,
rejeição de upload inválido e painel Quark. Envios estavam bloqueados em modo simulação,
sem iniciar o provedor WhatsApp ou workers. O clone, usuário exclusivo, cópia temporária de
mídias e arquivo de credenciais do ensaio foram removidos depois da validação.

Não foram enviadas mensagens de teste a pacientes nem alterados agendamentos reais.
Entrega ponta a ponta de áudio, figurinhas, respostas do bot e avisos não foi exercitada em
produção. Microfone físico, arrastar arquivos do sistema operacional e outros navegadores
continuam com os limites de validação registrados em `ui-modernization.md`.

## Backups e artefatos

Diretórios na VPS, restritos a root:

- Backup: `/var/backups/whaticket/ui-media-9ce4275-20260828`.
- Release, logs, scripts de conferência e bundle Git: `/opt/whaticket/releases/ui-media-9ce4275-20260828`.

O backup final contém dump consistente, mídias, autenticação, snapshot Redis, configuração,
inventário de containers e assinaturas das mensagens. Whaileys utiliza sessão/estado no banco
e Redis; o volume de autenticação preservado não continha arquivos nessa conferência.
Integridade conferida com SHA-256, teste gzip e `redis-check-rdb`.

| Artefato | SHA-256 |
| --- | --- |
| Pacote de runtime, 379 arquivos conferidos | `d6670d6c6784ce86567fcfcc56b00e84258dad5135dd951a3f51734618095722` |
| Dump final `cutover.sql.gz` | `768c4267b95cd9ba7449002466bd1f3fba53c69b49a71fb6c5b7c6993d235016` |
| `media-cutover.tar.gz` | `8b7989c62b72303fa241627de23bb70268204d6101a8f1fb5955b8e01273171b` |
| `auth-cutover.tar.gz` | `1d34f86cc7843e6b7561ef1700ae35d3dd52bf613ef1d0672674986de180dde1` |
| `redis-cutover.rdb` | `9942a5f0d0836742a0fa7e4373f4ec62e2c0afdfdef0d8b400d974bf067fb4ac` |

Os backups estão na própria VPS. Uma cópia externa criptografada ainda é necessária para
cobrir perda do servidor; esta publicação não configurou esse serviço.

## Reversão

As imagens anteriores foram mantidas: backend `whaticket-backend:bot-fix-0a6f499` e frontend
`whaticket-frontend:safety-d6949b5`. A configuração anterior está no diretório de backup.
Em uma reversão, aguardar o encerramento controlado do backend antes da troca e restaurar
somente as imagens/configuração. A tabela aditiva `SavedStickers` pode permanecer.

Não restaurar dumps sobre mensagens novas, não executar seeders, logout, remoção de volumes
ou `docker compose down -v`. Não iniciar dois backends com a mesma sessão. Conferir novamente
conexão, dados, mídias, política de reinício e API após qualquer reversão.

A API não oficial e suas proteções foram mantidas. Nenhum mecanismo elimina o risco de
restrição ou banimento pelo WhatsApp.
