# Migracao para Supabase Free

Este projeto deve migrar para Supabase sem usar recursos pagos no primeiro corte. A estrategia recomendada e manter o Firebase ativo ate validar que os dados carregados no Supabase batem com os dados atuais.

## Escopo do plano Free

- Banco Postgres do Supabase como fonte principal dos dados financeiros.
- Supabase Auth como autenticacao final para permitir RLS direto pelo frontend.
- Sem Edge Functions, Realtime ou Storage obrigatorios no primeiro corte.
- `planning` fica em `jsonb` por enquanto, porque o restante do dominio financeiro ja ganha tabelas relacionais.

## Variaveis de ambiente

Adicione no `.env.local` quando o projeto Supabase existir:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

Mantenha as variaveis do Firebase durante a fase de migracao. Elas ainda serao usadas enquanto a tela de login e a carga inicial nao forem trocadas para Supabase Auth.

## Aplicar schema

No painel do Supabase, abra `SQL Editor` e execute:

```text
supabase/migrations/001_initial_finance_schema.sql
```

O schema ativa RLS e libera cada tabela financeira apenas para `auth.uid() = user_id`.

## Ordem de migracao

1. Criar o projeto Supabase no plano Free.
2. Aplicar o schema SQL.
3. Migrar usuarios do Firebase Auth para Supabase Auth.
4. Gerar uma tabela de equivalencia entre `firebase_uid` e `auth.users.id`.
5. Exportar os documentos `users/{uid}` do Firestore.
6. Normalizar cada objeto `finance` usando a logica atual do app.
7. Gravar o resultado com `saveSupabaseFinanceData`.
8. Comparar totais antes de trocar a leitura do app.

## Validacoes minimas

Antes de desligar Firestore, confira por usuario:

- quantidade de carteiras
- quantidade de cartoes
- quantidade de grupos de transacao
- quantidade de transacoes
- total de lancamentos pagos
- saldo por carteira
- total aberto e pago por fatura
- quantidade de categorias, tags, beneficiarios e desejos

## Limites praticos

O plano Free deve servir para desenvolvimento e validacao. Se o historico financeiro crescer muito, os primeiros gargalos provaveis serao tamanho do banco, volume de leituras e volume de usuarios ativos. A modelagem criada aqui evita documentos gigantes e facilita migrar para um plano pago depois sem mudar o app de novo.
