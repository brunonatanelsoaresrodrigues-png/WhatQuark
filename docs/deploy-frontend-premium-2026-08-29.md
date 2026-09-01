# Publicação do refino premium do frontend — 29/08/2026

## Versão publicada

- Aplicação: https://atendimento.bfontes.online.
- Frontend: `whaticket-frontend:premium-20260829-163545`.
- Frontend anterior preservado: `whaticket-frontend:contact-pictures-464f936`.
- Release: `/opt/whaticket/releases/frontend-premium-20260829T163545Z`.
- Backup: `/var/backups/whaticket/frontend-premium-20260829T163545Z`.
- SHA-256 do artefato: `1655a677bb1e1f63d26353ebb5f07bfe1527d97c9536c6e9e9fe16d5eb4bac4b`.

Somente o serviço `frontend` foi recriado com `--no-deps`. Backend, MariaDB e Redis
mantiveram os mesmos IDs, horários de início e contagens de reinício. Não houve migração,
logout, reinício do provedor ou alteração dos dados de produção.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Build de produção local | Aprovado, 7.950 módulos |
| Testes frontend | 47 aprovados |
| ESLint e `git diff --check` | Aprovados |
| Integridade do pacote na VPS | SHA-256 idêntico ao artefato local |
| Container candidato isolado | HTML, chunk principal e fonte retornaram 200 |
| HTTPS público | Login renderizado; assets de entrada e fonte retornaram 200 |
| Console do navegador publicado | Sem erros |
| API sem autenticação | 401, conforme esperado |
| Frontend publicado | Em execução, zero reinícios |
| Backend, MariaDB e Redis | Preservados sem reinício |

O build publicado contém a sincronização correta do CPF, máscaras de dados sensíveis,
tabelas responsivas, tipografia mínima revisada, timeout recuperável do Quark Clinic e
carregamento sob demanda de emoji e gravador de áudio.

## Reversão

O backup contém o `compose.yaml`, as inspeções dos containers e uma cópia compactada do
HTML anterior com checksum validado. Para reverter, restaurar no compose a imagem
`whaticket-frontend:contact-pictures-464f936` e recriar somente o serviço `frontend` com
`--no-deps`. Não reiniciar backend, MariaDB ou Redis.
