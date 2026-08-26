# Operação segura em produção

Este runbook preserva o provedor WhatsApp atual (`whaileys`). Nenhum procedimento abaixo migra para a API oficial, remove a sessão ou solicita novo QR Code.

## Antes de implantar

1. Confirme que CI de backend, frontend e imagens está verde.
2. Use tags de imagem imutáveis, nunca apenas `latest`.
3. Confirme espaço livre para banco, imagens e backup.
4. Execute `backup.sh`. O backup só é aceito depois de validar gzip, tar e checksums.
5. Consulte `/health` e `/ready` e registre a imagem atual para rollback.

## Implantação

No servidor, informe a imagem candidata e execute:

```bash
cd /opt/whaticket
BACKEND_IMAGE=whaticket-backend:TAG \
FRONTEND_IMAGE=whaticket-frontend:TAG \
./scripts/deploy-production-safe.sh
```

O script faz backup, atualiza primeiro o backend, aguarda o healthcheck, valida banco e Redis por `/ready`, confirma que o provider continua `whaileys` e só então atualiza o frontend. Se uma validação falhar, a imagem anterior é restaurada. As migrações deste ciclo são aditivas para manter o rollback da aplicação compatível.

## Auditoria pós-implantação

- Abra **Saúde do Sistema** e verifique banco, Redis, conexão WhatsApp, sincronização Quark, fila, cobertura e respostas.
- Confirme que não houve pico de mensagens. Os limites, cooldown, horário silencioso e circuit breaker devem permanecer ativos.
- Envie uma única mensagem de teste permitida; valide entrada, resposta do bot, pausa após mensagem humana e retomada manual.
- Valide uma confirmação de consulta em ambiente controlado e confira o status no Quark.
- Não dispare a recuperação completa de histórico ao mesmo tempo que uma recuperação massiva de notificações.

## Backup e restauração

Os artefatos são `database-*.sql.gz`, `public-*.tar.gz`, `auth-*.tar.gz` e `manifest-*.sha256`. O volume `auth` contém a sessão do provedor atual e deve ser tratado como segredo. Valide um conjunto com:

```bash
./scripts/verify-production-backup.sh /var/backups/whaticket
```

Uma restauração de banco deve ser ensaiada em instância isolada. Nunca restaure sobre produção com o backend escrevendo no banco. Em incidente, pare apenas os workers/aplicação necessários, preserve volumes, restaure o conjunto do mesmo timestamp e valide antes de liberar tráfego.

## Incidentes

- **WhatsApp desconectado:** a fila Quark pausa; não force reenvios. Restabeleça a sessão atual e monitore a retomada gradual.
- **Fila alta:** mantenha os limites atuais, investigue cobertura e horários silenciosos; não aumente volume abruptamente.
- **Respostas presas:** o reconciliador recupera estados `PROCESSING` antigos e o painel gera alerta.
- **Histórico interrompido:** o job persistido aparece como interrompido. Reinicie pelo botão quando a conexão estiver estável; a importação é idempotente.
