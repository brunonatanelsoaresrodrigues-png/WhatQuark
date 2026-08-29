# Publicação do frontend, áudio e experiência da conversa — 28/08/2026

## Versão publicada

- Código: `4e5ecb0b20a7b2b6e39aed8e93453f3e2bf68b13`.
- Frontend: `whaticket-frontend:audio-ui-4e5ecb0-r2`.
- Backend mantido: `whaticket-backend:ui-media-9ce4275`.
- Aplicação: https://atendimento.bfontes.online.
- Release na VPS: `/opt/whaticket/releases/frontend-audio-4e5ecb0-20260828T234705`.
- Backup anterior: `/var/backups/whaticket/frontend-audio-4e5ecb0-20260828T234705`.

A publicação substituiu somente o container do frontend com `docker compose up -d --no-deps frontend`.
Backend, MariaDB e Redis mantiveram os mesmos IDs, horários de início e contagem de reinícios.
Não houve migração, logout do provedor, alteração de API ou reinício da sessão do WhatsApp.

## Correção do áudio

O pacote `mic-recorder-to-mp3` 2.2.2 continha aliases atribuídos como variáveis globais. Ao ser
carregado como módulo estrito pelo Vite, falhava com `ReferenceError: Lame is not defined` antes
de abrir o microfone. Um plugin de compatibilidade agora declara esses aliases no escopo do
módulo, sem expor objetos em `window` ou trocar a dependência.

O compositor também passou a:

- manter uma instância de gravador por conversa;
- abrir o microfone somente uma vez por tentativa;
- liberar stream e `AudioContext` ao concluir, cancelar ou sair da conversa;
- enviar o mesmo arquivo usado na prévia como MP3 `audio/mpeg`;
- preservar a chave de idempotência quando um upload precisa ser repetido;
- mostrar mensagens próprias para permissão negada, microfone ausente, dispositivo ocupado,
  navegador incompatível, gravação curta e gravação acima de 20 MB.

Nenhuma mensagem foi enviada a um paciente durante a validação. O teste de navegador usou um
stream sintético e um adaptador de API isolado.

## Interface

A conversa ganhou a composição visual solicitada: navegação compacta, lista densa com quatro
status, painel lateral de contato em telas amplas, mensagens mais leves e compositor em duas
linhas. Emoji, anexo, biblioteca de figurinhas, resposta rápida e gravação de áudio permanecem
visíveis na barra. O painel de emojis tem pesquisa e funciona por teclado. Os modos claro e
escuro compartilham tokens com contraste AA, e o painel do contato vira gaveta no celular.

## Verificações

| Conferência | Resultado |
| --- | --- |
| Testes automatizados do frontend | 23 aprovados |
| Lint dos arquivos alterados | Aprovado |
| Build de produção | Aprovado, 7.930 módulos |
| Build isolado equivalente ao de produção | Aprovado, 7.796 módulos |
| Gravação no build compilado | Prévia válida, sem erro, MP3 `audio/mpeg` de 25.728 bytes |
| Emojis | Seleção e envio simulado do emoji `😀` aprovados |
| Responsividade | 390, 1.024 e 1.440 px, sem rolagem horizontal |
| Temas | Claro e escuro verificados no navegador |
| HTTPS | HTML e três assets de entrada retornaram 200 |
| Console do navegador publicado | Sem erros |
| Dados antes/depois | 11.997 mensagens, 1.162 conversas e 902 contatos preservados |
| WhatsApp | Provedor `whaileys`, modo `production`, `CONNECTED`, sessão presente, QR vazio |
| API autenticada | Aprovada, incluindo biblioteca de figurinhas e mídia protegida |

A primeira imagem candidata copiou os arquivos para um diretório não servido pelo Nginx legado.
A checagem de marcador detectou a divergência: a interface anterior continuou sendo servida.
A imagem `r2` corrigiu o destino para `/usr/share/nginx/html`, foi verificada antes da segunda
troca e só então considerada publicada.

A troca final terminou às 20:52:37 no horário de Brasília. Para rollback, o backup contém o
`compose.yaml` anterior e a inspeção dos containers; basta restaurar a imagem anterior do
frontend e recriar apenas esse serviço.

## Ajuste incremental — 28/08/2026 às 21:02

- Código: `172d23d`.
- Frontend: `whaticket-frontend:ticket-cleanup-172d23d`.
- Release na VPS: `/opt/whaticket/releases/frontend-cleanup-172d23d-20260829T000240Z`.
- Backup anterior: `/var/backups/whaticket/frontend-cleanup-172d23d-20260829T000240Z`.

O filtro **Todos** voltou a carregar a resposta já fornecida pela API, os nomes técnicos gerados
para imagens deixaram de aparecer na conversa sem ocultar legendas reais ou nomes de documentos,
e Automação Quark recebeu um ícone de agenda distinto do gráfico de Relatórios Diários.

Foram aprovados 24 testes automatizados, lint dos arquivos alterados, build de produção e teste
visual isolado com os sete status combinados. Na VPS, apenas o frontend foi recriado. Backend,
MariaDB e Redis preservaram IDs, horários de início e zero reinícios. A conferência posterior
manteve 11.997 mensagens, 1.162 conversas e 902 contatos; o provedor `whaileys` permaneceu em
`production`, `CONNECTED`, com sessão presente e QR vazio.
