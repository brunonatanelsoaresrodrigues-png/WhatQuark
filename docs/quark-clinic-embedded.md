# Quark Clinic incorporado ao WhaTicket

O frontend disponibiliza a rota `/quark-clinic`, que carrega o portal oficial
do Quark Clinic dentro da área autenticada do WhaTicket. O WhaTicket não recebe
nem armazena as credenciais usadas no portal do Quark.

## Controle de acesso

- A coluna `Users.canAccessQuarkClinic` controla o acesso individual.
- Administradores podem alterar a permissão em **Administração > Usuários**.
- Administradores que já existiam antes da migração recebem acesso inicial.
- Novos usuários começam sem acesso, salvo quando um administrador os cria com
  a opção **Permitir acesso ao Quark Clinic** ativada.
- O menu só aparece para usuários autorizados e a própria página redireciona
  usuários sem permissão para `/tickets`.

## Sessões do Quark

A sessão é controlada pelo domínio `ng.quarkclinic.com.br`. Em computadores ou
perfis de navegador diferentes, cada pessoa pode manter seu próprio login. Em
um navegador compartilhado, o último login do Quark poderá continuar ativo
mesmo depois da troca do usuário do WhaTicket; nesse cenário, é necessário sair
do Quark ou usar perfis separados do navegador.

## Configuração

A URL pode ser alterada pela variável de ambiente do frontend:

```env
VITE_QUARK_CLINIC_URL=https://ng.quarkclinic.com.br/
```

Se o portal incorporado for bloqueado futuramente por uma política do Quark ou
do navegador, a tela oferece a opção **Abrir separadamente**.
