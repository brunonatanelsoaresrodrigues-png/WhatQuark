# Deploy dos limites de envio — 03/09/2026

## Publicação

- Backend publicado: `whaticket-backend:d889d7a-20260903T160829Z`.
- Código: `d889d7a`, enviado para `codex/whatsapp-send-pacing`.
- Imagem construída sobre o runtime de produção `47a6119-20260902T144600Z`, sem reinstalar dependências: Node 22.23.2, whaileys 6.5.1 e whatsapp-web.js 1.34.7.
- Build TypeScript e 85 suítes / 453 testes unitários aprovados localmente. Este registro não representa uma execução do GitHub Actions.
- API `/health`: HTTP 200, com autenticação no banco; interface: HTTP 200.
- Nenhuma migração pendente ou alteração de esquema aplicada.

## Configuração ativa

- Automação em segundo plano: limite por canal de 30 mensagens/hora e 400/dia; intervalo de 45–90 segundos.
- Mensagens interativas: intervalo de 4–8 segundos; não compartilham a cota das automações em segundo plano.
- `WHATSAPP_CONNECTIONS_ENABLED=true`: conexão manual permitida.
- `WHATSAPP_AUTO_START=false`: reiniciar o backend não inicia automaticamente o WhatsApp. Enquanto essa opção permanecer assim, a conexão deverá ser iniciada manualmente após cada reinício.
- Canal 1 mantido `DISCONNECTED`. Apenas o QR transitório e o estado visual foram ajustados; o conteúdo da sessão e as chaves não foram apagados. Para conectar, usar **Conexões → Tentar novamente** e depois ler o QR.
- Zero tentativas de envio entre a troca e a verificação final às 13:13, horário de Brasília. A entrega real depende da conexão posterior pelo usuário e não foi testada com pacientes.
- Os limites reduzem o volume; não são garantia contra restrições do provedor.

## Preservação verificada

Backup completo em `/var/backups/whaticket/deploy-pacing-20260903-manual/`, com acesso restrito:

- `database.sql.gz` (4,8 MB), dump completo com validação gzip e marcador de conclusão.
- `media-auth.tar.gz` (19 MB), arquivo validado.
- `redis.rdb` (812 KB), snapshot validado por `redis-check-rdb`.
- Configurações anteriores, manifestos de integridade e hashes SHA-256.

Comparação antes/depois:

- Identificadores preservados: 1.230 contatos, 17.839 mensagens, 1.578 atendimentos, 4.083 consultas e 3.766 registros da fila de saída.
- As 3.408 chaves SQL, as sessões salvas, as chaves WhatsApp no Redis e todos os arquivos de mídia/autenticação mantiveram seus hashes.
- Todos os conjuntos de identificadores comparados permaneceram iguais, exceto uma nova notificação criada pela rotina normal. Os 3.968 identificadores anteriores dessa tabela foram comparados separadamente e preservados.
- MariaDB, Redis e frontend mantiveram os mesmos contêineres, horários de início e contadores de reinício.
- Não houve logout, exclusão de volumes, limpeza de filas, restauração sobre o banco ou alteração manual de consultas.

## Ajuste de encerramento e operação

O comando antigo terminava em `&& node dist/server.js`; seu shell encerrou com 143, sem registro de conclusão do encerramento gracioso. O canal já não estava autenticado. A configuração final passou a usar `&& exec node dist/server.js`, mantendo `stop_grace_period: 200s`.

Durante a aplicação desse ajuste, o processo Node foi encerrado diretamente com SIGTERM e completou o encerramento gracioso com código 0. O contêiner final usa `restart: unless-stopped`, está saudável e sem reinícios inesperados.

O disco da VPS estava em 93% de uso, com aproximadamente 3,5 GB livres. Nenhum arquivo ou backup foi apagado para liberar espaço.

Para futuras publicações, preservar as configurações de ritmo e o uso de `exec node`. Não reaplicar automaticamente o compose antigo: ele aponta para uma imagem anterior aos limites e à opção de início manual.
