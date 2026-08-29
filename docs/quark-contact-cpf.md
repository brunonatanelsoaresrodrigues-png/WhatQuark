# CPF e cadastro do paciente no Quark

O cadastro de contato ganhou o campo opcional `cpf`, armazenado somente com dígitos e validado no backend. O CPF nunca substitui um valor já preenchido: a sincronização automática acontece apenas quando o cadastro ainda está vazio.

Quando o usuário possui acesso ao Quark Clinic, o painel de detalhes do contato consulta o espelho local de agendamentos e, se necessário, atualiza o agendamento no Quark para recuperar CPF e data de nascimento. Os dados são exibidos no painel e o CPF é persistido no contato sem alterar mensagens, tickets ou a sessão do WhatsApp.

O botão **Ver cadastro no Quark** usa a rota interna `/quark-clinic?patientId=...&returnTo=/tickets/...`. A tela integrada exibe os dados do paciente no mesmo módulo e mantém o retorno ao atendimento atual. A API externa continua sendo a integração não oficial já configurada; nenhuma chamada de envio ou alteração de agendamento é feita nessa consulta.

Rotas protegidas adicionadas:

- `GET /quark/clinic/contacts/:contactId`
- `GET /quark/clinic/patients/:patientId`

Ambas exigem autenticação e permissão de visualização do Quark Clinic.
