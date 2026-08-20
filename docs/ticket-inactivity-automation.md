# Encerramento por inatividade do paciente

O SquadChat pode encerrar de forma acolhedora uma conversa quando a equipe fez
uma pergunta e o paciente não respondeu em 15 minutos. O estado
`Aguardando paciente` é um marcador secundário: o ticket permanece `open`, na
mesma fila e com o mesmo atendente enquanto o cronômetro corre.

## Regras

- Somente tickets individuais, abertos e cuja última mensagem seja da clínica
  podem entrar em `Aguardando paciente`.
- Mensagens de texto da clínica que contêm `?` iniciam o cronômetro
  automaticamente. O atendente também pode usar o botão **Aguardar paciente
  (15 min)** para mensagens sem ponto de interrogação, áudio ou imagem.
- Qualquer mensagem recebida do paciente cancela a espera, independentemente
  de ser texto, áudio, imagem, documento ou localização.
- O worker confirma novamente a última mensagem antes de enviar o aviso e
  antes de fechar o ticket. Isso protege contra respostas concorrentes.
- A automação pausa quando a conexão do WhatsApp não está `CONNECTED` ou
  quando há uma confirmação/cancelamento Quark em `PROCESSING` para o mesmo
  telefone.
- A mensagem de encerramento é enviada antes da mudança para `closed`.
- O ticket é resolvido, nunca excluído. A consulta no Quark não é modificada.
- Uma nova mensagem reabre o mesmo ticket e preserva o histórico. O atendente
  anterior é mantido se ainda existir e pertencer à fila; caso contrário, o
  ticket retorna pendente para a mesma fila.
- Início, cancelamento, encerramento e reabertura são gravados em
  `TicketInactivityEvents`. O encerramento usa o motivo exato
  `Sem retorno do paciente — 15 minutos`.

## Configuração

```env
TICKET_INACTIVITY_ENABLED=false
TICKET_INACTIVITY_TIMEOUT_MINUTES=15
TICKET_INACTIVITY_POLL_INTERVAL_SECONDS=30
TICKET_INACTIVITY_CLAIM_TIMEOUT_MINUTES=5
TICKET_INACTIVITY_SEND_INTERVAL_MIN_SECONDS=15
TICKET_INACTIVITY_SEND_INTERVAL_MAX_SECONDS=45
```

`TICKET_INACTIVITY_ENABLED=false` impede novos cronômetros automáticos e
mantém o worker parado. A migration não cria cronômetros para tickets antigos;
por isso não há encerramento em massa na primeira ativação.

Quando mais de um ticket vence ao mesmo tempo, os avisos são enviados um por
vez, com intervalo aleatório entre 15 e 45 segundos. Isso evita rajadas de
mensagens iguais no canal do WhatsApp.

## Concorrência e recuperação

O worker reivindica um ticket por transação com lock e `skip locked`. Uma
reivindicação abandonada é liberada após o timeout configurado. O horário do
aviso é persistido antes do fechamento, evitando duplicar a mensagem em uma
retomada. Se o paciente responder durante o envio do aviso, o fechamento é
cancelado; se responder imediatamente depois do fechamento, o mesmo ticket é
reaberto.
