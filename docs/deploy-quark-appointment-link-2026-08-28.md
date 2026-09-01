# Publicação do acesso à consulta no Quark — 28/08/2026

## Versão publicada

- Código: `72d10a9`.
- Backend: `whaticket-backend:quark-appointment-link-72d10a9`.
- Frontend: `whaticket-frontend:quark-appointment-link-72d10a9`.
- Release: `/opt/whaticket/releases/quark-appointment-link-72d10a9-20260829T004620Z`.
- Backup: `/var/backups/whaticket/quark-appointment-link-72d10a9-20260829T004620Z`.

As consultas exibidas no painel do contato e no diálogo de contexto agora possuem a ação discreta
`Ver no Quark`. A ação navega na mesma aba para o módulo Quark Clinic, leva o ID exato da consulta
e preserva uma rota segura de retorno ao atendimento. O módulo busca os dados atuais diretamente
pela integração do Quark e apresenta paciente, data, status, profissional, procedimento,
especialidade, clínica e referência. A consulta é somente leitura e não confirma, cancela ou
altera o agendamento.

O endpoint exige autenticação e a permissão do Quark Clinic. Ele aceita somente IDs com formato
válido que já existam na sincronização local, evitando consultas arbitrárias. A interface foi
conferida nos modos claro e escuro, em desktop e em tela móvel.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes do frontend | 29 aprovados |
| Testes do backend | 55 suítes e 264 testes aprovados |
| Compilações de produção | Frontend e backend aprovados |
| Navegação | Mesma aba, ID correto e retorno ao atendimento aprovados |
| API autenticada | Detalhe real de consulta do Quark aprovado em produção |
| Dados antes/depois | 11.997 mensagens, 1.163 atendimentos e 902 contatos preservados |
| WhatsApp | `whaileys`, `production`, `CONNECTED`, sessão presente e QR vazio |
| Banco e cache | MariaDB e Redis preservados, saudáveis e sem reinício |
| Acesso externo | Frontend HTTP 200 e API sem token HTTP 401 |

Um dump consistente e um snapshot por hash foram criados antes da troca. O backend anterior
recebeu SIGTERM e registrou `Graceful shutdown completed` com código zero. Nenhuma mensagem foi
enviada a pacientes e nenhuma consulta foi modificada durante a validação.

A primeira tentativa de publicação detectou um endpoint 404 porque o artefato compilado havia
sido copiado para um diretório diferente do diretório de execução da imagem base. A validação
falhou e o rollback automático restaurou as duas imagens anteriores. Antes da nova tentativa,
foram reconferidos os dados e a conexão do WhatsApp. O caminho foi corrigido para
`/usr/src/app/dist`; a publicação seguinte e a auditoria após estabilização passaram integralmente.

Para reversão, restaure o `compose.yaml` do backup e recrie somente backend e frontend. Não
restaure o dump sobre dados novos, não remova volumes e não execute dois backends com a mesma
sessão do WhatsApp.
