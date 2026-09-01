# Publicação da persistência de CPF na triagem — 28/08/2026

## Versão publicada

- Código: `3bf40d4`.
- Backend: `whaticket-backend:cpf-intake-fix-3bf40d4`.
- Frontend preservado: `whaticket-frontend:composer-controls-d424ec4`.
- Release: `/opt/whaticket/releases/cpf-intake-fix-3bf40d4-20260829T015225Z`.
- Backup: `/var/backups/whaticket/cpf-intake-fix-3bf40d4-20260829T015225Z`.

O CPF validado pelo bot agora é salvo no contato assim que é recebido. Antes desta correção, ele
permanecia somente no contexto criptografado da triagem e era copiado para o contato apenas se o
fluxo chegasse à criação automática de um agendamento. Encaminhamentos para confirmação,
reagendamento ou cancelamento podiam terminar sem preencher o painel do contato.

O endpoint de cadastro do Quark também passou a persistir o CPF no backend quando o documento é
retornado pela integração. Um CPF já preenchido no contato nunca é substituído automaticamente.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes do backend | 57 suítes e 270 testes aprovados |
| Compilação TypeScript | Aprovada |
| Atendimento `#1164` | CPF armazenado com 11 dígitos, sem imprimir o documento nos logs |
| Dados antes/depois | 11.997 mensagens, 1.163 atendimentos e 902 contatos preservados |
| WhatsApp | `whaileys`, `production`, `CONNECTED`, sessão presente e QR vazio |
| Infraestrutura | Frontend, MariaDB e Redis mantiveram os mesmos contêineres |
| Acesso externo | Frontend HTTP 200 e API sem token HTTP 401 |

O reparo do atendimento existente leu apenas mensagens recebidas do ticket indicado, validou os
dígitos verificadores localmente e não imprimiu o CPF. Como o contato já estava preenchido no
momento da execução, o valor existente foi preservado.

Antes da troca foram criados snapshot por hash, dump consistente do MariaDB e cópias da sessão e
do Redis. Somente o backend foi recriado. A API não oficial e as versões do provedor WhatsApp não
foram alteradas; a sessão reconectou automaticamente sem logout nem novo QR.
