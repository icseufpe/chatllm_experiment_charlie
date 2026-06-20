# Strategic Blueprint

> Focus on the **what** and **why**. The code will follow.

**Hard rule**: AI agents must not edit this file and must not draft paste-ready content for it.

## The Problem
_Implementar sessões  de chat e título em uma barra lateral, de forma que o usuário consiga criar novas sessões, alternar entre elas, renomear e deletar elas._


## Steps
- [ ] _Criar sessões._
- [ ] _Listar sessões._
- [ ] _Obter  sessão por id._
- [ ] _Editar sessão._
- [ ] _excluir sessão._
- [ ] _Postar mensagem em sessão._

## Success Looks Like
- [ ] _Criar sessão adiciona um item na barra lateral._
- [ ] _Deletar sessão remove o item da barra lateral._
- [ ] _Ao clicar em uma sessão, o chat dessa sessão é exibido._
- [ ] _Ao renomear, o usuário acessa um campo de digitação para alterar o nome._
- [ ] _Se a sessão não tiver título manual, o título é criado com base na primeira mensagem._
- [ ] _Ao alternar de sessão, a tela mostra o chat da sessão selecionada._
- [ ] _O histórico de cada sessão é preservado separadamente._
- [ ] _O badge “Automático” aparece quando o título foi gerado automaticamente._
- [ ] _Erros de salvamento ou de geração de título são exibidos ao usuário._

## Notes
- [ ] _O usuário não pode manter mais de 100 sessões._
- [ ] _O título automático gerado não deve  retornar algo vazio ou ofensivo._
- [ ] _Prompts vazios não podem ser enviados._
- [ ] _Caso o usuário renomeie uma sessão antes de utilizar ela, a criação automática não deve sobrescrever._
- [ ] _Duas requisições concorrentes alteram a mesma sessão ou enviam mensagens na mesma sessão. Isso deve ser administrado utilizando uma fila de alterações_
- [ ] _A exclusão deve ser soft. Ou seja, uma sessão deletada deve ser enviada incialmente para lixeira e lá há a opção de deletar permanentemente ou automaticamente após 15 dias._
- [ ] _A aplicação deve notiificar o usuário  quanto a erros ao salvar nome, mensagem ou aoo tentar gerar titulo automático._

---
**⚠️ HUMAN ONLY**: This file is your strategic space. AI agents must not edit it.
