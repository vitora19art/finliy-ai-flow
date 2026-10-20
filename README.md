# Finliy: Your AI Powered Planner

Crie uma aplicação web chamada FINLIY para gestão financeira e de rotina baseada em IA.

Página Inicial / Layout:

Adicione um banner fixo no topo com o aviso: '⚠️ Esta é uma versão Beta de validação (MVP) criada para testes. Pode conter pequenos erros. Por favor, deixe seu feedback para ajustarmos o app às necessidades reais da sua empresa!'

Inclua um botão destacado no cabeçalho: 'Enviar Feedback' que abre um formulário simples de sugestões/erros.

Crie uma barra lateral (Sidebar) com navegação entre:

Plano Pessoal (Foco em Tabela de Rotina/Hábitos).

Plano Empresarial (Foco em Gestão Financeira de Entradas, Saídas e Saldos).

A interface central deve ser estilo Chat (semelhante ao ChatGPT), com histórico de mensagens e campo para o usuário digitar comandos. rie os componentes de entrada de dados no chat:

Modal de Cadastro Inteligente: Adicione um botão para abrir este modal. Ele deve ter um campo de texto onde o usuário digita uma frase (ex: 'vendi 500 reais em produtos de pet'). Adicione uma área de 'Preview da Transação' que identifica e preenche automaticamente os campos: Tipo (Receita/Despesa), Categoria e Valor Estimado.

Upload de Arquivos: Adicione uma área onde o usuário possa arrastar ou selecionar arquivos (formatos suportados: PDF, DOC, DOCX, JPG, PNG, ZIP, XLSX - tamanho máximo 20MB) com o texto: 'Aqui é onde acontecem os uploads de Excel, imagens e comprovantes'.  Configure a exibição das respostas e tabelas no chat:

Tabela Financeira (Plano Empresarial): Deve exibir as colunas: Data, Descrição, Categoria, Entrada (R$), Saída (R$) e Saldo (R$), além da linha de TOTAL no final.

Tabela de Rotina (Plano Pessoal): Deve exibir as colunas: Horário, Atividade, Duração e Checkbox de Concluído, além de um campo inferior para 'Notas'.

Regra de Negócio: No Plano Pessoal, bloqueie ou oculte a opção de computar vendas e compras, exibindo um aviso amigável sugerindo alternar para o Plano Empresarial.  e não deixe passar nada doque eu falei analisie cada palavra minusiosamente

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://finliy-ai-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7ed00379-8355-45e6-87cf-1011d517e995).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
