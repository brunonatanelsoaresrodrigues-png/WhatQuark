# Publicação do histórico de consultas — 28/08/2026

## Versão publicada

- Código: `6e9a9de`.
- Backend: `whaticket-backend:appointment-timeline-6e9a9de`.
- Frontend: `whaticket-frontend:appointment-timeline-6e9a9de`.
- Release: `/opt/whaticket/releases/appointment-timeline-6e9a9de-20260829T001444Z`.
- Backup: `/var/backups/whaticket/appointment-timeline-6e9a9de-20260829T001444Z`.

O contexto do atendimento passou a localizar consultas pelos telefones principal e alternativos
registrados pelo Quark. Cancelamentos e exclusões não são apresentados como consultas. A API
retorna até cinco consultas futuras em ordem cronológica e a consulta anterior mais recente,
além do horário do servidor e do fuso `America/Sao_Paulo`.

No painel do contato e no diálogo de contexto, cada consulta mostra data, hora, situação e a
distância em dias para a data atual: `Hoje`, `Em N dias` ou `Há N dias`. A última consulta só é
exibida quando existe. Os modos claro e escuro foram conferidos no navegador isolado.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes do frontend | 27 aprovados |
| Testes do backend | 54 suítes e 259 testes aprovados |
| Compilação TypeScript | Aprovada |
| Builds de frontend | Produção e visual isolado aprovados |
| API de contexto autenticada | Novos campos e tipos aprovados em produção |
| Dados antes/depois | 11.997 mensagens, 1.162 conversas e 902 contatos preservados |
| WhatsApp | `whaileys`, `production`, `CONNECTED`, sessão presente e QR vazio |
| Banco e cache | Containers MariaDB e Redis preservados, sem reinício |
| Acesso externo | Frontend e asset principal HTTP 200; API sem token HTTP 401 |

Foi criado um dump consistente antes da troca. O backend antigo recebeu SIGTERM diretamente no
processo Node e registrou `Graceful shutdown completed` com código zero. A troca começou às
21:16:05, o encerramento controlado terminou às 21:16:08 e a verificação final terminou às
21:16:20, no horário de Brasília. Não houve logout nem novo QR Code. Nenhuma mensagem foi enviada
a pacientes e nenhuma consulta foi alterada durante os testes.

Para reversão, restaure o `compose.yaml` do backup e recrie somente backend e frontend. Não
restaure o dump sobre dados novos, não remova volumes e não execute dois backends com a mesma
sessão do WhatsApp.
