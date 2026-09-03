# Deploy de histórico e lembretes de convênio — 03/09/2026

## Publicação

- Backend ativo: `whaticket-backend:2b8f96e-20260903T165800Z`.
- Ajuste do pedido de histórico: `f60a43d`.
- Remoção do preço particular em lembretes de convênio: `2b8f96e`.
- Workflow da branch de manutenção: `14667e2`.
- TypeScript aprovado e 89 suítes / 480 testes unitários aprovados localmente.
- CI `Test build backend` concluído com sucesso: https://github.com/brunonatanelsoaresrodrigues-png/WhatQuark/actions/runs/33782431281
- API e interface responderam HTTP 200 após a troca; backend sem reinícios inesperados.

## Lembretes de convênio

- Consultas identificadas como plano de saúde, inclusive `HAPVIDA`, não exibem o preço particular.
- Consultas identificadas como `PARTICULAR` continuam exibindo o preço.
- A proteção também é aplicada no momento do envio, cobrindo mensagens que já estavam na fila sem apagar ou recriar registros.
- Na verificação de produção havia 62 avisos HAPVIDA pendentes contendo o texto antigo; eles passam pela remoção do preço antes do envio. Os 36 avisos já enviados anteriormente não foram alterados.

## Sincronização do histórico

- O armazenamento das chaves de sincronização aceita valores longos e a importação escuta o evento de histórico sob demanda.
- O envelope de peer data da versão instalada do Whaileys 6.5.1 foi alinhado ao código atual do Baileys: destinatário PN do próprio dispositivo, metadado `appdata=default` e ausência de `tctoken` no pedido peer.
- Depois do ajuste, o WhatsApp deixou de rejeitar o pedido com código 479.
- A tentativa real seguinte iniciou com 1.219 conversas, mas o telefone não devolveu nenhum evento de histórico. A rotina encerrou depois de três esperas limitadas: 3 conversas processadas, 3 falhas e 0 mensagens importadas.
- Não houve repetição ilimitada, envio a pacientes ou criação de atendimentos por essa tentativa.
- Esse resultado coincide com a limitação registrada no repositório do próprio provedor: `fetchMessageHistory` pode enviar o pedido corretamente em um dispositivo vinculado, mas o WhatsApp não devolve o evento `messaging-history.set`. Referência: https://github.com/WhiskeySockets/Baileys/issues/2452

## Preservação

Backup completo em `/var/backups/whaticket/deploy-history-peer-20260903/`, com acesso restrito:

- dump do banco, mídia/autenticação e snapshot do Redis validados por checksum;
- todos os identificadores das tabelas e os arquivos foram preservados;
- MariaDB, Redis e frontend mantiveram os mesmos contêineres e horários de início;
- durante a reconexão, valores das chaves e da sessão do WhatsApp foram rotacionados normalmente, sem remoção dos seus identificadores; a contagem de chaves Redis permaneceu em 963;
- o canal voltou como `CONNECTED`, usando a sessão salva e sem solicitar novo QR.

Os limites de envio permaneceram em 30 mensagens por hora e 400 automáticas por dia, com intervalo de 45–90 segundos para automações e 4–8 segundos para mensagens interativas.
