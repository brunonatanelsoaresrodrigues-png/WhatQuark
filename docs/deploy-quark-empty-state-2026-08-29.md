# Correção do estado de contato sem vínculo no Quark — 29/08/2026

## Versão publicada

- Aplicação: https://atendimento.bfontes.online.
- Frontend: `whaticket-frontend:quark-empty-20260830-003037`.
- Frontend anterior preservado: `whaticket-frontend:premium-refine-20260830-000957`.
- Release: `/opt/whaticket/releases/frontend-quark-empty-state-20260830T003037Z`.
- Backup: `/var/backups/whaticket/frontend-quark-empty-state-20260830T003037Z`.
- SHA-256 do artefato: `0f30bc508ea812d55d39c7a6a59ebf470ddf6b0fda974320cc3dffb07ab8808b`.

Somente o serviço `frontend` foi recriado com `docker compose up -d --no-deps
frontend`. Backend, MariaDB e Redis mantiveram os mesmos IDs, horários de início
e contagens de reinício. Nenhuma migração, alteração de volume ou reinício do
provedor de mensagens foi executado.

## Correção

- `ERR_QUARK_PATIENT_NOT_FOUND` agora é exibido como estado neutro: “Sem
  cadastro vinculado no Quark.”
- Falhas reais continuam exibindo o aviso em vermelho e a ação “Tentar
  novamente”.
- O aviso e o botão foram reorganizados para não separar o ícone do texto nem
  quebrar o rótulo na largura reduzida do painel lateral.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes frontend | 49 aprovados |
| Lint e build | Aprovados |
| QA visual local | Estado vazio e falha real aprovados, sem overlay |
| Conteúdo das mensagens anteriores | 12.224 mensagens preservadas por ID e SHA-256 |
| Conversas anteriores | 1.181 preservadas |
| Contatos anteriores | 916 preservados |
| WhatsApp | `CONNECTED`, mesma sessão e QR vazio |
| Backend, MariaDB e Redis | Containers e reinícios inalterados |
| API autenticada | Tickets, atendentes, dashboard e Quark aprovados |
| Acesso público | Frontend HTTP 200 e API sem autenticação HTTP 401 |
| Bundle público | `/assets/index-f114eead.js` |

## Reversão

Restaurar o `compose.yaml` do backup e recriar somente o frontend com `docker
compose up -d --no-deps frontend`. A imagem anterior permanece na VPS. Não
reiniciar backend, MariaDB ou Redis, não restaurar dump sobre dados novos e não
remover volumes.
