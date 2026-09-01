# Verificação local — ajustes de atendimento

Data: 27–28/08/2026. Transporte mantido: Whaileys / wwebjs, sem exigência de API oficial.

| Verificação | Resultado |
| --- | --- |
| TypeScript backend | Compilação aprovada |
| Jest backend | 246 testes aprovados em 50 suítes |
| Frontend (HTTP e rascunhos) | 9 testes aprovados |
| Build Vite | Aprovado; aviso de chunk de emojis de 571 kB, carregado sob demanda |
| Conversa desktop 1280×720 | Cabeçalho, Resolver, Contexto e editor acessíveis |
| Conversa móvel 390×844 | Largura da página 390 px; cabeçalho 64 px; Resolver dentro da tela |
| Rascunho | Preservado ao alternar Ana → Beatriz → Ana, com dados fictícios |
| Quark | Agenda mensal, seleção do dia, abas de consultas/indicadores, filtros e prévia de lembrete inspecionados |
| Temas | Claro e escuro inspecionados |
| Console | Sem erros na inspeção do painel final; testes isolados não substituem telemetria real |

Não foram enviados textos nem feitas alterações no Quark pelo navegador. O servidor de demonstração rejeita mutações e usa dados fictícios. Testes de usuários que requerem banco ficaram separados. A concorrência entre múltiplos processos, o transporte real e mutações no Quark não foram exercitados com destinatários reais.

## Ensaio na VPS — banco isolado

Imagem baseada no runtime em produção, Node 22.23.2, com as versões existentes do Whaileys e wwebjs. Banco temporário `whaticket_safety_20260828`, restauração de backup consistente, sem workers e sem iniciar qualquer conexão WhatsApp.

- As três migrations pendentes foram aplicadas com sucesso: padrão de perfil de usuários, fila/estado de segurança e compatibilidade da implantação.
- Login autenticado, bloqueio sem sessão, listagem de tickets, histórico, contexto, atendentes e os cinco endpoints do painel Quark retornaram os resultados esperados.
- Modo de simulação bloqueou envio e escrita no Quark.
- Conferência de contagem e assinatura dos conteúdos preservou 10.767 mensagens; 1.065 tickets e 1.521 registros de chaves foram preservados.
- A primeira execução encontrou uma dependência ausente no adaptador Cloud opcional. O suporte multipart passou a usar recursos nativos do Node; o novo ensaio aprovou a inicialização sem instalar ou atualizar o conector atual.
- Nenhum teste de envio foi feito contra paciente real. O acesso externo ao Quark foi desabilitado no clone.

## Capturas

- [Calendário Quark após conciliação com produção](review-assets/2026-08-27/after-quark-calendar-desktop.png)
- [Quark desktop](review-assets/2026-08-27/after-quark-desktop.png)
- [Atendimento desktop](review-assets/2026-08-27/after-chat-desktop.png)
- [Atendimento móvel escuro](review-assets/2026-08-27/after-chat-mobile-dark.png)

As capturas possuem identificação de demonstração e não contêm dados reais de pacientes. Não representam produção.
