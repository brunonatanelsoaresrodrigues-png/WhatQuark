# Confiabilidade dos avisos Quark — 31/08/2026

## Resultado

- Reagendamentos detectados no mesmo dia permanecem válidos até o fim do dia,
  mesmo quando o horário registrado da consulta já passou.
- O estado `AGUARDANDO_ATENDIMENTO` é aceito somente para esse aviso de
  reagendamento do mesmo dia.
- O texto desse caso não apresenta um horário vencido como compromisso futuro.
- O envio tenta, de forma determinística, as variantes brasileiras equivalentes
  do celular com e sem o nono dígito. Nenhum telefone arbitrário ou alternativo
  é utilizado.
- Lembretes de 24h e 2h continuam vencendo no horário da consulta; a ampliação
  de validade não se aplica a lembretes antigos nem a reagendamentos de outro dia.

## Verificação

- Build TypeScript aprovado.
- 76 suítes e 349 testes unitários aprovados.
- Imagem publicada: `whaticket-backend:quark-phone-variants-20260831-1830`.
- Backend saudável, sem reinícios, sincronização Quark `ACTIVE:5` e canal
  WhatsApp conectado após a publicação.
- Configuração preservada: `MESSAGING_MODE=production`, integração Quark ativa,
  `QUARK_DRY_RUN=false` e `QUARK_REMINDER_HOURS=24,2`.
- Backups anteriores aos dois passos da publicação:
  `/var/backups/whaticket/database-20260831T181529Z.sql.gz` e
  `/var/backups/whaticket/database-20260831T182621Z.sql.gz`.

## Exceção operacional encontrada

O aviso que motivou a correção foi reprocessado após cada etapa. O provedor
recusou tanto o número principal quanto sua variante brasileira equivalente com
`ERR_NUMBER_NOT_ON_WHATSAPP`. O Quark não forneceu telefone alternativo para a
consulta. Esse aviso específico não pode ser entregue por WhatsApp até que o
cadastro do telefone seja corrigido ou outro canal seja utilizado.

Nenhuma mensagem de teste foi enviada a pacientes e nenhuma consulta foi
alterada durante a publicação.
