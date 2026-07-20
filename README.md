# Prism Finance

Aplicação web para organização e acompanhamento de finanças pessoais, desenvolvida com React, TypeScript e Supabase.

O Prism Finance centraliza transações, carteiras, cartões de crédito, faturas, planejamento financeiro e relatórios em uma interface responsiva e orientada à visualização dos dados.

> O projeto está em desenvolvimento ativo. Funcionalidades, estrutura do banco de dados e regras financeiras podem sofrer alterações.

## Funcionalidades

* Cadastro de receitas e despesas
* Transferências entre carteiras
* Transações únicas, parceladas e recorrentes
* Controle de transações pagas e pendentes
* Gerenciamento de carteiras
* Gerenciamento de cartões de crédito
* Geração e acompanhamento de faturas
* Pagamento de faturas
* Categorias e subcategorias
* Beneficiários
* Tags para organização de lançamentos
* Planejamento financeiro mensal
* Simulação de receitas e despesas
* Relatórios por categoria
* Relatórios por beneficiário
* Análise de fluxo financeiro
* Lista de desejos
* Contas e recursos compartilhados por família
* Sincronização de dados com o Supabase
* Sincronização entre diferentes abas do navegador
* Backup local dos dados financeiros
* Interface responsiva para desktop e dispositivos móveis

## Tecnologias

### Frontend

* [React](https://react.dev/)
* [TypeScript](https://www.typescriptlang.org/)
* [Vite](https://vite.dev/)
* [React Router](https://reactrouter.com/)
* [Tailwind CSS](https://tailwindcss.com/)
* [Framer Motion](https://motion.dev/)
* [Lucide React](https://lucide.dev/)

### Dados e autenticação

* [Supabase](https://supabase.com/)
* Supabase Authentication
* Supabase Database
* Supabase Realtime

### Gráficos e relatórios

* [Chart.js](https://www.chartjs.org/)
* [React Chart.js 2](https://react-chartjs-2.js.org/)
* [Recharts](https://recharts.org/)

### Utilidades

* [date-fns](https://date-fns.org/)
* [UUID](https://github.com/uuidjs/uuid)
* [Radix UI](https://www.radix-ui.com/)

## Requisitos

Antes de executar o projeto, instale:

* Node.js 20 ou superior
* npm 10 ou superior
* Uma conta e um projeto no Supabase

Para conferir as versões instaladas:

```bash
node --version
npm --version
```

## Instalação

Clone o repositório:

```bash
git clone https://github.com/SEU-USUARIO/Prism-Finance.git
```

Entre na pasta do projeto:

```bash
cd Prism-Finance
```

Instale as dependências:

```bash
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-do-supabase
```

As informações podem ser encontradas no painel do Supabase:

```text
Project Settings
└── API
    ├── Project URL
    └── anon public key
```

Não utilize a `service_role key` no frontend. Essa chave possui permissões administrativas e não deve ser exposta no navegador.

Também não envie arquivos `.env` ou `.env.local` para o GitHub.

## Executando localmente

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

O Vite exibirá o endereço local da aplicação, normalmente:

```text
http://localhost:5173
```

Para permitir o acesso pela rede local:

```bash
npm run dev -- --host
```

Depois, acesse o endereço de rede mostrado pelo Vite em outro dispositivo conectado à mesma rede.

## Scripts disponíveis

### Desenvolvimento

```bash
npm run dev
```

Inicia o servidor de desenvolvimento com Hot Module Replacement.

### Build

```bash
npm run build
```

Gera a versão otimizada para produção na pasta `dist`.

### Visualização do build

```bash
npm run preview
```

Executa localmente o conteúdo gerado pelo build.

### Lint

```bash
npm run lint
```

Analisa o código utilizando ESLint.

## Estrutura principal

A estrutura pode variar conforme o desenvolvimento do projeto, mas as principais áreas estão organizadas da seguinte forma:

```text
src/
├── components/
│   ├── common/
│   ├── layout/
│   └── pages/
├── context/
│   ├── finance/
│   ├── FinanceContext.ts
│   ├── ModalContext.tsx
│   └── PageContext.tsx
├── hooks/
├── lib/
├── supabase/
├── App.tsx
└── main.tsx
```

### `components`

Contém componentes visuais, layouts e páginas da aplicação.

### `context`

Contém os contexts e stores responsáveis pelo estado global, sessão, dados financeiros e sincronização.

### `hooks`

Contém hooks reutilizáveis da aplicação, incluindo autenticação e comportamentos compartilhados.

### `lib`

Contém funções auxiliares, formatação, tratamento de datas, ícones e utilidades do domínio financeiro.

### `supabase`

Contém a integração com autenticação, banco de dados, persistência e sincronização do Supabase.

## Páginas

A aplicação utiliza React Router e possui áreas como:

```text
/home
/transactions
/statement
/planning
/wishlist
/registry
/settings
```

Algumas páginas também aceitam rotas alternativas em português ou inglês.

Como o projeto utiliza `BrowserRouter`, o servidor de produção deve redirecionar rotas desconhecidas para o arquivo `index.html`.

Na Vercel, esse comportamento é configurado pelo arquivo `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Arquitetura financeira

O Prism Finance trabalha com diferentes entidades do domínio financeiro.

### Carteiras

Representam contas, dinheiro físico, bancos ou outros locais em que o usuário mantém saldo.

### Cartões de crédito

Armazenam informações como:

* limite
* dia de fechamento
* dia de vencimento
* cartão favorito
* estado ativo ou inativo

### Transações

As transações podem representar:

* receitas
* despesas
* transferências
* compras no cartão
* pagamentos de faturas

Também podem possuir diferentes modos:

* transação única
* transação parcelada
* transação recorrente

### Grupos de transações

Transações parceladas e recorrentes são associadas a grupos, permitindo alterações com diferentes escopos:

* somente esta ocorrência
* esta e as próximas ocorrências
* toda a série

### Faturas

As faturas são calculadas com base:

* no cartão utilizado
* no ciclo de fechamento
* na data da transação
* nas parcelas relacionadas
* no estado de pagamento

### Ledger

O sistema mantém lançamentos financeiros utilizados para representar movimentos efetivos de saldo e pagamentos.

### Planejamento

A área de planejamento utiliza receitas, despesas, simulações e itens selecionados para produzir projeções e relatórios financeiros.

## Sincronização

O Prism Finance sincroniza os dados financeiros com o Supabase.

O sistema possui mecanismos para:

* carregar os dados do usuário autenticado
* normalizar dados antigos
* salvar alterações remotamente
* detectar novas revisões
* sincronizar alterações entre abas
* tratar conflitos de sincronização
* manter backup local

Por se tratar de uma aplicação financeira, alterações no sistema de sincronização devem ser testadas com cuidado.

Cenários importantes:

* aplicação aberta em duas abas
* aplicação aberta em dois dispositivos
* alteração feita enquanto outro dispositivo está offline
* fechamento da página durante uma sincronização
* atualização simultânea da mesma transação

## Configuração do Supabase

O projeto Supabase deve conter as tabelas, índices, funções e políticas necessárias para armazenar os dados do Prism Finance.

As políticas de Row Level Security devem garantir que:

* usuários só possam consultar seus próprios dados
* usuários só possam alterar seus próprios dados
* membros de uma família acessem somente recursos compartilhados autorizados
* convites familiares não exponham dados privados
* IDs enviados pelo frontend não concedam permissões adicionais
* operações administrativas não possam ser executadas com a chave pública

Ative o RLS em todas as tabelas que armazenam informações de usuários.

Exemplo conceitual:

```sql
create policy "Users can read their own records"
on public.example_table
for select
using (auth.uid() = user_id);
```

A política real deve ser adaptada à estrutura do banco e às regras de compartilhamento do Prism Finance.

## Deploy na Vercel

Importe o repositório na Vercel e configure:

### Framework preset

```text
Vite
```

### Build command

```text
npm run build
```

### Output directory

```text
dist
```

### Variáveis de ambiente

Adicione no painel da Vercel:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Depois de adicionar ou alterar uma variável de ambiente, faça um novo deploy.

O arquivo `vercel.json` é necessário para que rotas acessadas diretamente, como `/planning` ou `/transactions`, sejam redirecionadas corretamente para a SPA.

## Build de produção

Antes de enviar mudanças, execute:

```bash
npm run lint
npm run build
```

O projeto deve concluir os dois comandos sem erros.

Para testar localmente o build:

```bash
npm run preview
```

## Segurança

Dados financeiros exigem cuidados adicionais.

Recomendações:

* nunca exponha a chave `service_role`
* nunca confie somente em validações do frontend
* mantenha o Row Level Security ativado
* valide valores no banco ou em funções protegidas
* não registre dados financeiros sensíveis no console
* não armazene tokens manualmente fora do fluxo do Supabase
* revise permissões de recursos compartilhados
* mantenha dependências atualizadas
* utilize HTTPS em produção
* revise periodicamente as sessões ativas

## Testes recomendados

O projeto ainda deve receber uma suíte automatizada para as principais regras financeiras.

Cenários prioritários:

* criação de receita e despesa
* transferência entre carteiras
* parcelamento com divisão não exata
* recorrência nos dias 29, 30 e 31
* edição de uma única ocorrência
* edição das próximas ocorrências
* exclusão de uma série
* pagamento parcial de fatura
* pagamento total de fatura
* mudança no fechamento do cartão
* sincronização entre duas abas
* conflito entre alterações remotas e locais
* cálculo de saldo
* cálculo de relatórios
* permissões de recursos familiares

Uma possível stack de testes:

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

## Melhorias planejadas

Algumas melhorias estruturais recomendadas para as próximas versões:

* adicionar testes unitários e de integração
* documentar o schema do Supabase
* incluir migrations no repositório
* criar integração contínua com GitHub Actions
* adicionar verificação isolada de TypeScript
* dividir o store financeiro em módulos menores
* padronizar rotas canônicas
* revisar dependências de gráficos
* melhorar acessibilidade
* adicionar tratamento centralizado de erros
* adicionar monitoramento de erros em produção
* criar documentação das regras financeiras

## Contribuição

Este é um projeto privado e em desenvolvimento.

Antes de iniciar uma alteração:

1. Crie uma nova branch.
2. Faça mudanças pequenas e objetivas.
3. Execute o lint.
4. Gere o build de produção.
5. Teste os fluxos financeiros afetados.
6. Abra um pull request descrevendo as mudanças.

Exemplo:

```bash
git checkout -b feat/nome-da-funcionalidade
```

Depois:

```bash
git add .
git commit -m "feat: descrição da funcionalidade"
git push origin feat/nome-da-funcionalidade
```

## Padrão de commits

O projeto utiliza mensagens próximas ao padrão Conventional Commits:

```text
feat: nova funcionalidade
fix: correção de erro
refactor: refatoração sem mudança de comportamento
docs: alteração de documentação
style: alteração visual ou de formatação
test: adição ou alteração de testes
chore: manutenção e configuração
```

Também podem ser utilizados escopos:

```text
feat(planning): add category reports
fix(finance): resolve synchronization conflict
refactor(transactions): extract recurring transaction logic
```

## Licença

O Prism Finance é um projeto privado.

Todos os direitos são reservados ao proprietário do repositório. O código não deve ser copiado, distribuído, publicado ou utilizado sem autorização.
