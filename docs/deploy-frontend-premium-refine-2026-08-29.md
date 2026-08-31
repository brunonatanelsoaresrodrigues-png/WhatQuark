# Publicação do fechamento visual premium — 29/08/2026

## Versão publicada

- Aplicação: https://atendimento.bfontes.online.
- Frontend: `whaticket-frontend:premium-refine-20260830-000957`.
- Frontend anterior preservado: `whaticket-frontend:premium-20260829-163545`.
- Release: `/opt/whaticket/releases/frontend-premium-refine-20260830T000957Z`.
- Backup: `/var/backups/whaticket/frontend-premium-refine-20260830T000957Z`.
- SHA-256 do artefato: `4030518bf0fa9582c97a282da5aadf87a80492323118eaf766075a1b67c49c2b`.

Somente o serviço `frontend` foi recriado com `docker compose up -d --no-deps frontend`.
Backend, MariaDB e Redis mantiveram os mesmos IDs, horários de início e contagens de
reinício. Nenhuma migração, logout, remoção de volume ou reinício do provedor foi executado.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Build, lint e testes locais | Aprovados; 47 testes frontend |
| Container candidato isolado | HTML, bundle, fonte e marcador da versão aprovados |
| Conteúdo das mensagens anteriores | 12.224 mensagens preservadas por ID e SHA-256 |
| Conversas anteriores | 1.181 preservadas |
| Contatos anteriores | 916 preservados |
| WhatsApp | `CONNECTED`, mesma sessão, QR vazio |
| Backend, MariaDB e Redis | Containers e reinícios inalterados |
| API autenticada | Tickets, atendentes, dashboard e Quark aprovados |
| Acesso público | Frontend e fonte HTTP 200; API sem autenticação HTTP 401 |
| Bundle público | `/assets/index-25532e13.js`, com marcador da nova versão |
| Navegador publicado | Login renderizado sem erros ou avisos no console |

O backup contém o `compose.yaml` anterior, inventário dos containers, imagem anterior,
cópia compactada do HTML publicado, assinatura das mensagens/conversas/contatos, estados
do canal antes e depois, logs e checksums.

## Reversão

Restaurar o `compose.yaml` do backup e recriar somente o frontend com
`docker compose up -d --no-deps frontend`. A imagem anterior permanece na VPS.
Não reiniciar backend, MariaDB ou Redis, não restaurar dump sobre dados novos e não remover volumes.
