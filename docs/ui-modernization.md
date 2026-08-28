# SquadChat — modernização da interface

## Escopo e preservação

Implementação local em 28/08/2026, sobre o commit `66eb693` (figurinhas e compositor de mídia).
Mantidos React 16, Material UI 4, Vite e contratos HTTP/socket existentes. Não foram alterados
backend, autenticação, migrações, banco, regras de envio, bot, consentimento ou provedores de WhatsApp.
A API não oficial permanece; alterações visuais não eliminam o risco de bloqueio pelo WhatsApp.
Publicada na VPS em 28/08/2026 junto aos recursos de mídia. O procedimento, os backups e a
conferência de dados/sessão estão em [deploy-ui-media-2026-08-28.md](deploy-ui-media-2026-08-28.md).

## Auditoria e direção visual

A interface tinha espaçamentos e cabeçalhos diferentes por página, cores fixas incompatíveis com
o tema escuro, ações do compositor diferentes entre desktop e celular e pouca orientação quando
nenhuma conversa estava selecionada. A referência [Parolo](https://parolo.online/) orientou
hierarquia, respiro, superfícies e contraste; marca, conteúdo e composição foram mantidos próprios.

O resultado usa navegação azul-marinho, teal para ações principais, fundo claro levemente quente,
superfícies escuras em camadas e bordas discretas. Gradientes ficam concentrados na identidade e nas
ações principais. A prioridade é legibilidade e espaço para a conversa.

## Design system e componentes

`frontend/src/theme/tokens.js` centraliza cores, superfícies por modo, tipografia, espaçamento,
raios, sombras, duração/easing de movimentos e camadas. `context/DarkMode` aplica os tokens aos
componentes MUI, com foco visível e `prefers-reduced-motion`.

| Elemento | Decisão |
| --- | --- |
| Cor principal | Teal `#0C7C72`; variação clara no modo escuro |
| Fundo claro / escuro | `#F5F6F3` / `#0A171E` |
| Texto | Contraste mínimo de 4,5:1 nos pares de tokens testados |
| Tipografia | Inter quando disponível; fallback para fontes do sistema, sem novo download |
| Raios | 6, 10, 14, 20 e pill |
| Movimento | 160–280 ms; redução de movimento respeitada |
| Navegação | 272 px expandida; 76 px compacta; gaveta em tablet/celular |
| Notebook | Navegação inicialmente compacta até o breakpoint md, expansível pelo usuário |
| Ações destrutivas | Semântica vermelha de `secondary` preservada |

Componentes criados:

- `CommandMenu`: Ctrl/Cmd+K, busca sem distinção de acentos, Enter/Tab/Esc e opções conforme perfil.
- `ConversationWelcome`: saudação, contagens consultadas, entradas do dia e acesso à fila/novo atendimento.
- `PageHeading`: título, descrição, categoria e ações consistentes.
- `PageSkeleton`: carregamento de páginas e mensagens.
- `TableEmptyState`: vazio de tabelas com orientação.

## Melhorias implementadas

### Atendimento

- Busca sempre visível, filtros recolhíveis por atendente, setor, data de criação e não lidas.
- Abas de status com totais da API; busca opcional em todos os status.
- Troca de filtros limpa resultados antigos; falha mostra aviso e opção de tentar novamente.
- Atualizações de totais por socket agrupadas, sem novos endpoints.
- Cards com seleção clara, prévia da mensagem, responsável, setor e contagem de não lidas.
- Conversa e lista separadas em tablet/celular; contexto do contato abre sob demanda.
- Contato mostra responsável, fila, canal, permissões de aviso e agendamentos já retornados pela API.
- Bolhas, datas, mensagens apagadas, carregamento e estados vazios adequados aos dois temas.

### Compositor e mídia

- Menu único de anexos, emoji, resposta rápida e assinatura.
- Botões de figurinha e áudio continuam disponíveis; gravação, prévia e envio preservados.
- Seleção de arquivo abre prévia; arrastar/soltar, deduplicação e validação anteriores preservados.
- Biblioteca e exibição de figurinhas preservadas, com busca acessível e fechamento por Esc.
- Mais ações acessíveis por teclado e com nomes explícitos; remoção de ids repetidos.
- Aviso de mensagem enfileirada e assinatura continuam usando o fluxo existente.

### Demais páginas

Dashboard, conexões, contatos, respostas rápidas, usuários, filas, configurações, Quark,
automação Quark, relatórios, login e cadastro receberam o mesmo tratamento de superfícies,
espaçamento, cabeçalhos, campos e estados. O conteúdo interno do iframe Quark não foi alterado.
Contatos, usuários e respostas rápidas ignoram respostas atrasadas após troca de consulta/página.
A paginação Quark usa as propriedades suportadas pela versão MUI instalada.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| ESLint em todos os arquivos de código de interface modificados/criados | Sem erros ou avisos |
| `git diff --check` | Sem problemas |
| Testes frontend (`node --test tests/*.test.cjs`) | 18 aprovados |
| Build frontend (`vite build`) | Aprovado |
| Compilação backend (`tsc`) | Aprovada, sem alterações no backend |
| Testes unitários backend, comando equivalente a `test:unit` | 53 suítes / 257 testes aprovados |
| Testes de integração com banco | Não concluídos: exigem banco dedicado de testes |

A execução inicial de Jest sem a exclusão de integração foi interrompida pela proteção de banco
de testes ausente. A execução correta de `test:unit` foi feita depois e passou integralmente.
Não se deve interpretar esse resultado como aprovação dos testes de integração.

### QA no navegador com dados fictícios

Usados os componentes reais com adaptadores locais de API e socket, sem backend nem envio ao WhatsApp.
Verificadas larguras de 1440, 1280, 1024, 768 e 390 px, modos claro/escuro, navegação e conversa.
Conferidos busca + não lidas e os parâmetros enviados ao adaptador; falha simulada de busca;
conversa → contato em celular; anexo de texto → prévia → remoção; figurinha na conversa e biblioteca;
resposta rápida; atalho Ctrl+K, busca sem acentos e Enter; fechamento por Esc.
Um envio de texto simulado manteve a assinatura, limpou o campo e exibiu o aviso de fila.

O QA não comprova entrega real, sincronização com Quark, eventos socket reais ou persistência de mídia
no servidor. Microfone físico, arrastar arquivos a partir do sistema operacional, leitores de tela,
Safari e Firefox ainda precisam de validação específica. Os testes de contraste cobrem tokens,
não constituem certificação de acessibilidade de todas as telas.

### Reproduzir a prévia isolada

```sh
cd frontend
npm run test:visual
# Abrir http://127.0.0.1:4174/tickets
```

Somente localhost; dados fictícios, sem credenciais. O servidor está em `tests/visual/server.mjs`,
com fixtures de API/socket e um arquivo de exemplo. Ele não faz parte do entrypoint de produção.
Buscar `erro-demo` simula falha de listagem. Não usar esse servidor como deploy da aplicação.

## Limites e próximos passos

- O deploy conjunto de backend/frontend foi ensaiado em clone isolado e publicado com backup,
  conferência dos dados e reconexão sem QR. Os endpoints de mídia foram verificados; entrega
  ponta a ponta de áudio, figurinhas, bot e notificações não foi testada com pacientes reais.
- Em futuras mudanças exclusivamente visuais, publicar apenas o frontend. Para mudanças no
  backend, usar encerramento controlado e conferir a sessão, seguindo o registro do deploy.
- Build ainda avisa sobre um chunk de aproximadamente 571 kB da biblioteca de emojis.
  A biblioteca já é carregada sob demanda; sua substituição merece trabalho separado.
- Não foram inventadas métricas de espera, filtros por canal/intervalo, tags ou automações de FIFO
  sem suporte do contrato atual. Adicionar essas funções exige evolução própria da API.
- Evoluir testes automatizados de interação e cobertura de acessibilidade, paginação longa e
  estados sem permissão/sem conexão em todos os módulos.
- A identidade visual do sistema externo Quark depende do fornecedor; somente o contêiner local
  foi padronizado.

## Arquivos alterados

Além dos componentes novos acima, as alterações estão nos componentes de layout, atendimento,
compositor/mídia, cabeçalhos, seletores e listas; no tema, `hooks/useTickets`, nas páginas citadas,
em `vite.config.js` (compatibilidade JSX e carregamento de áudio no desenvolvimento), `package.json`
(comando de QA) e nos testes. O commit desta entrega contém a relação completa dos arquivos.

Lista desta entrega:

- `docs/ui-modernization.md`
- `frontend/package.json`
- `frontend/src/components/Audio/index.jsx`
- `frontend/src/components/CommandMenu/index.js`
- `frontend/src/components/ContactDrawer/index.js`
- `frontend/src/components/ConversationWelcome/index.js`
- `frontend/src/components/MainContainer/index.js`
- `frontend/src/components/MainHeader/index.js`
- `frontend/src/components/MainHeaderButtonsWrapper/index.js`
- `frontend/src/components/MediaPreviewQueue/index.jsx`
- `frontend/src/components/MessageInput/index.js`
- `frontend/src/components/MessagesList/index.js`
- `frontend/src/components/NotificationsPopOver/index.js`
- `frontend/src/components/PageHeading/index.js`
- `frontend/src/components/PageSkeleton/index.js`
- `frontend/src/components/StickerPicker/index.jsx`
- `frontend/src/components/TableEmptyState/index.js`
- `frontend/src/components/Ticket/index.js`
- `frontend/src/components/TicketContext/index.js`
- `frontend/src/components/TicketHeader/index.js`
- `frontend/src/components/TicketHeaderSkeleton/index.js`
- `frontend/src/components/TicketInfo/index.js`
- `frontend/src/components/TicketListItem/index.js`
- `frontend/src/components/TicketsAssigneeSelect/index.js`
- `frontend/src/components/TicketsList/index.js`
- `frontend/src/components/TicketsManager/index.js`
- `frontend/src/components/TicketsQueueSelect/index.js`
- `frontend/src/components/Title/index.js`
- `frontend/src/context/DarkMode/index.js`
- `frontend/src/hooks/useTickets/index.js`
- `frontend/src/layout/index.js`
- `frontend/src/layout/MainListItems.js`
- `frontend/src/pages/Connections/index.js`
- `frontend/src/pages/Contacts/index.js`
- `frontend/src/pages/DailyReports/index.js`
- `frontend/src/pages/Dashboard/Chart.js`
- `frontend/src/pages/Dashboard/index.js`
- `frontend/src/pages/Login/index.js`
- `frontend/src/pages/QuarkClinic/index.js`
- `frontend/src/pages/QuarkDashboard/index.js`
- `frontend/src/pages/Queues/index.js`
- `frontend/src/pages/QuickAnswers/index.js`
- `frontend/src/pages/Settings/index.js`
- `frontend/src/pages/Signup/index.js`
- `frontend/src/pages/Tickets/index.js`
- `frontend/src/pages/Users/index.js`
- `frontend/src/theme/tokens.js`
- `frontend/tests/themeTokens.test.cjs`
- `frontend/tests/visual/anexo-exemplo.txt`
- `frontend/tests/visual/api.js`
- `frontend/tests/visual/App.jsx`
- `frontend/tests/visual/server.mjs`
- `frontend/tests/visual/socket.js`
- `frontend/vite.config.js`
- `frontend/src/translate/languages/pt.js`
