# Correção de nomes técnicos do WhatsApp — 29/08/2026

## Versão publicada

- Aplicação: https://atendimento.bfontes.online.
- Backend: `whaticket-backend:contact-identity-20260830-013421`.
- Backend anterior preservado: `whaticket-backend:cpf-overlay-20260830-005941`.
- Release: `/opt/whaticket/releases/backend-contact-identity-20260830T013421Z`.
- Backup: `/var/backups/whaticket/backend-contact-identity-20260830T013421Z`.
- SHA-256 do artefato: `b282fac8a36d90ae9e2fe4e320c025a720e1033e9c0ec6c6e3dc796850c8b318`.

A imagem deriva exatamente do backend anterior e substitui apenas três arquivos
compilados: normalização de identidade do contato, criação/atualização de contato
e implementação do provedor WhatsApp. Frontend, MariaDB e Redis não foram
recriados.

## Correção

- Nomes iguais ao LID interno do WhatsApp deixam de ser exibidos como se fossem
  telefone.
- Quando existe uma relação segura entre LID e telefone, o telefone real é usado
  como identificação provisória até a chegada de um nome público.
- Quando ainda não há telefone resolvido, a interface passa a mostrar “Contato
  WhatsApp”, sem expor o identificador interno.
- Nomes públicos e nomes editados pelos atendentes são preservados.
- O evento de compartilhamento de telefone consolida automaticamente a relação
  LID/telefone em mensagens futuras.

## Saneamento existente

Foram atualizados somente contatos cujo nome era exatamente igual ao próprio
LID, dentro de uma transação validada antes do commit:

- 103 nomes técnicos corrigidos;
- 55 contatos passaram a exibir o telefone real já mapeado;
- 48 contatos sem mapeamento seguro passaram a exibir “Contato WhatsApp”;
- nenhum nome humano foi selecionado pela atualização;
- o contato mostrado na captura foi validado como corrigido.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes backend completos | 63 suítes e 300 testes aprovados |
| Testes finais focados | 2 suítes e 9 testes aprovados |
| TypeScript e `diff --check` | Aprovados |
| Conteúdo das mensagens anteriores | 12.224 mensagens preservadas por ID e SHA-256 |
| Conversas anteriores | 1.181 preservadas |
| Contatos anteriores | 916 preservados |
| Nomes técnicos restantes | 0 |
| WhatsApp | `CONNECTED`, sessão preservada e QR vazio |
| Frontend, MariaDB e Redis | Containers inalterados |
| Acesso público | Frontend HTTP 200 e API sem autenticação HTTP 401 |
| Logs fatais após a publicação | Nenhum |

## Segurança e reversão

Antes da troca foram salvos um dump comprimido do MariaDB, uma assinatura de
cada mensagem, o conjunto exato dos nomes alteráveis e o `compose.yaml`. A
parada do backend foi graciosa e confirmada nos logs.

Para reverter o serviço, restaurar `compose-before.yaml` do backup como
`compose.yaml` e recriar somente o backend. Para reverter também os 103 nomes,
usar `technical-contact-names-before.json` ou o dump criado antes do deploy,
sem sobrescrever dados novos indiscriminadamente e sem remover volumes.
