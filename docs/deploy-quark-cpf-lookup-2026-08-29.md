# Consulta de CPF pelo paciente do Quark — 29/08/2026

## Versão publicada

- Aplicação: https://atendimento.bfontes.online.
- Backend: `whaticket-backend:cpf-overlay-20260830-005941`.
- Backend anterior preservado: `whaticket-backend:contact-pictures-464f936`.
- Release: `/opt/whaticket/releases/backend-cpf-overlay-20260830T005941Z`.
- Backup: `/var/backups/whaticket/backend-cpf-overlay-20260830T005941Z`.
- SHA-256 do artefato: `47cf2d9157139c670f22cbcd389f9df6811af97e331aa0c0f9356074c974d927`.

A imagem publicada deriva exatamente da imagem anterior e substitui somente
quatro arquivos JavaScript compilados do módulo Quark: cliente da API,
normalização de agendamentos e serviços de consulta de contato e paciente.
Frontend, MariaDB e Redis não foram recriados.

## Correção

- Quando o agendamento sincronizado não contém CPF, o backend consulta o
  paciente diretamente pelo `patientId` na API do Quark.
- CPF, data de nascimento e nome retornados pelo paciente complementam o
  detalhe exibido no atendimento.
- O CPF obtido é salvo no contato para as próximas aberturas.
- Identificadores inválidos, inclusive os textos `null` e `undefined`, são
  descartados antes de qualquer chamada à API.
- Caso existam vários agendamentos para o contato, o serviço seleciona o
  primeiro que tenha um identificador de paciente válido.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes backend completos | 62 suítes e 294 testes aprovados |
| Testes focados no Quark | 4 suítes e 30 testes aprovados |
| TypeScript e `diff --check` | Aprovados |
| Consulta real à API do Quark | Paciente encontrado, CPF com 11 dígitos e data de nascimento |
| Consulta autenticada em produção | Aprovada; CPF preenchido e persistido |
| Contatos com CPF | 9 antes; 10 após a validação real |
| Contatos atualmente vinculáveis por telefone | 109 |
| Conteúdo das mensagens anteriores | 12.224 mensagens preservadas por ID e SHA-256 |
| Conversas anteriores | 1.181 preservadas |
| Contatos anteriores | 916 preservados |
| WhatsApp | `CONNECTED`, sessão preservada e QR vazio |
| Frontend, MariaDB e Redis | Containers inalterados |
| Acesso público | Frontend HTTP 200 e API sem autenticação HTTP 401 |
| Logs fatais após a publicação | Nenhum |

## Limitação identificada na captura

Os tickets 1116 e 1145 não possuem agendamento Quark associável ao telefone do
contato. O ticket 1116 retorna corretamente HTTP 404 com
`ERR_QUARK_PATIENT_NOT_FOUND`. Nesses casos, o valor armazenado pelo WhatsApp é
um identificador sem correspondência segura com o telefone cadastrado no Quark;
portanto, o sistema mantém “Sem cadastro vinculado no Quark” e não tenta
atribuir o CPF de outra pessoa.

## Segurança da publicação e reversão

Antes da troca foi salvo um dump comprimido do MariaDB e uma assinatura de cada
mensagem existente. A parada do backend foi graciosa e confirmada nos logs. As
tentativas que não satisfizeram as proteções foram revertidas automaticamente
para a imagem anterior, sem aceitar uma versão parcial.

Para reverter, restaurar o `compose-retry2.yaml` do backup como `compose.yaml` e
recriar somente o backend com `docker compose up -d --no-deps --force-recreate
backend`. A imagem anterior permanece na VPS. Não restaurar o dump sobre dados
novos e não remover volumes.
