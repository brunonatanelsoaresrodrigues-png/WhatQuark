# Publicação dos controles de emoji, áudio e cadastro Quark — 28/08/2026

## Versão publicada

- Código: `d424ec4`, incluindo o cadastro/CPF do Quark do commit `9f9b899`.
- Backend: `whaticket-backend:composer-controls-d424ec4`.
- Frontend: `whaticket-frontend:composer-controls-d424ec4`.
- Release: `/opt/whaticket/releases/composer-controls-d424ec4-20260829T013733Z`.
- Backup: `/var/backups/whaticket/composer-controls-d424ec4-20260829T013733Z`.

O seletor de emojis e o gravador MP3 passaram a fazer parte do carregamento principal do atendimento,
evitando falhas silenciosas de módulos carregados somente após o clique. A validação do contexto agora
separa composição de envio: ainda é possível digitar, escolher emoji, anexar e gravar uma prévia enquanto
o contexto é validado, porém texto, áudio e arquivos não podem ser enviados se a política bloquear o
atendimento. Figurinhas, que podem disparar envio diretamente, continuam bloqueadas nessas condições.

O mesmo rollout publicou a consulta do cadastro do paciente no Quark, com CPF e data de nascimento quando
disponíveis. A migration adicionou a coluna de CPF aos contatos sem recriar tabelas nem alterar registros
de conversas.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes do frontend | 32 aprovados |
| Testes do backend | 57 suítes e 268 testes aprovados |
| Builds | Backend, frontend de produção e fixture visual aprovados |
| Emoji | Seletor abriu e o emoji foi inserido no campo |
| Áudio | Captura sintética iniciou, encerrou e gerou a prévia MP3 |
| Contexto bloqueado | Composição permaneceu ativa e envio de texto/áudio permaneceu bloqueado |
| Dados antes/depois | 11.997 mensagens, 1.163 atendimentos e 902 contatos preservados por hash/ID |
| Quark | Consulta, cadastro do paciente e novo campo de CPF aprovados pela API autenticada |
| WhatsApp | `whaileys`, `production`, `CONNECTED`, sessão presente e QR vazio |
| Banco e cache | MariaDB e Redis mantiveram os mesmos contêineres e não reiniciaram |
| Acesso externo | Frontend HTTP 200 e API sem token HTTP 401 |

Antes da troca foram criados dump consistente do MariaDB, snapshot por hash, cópias das mídias e da
autenticação do WhatsApp e snapshot validado do Redis. Somente frontend e backend foram recriados. O
backend recebeu SIGTERM por `docker compose stop`; a sessão Whaileys reconectou automaticamente com os
dados existentes, sem logout, novo QR ou perda da sessão. Nenhuma mensagem foi enviada a pacientes durante
a validação.

As imagens foram derivadas das imagens que já estavam em produção. As versões do provedor e da API não
oficial não foram atualizadas. Para rollback, restaure o `compose.yaml` do backup e recrie somente backend
e frontend. Não restaure o dump sobre mensagens novas, não remova volumes e não execute dois backends com
a mesma sessão do WhatsApp.
