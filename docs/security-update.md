# Atualização de segurança — 27/08/2026

## Mudanças

- A API de envio valida exclusivamente `Settings.userApiToken` e exige Bearer.
- O cadastro público cria somente o perfil `user`, sem filas, canal ou acesso ao Quark. Novas instalações começam com cadastro público desativado. A configuração das instalações existentes é preservada.
- Administradores acessam todos os tickets. Atendentes acessam os próprios tickets e os pendentes, sempre nas filas permitidas ou sem fila. Relatórios internos são exclusivos de administradores. Filtros de data, busca e `showAll` não removem essas restrições.
- A mesma autorização protege mensagens, alterações de tickets, anexos e eventos de WebSocket. Os eventos são revalidados após transferências. Exclusão de tickets e gerenciamento de conexões exigem administrador.
- Arquivos de `/public` exigem Bearer e acesso à conversa. A interface usa downloads autenticados; não há token na URL. Novos nomes de arquivo são aleatórios, uploads têm limite e caminhos externos são recusados.
- JWTs usam segredos distintos de pelo menos 32 caracteres. Sessões são verificadas no banco. Logout e alterações de usuário revogam os tokens anteriores.
- A recuperação da fila Quark acontece em cada ciclo, inclusive quando o processo reinicia antes de vencer o timeout da mensagem.
- Interceptadores HTTP são instalados uma vez, renovações concorrentes compartilham a mesma requisição e falhas de permissão não disparam renovação.
- Docker e CI usam Node 22 e `npm ci --legacy-peer-deps`, com lockfiles versionados. O Dockerfile de baixo consumo inclui `.sequelizerc`.

## Antes de atualizar produção

1. Faça backup do banco, do volume `public` e dos dados de sessão do WhatsApp.
2. Gere dois segredos diferentes e aleatórios, configure `JWT_SECRET` e `JWT_REFRESH_SECRET` e não os publique. Exemplo de geração local: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
3. Revise as contas administrativas existentes e o estado de `userCreation`. Esta atualização não rebaixa nem exclui contas existentes. Se o cadastro público estava exposto, confira contas desconhecidas.
4. Rotacione `userApiToken` no banco ou pela API administrativa e atualize os clientes de integração. Não envie o novo valor por logs ou mensagens públicas.
5. Compile backend e frontend e publique ambos juntos. O frontend anterior não consegue reproduzir todos os anexos com a nova proteção.
6. Execute a migration `20260827000000-default-new-users-to-user`. Ela altera apenas o valor padrão para novos registros; não apaga conversas ou usuários.
7. Peça um novo login aos usuários. Tokens de acesso anteriores, sem versão de sessão, são rejeitados; uma renovação válida pode substituí-los enquanto o segredo anterior for mantido.
8. Use HTTPS e mantenha frontend/backend sob o mesmo site, por exemplo `atendimento.exemplo.com` e `api.exemplo.com`, para o cookie de renovação `SameSite=Lax`.
9. Confirme que o proxy não serve o volume `public` diretamente e remova eventuais caches antigos de anexos. O tráfego deve passar pelo backend autenticado.
10. Antes de liberar, homologue com um administrador e dois atendentes de filas diferentes: consulta direta de ticket, transferência, mensagens, áudio, vídeo, download e logout. Mantenha as automações em modo de teste até validar destinatários autorizados.

## Desenvolvimento e testes

Use Node 22 ou superior. Em cada diretório, instale com `npm ci --legacy-peer-deps`.

- Backend: `npm run build` e `npm test`. A suíte padrão é isolada, não executa migrations nem apaga banco.
- Frontend: `npm run build` e `npm test`.
- Os testes de integração antigos de usuários ficam em `npm run test:integration`. Eles precisam de um banco exclusivo, com `test` no nome, configurado em `.env.test`, com migrations e seeds aplicados previamente. Eles limpam esse banco; nunca use produção.

A configuração atual usa `VITE_BACKEND_URL`, não `REACT_APP_BACKEND_URL`.

## Limites da validação local

Verificação desta alteração, com Node 24.19.0: build TypeScript do backend aprovado, 101 testes isolados do backend aprovados (27 suítes), 6 testes de autenticação HTTP do frontend aprovados e build Vite aprovado. Login e cadastro foram conferidos no navegador, inclusive após o build final, sem erros de console. YAMLs de Compose/CI e correspondência dos lockfiles também foram conferidos. O CI está configurado para Node 22; não foi executado remotamente nesta revisão.

Builds, testes isolados e telas públicas podem ser verificados sem WhatsApp ou QuarkClinic. A migração e os fluxos reais de envio precisam de homologação com MariaDB e conexões de teste. Nenhuma credencial ou base de produção foi usada nesta alteração.

Os lockfiles estabilizam a árvore atual, mas não substituem uma atualização planejada das bibliotecas legadas. O frontend ainda tem um aviso de bundle grande. A mudança não garante entrega exatamente uma vez diante de falha entre envio ao WhatsApp e persistência do resultado.
