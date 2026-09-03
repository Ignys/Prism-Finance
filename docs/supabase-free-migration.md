# Migracao para Supabase Free

Este projeto usa Supabase como fonte principal dos dados financeiros e de autenticacao. Firebase foi removido do frontend; referencias a Firebase neste documento existem apenas como historico da migracao.

## Escopo do plano Free

- Banco Postgres do Supabase como fonte principal dos dados financeiros.
- Supabase Auth como autenticacao final para permitir RLS direto pelo frontend.
- Sem Edge Functions obrigatorias. Realtime publica apenas revisoes para invalidacao de cache; anexos usam Storage e uma fila duravel de limpeza.
- `planning` fica em `jsonb` por enquanto, porque o restante do dominio financeiro ja ganha tabelas relacionais.

## Variaveis de ambiente

Adicione no `.env.local` quando o projeto Supabase existir:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

Variaveis Firebase nao sao mais necessarias no frontend.

## Aplicar schema

No painel do Supabase, abra `SQL Editor` e execute as migrations em ordem:

```text
supabase/migrations/001_initial_finance_schema.sql
supabase/migrations/002_transaction_overrides.sql
supabase/migrations/003_finance_sync_revision.sql
supabase/migrations/004_transaction_details_and_attachments.sql
supabase/migrations/005_family_security.sql
supabase/migrations/006_finance_integrity_and_versions.sql
supabase/migrations/007_atomic_incremental_finance_rpc.sql
supabase/migrations/008_attachment_deletion_queue.sql
supabase/migrations/009_financial_ledger_invariants_and_views.sql
supabase/migrations/010_invoice_payment_projection.sql
supabase/migrations/011_correct_composite_foreign_keys.sql
supabase/migrations/012_cascaded_change_tracking.sql
supabase/migrations/013_family_shared_wishlists.sql
supabase/migrations/014_family_share_realtime.sql
supabase/migrations/015_batched_finance_commits.sql
supabase/migrations/016_pgcrypto_function_search_path.sql
```

Em um ambiente que já está na migration `014`, publique primeiro o frontend com protocolo incremental 2 e só então aplique a `015`. O frontend novo aceita os dois formatos; a `015` mantém a resposta antiga para abas antigas durante o rollout.

Se a `015` já foi aplicada, execute a `016` antes de reabrir o aplicativo. Ela corrige o `search_path` das RPCs para o schema real do `pgcrypto` no Supabase e elimina o erro `function digest(text, unknown) does not exist`.

O schema ativa RLS para leitura no escopo de `auth.uid() = user_id`. Escritas nas tabelas financeiras centrais e nas tabelas de familia sao revogadas do cliente e passam por RPCs transacionais.

## Ordem de migracao

1. Criar o projeto Supabase no plano Free.
2. Aplicar o schema SQL.
3. Migrar usuarios legados para Supabase Auth, se ainda houver contas antigas fora do Supabase.
4. Gerar uma tabela de equivalencia entre `firebase_uid` e `auth.users.id`, apenas quando importar dados legados.
5. Exportar os documentos legados do Firestore, se a importacao ainda for necessaria.
6. Normalizar cada objeto `finance` usando a logica atual do app.
7. Gravar o resultado com `apply_finance_changes` (o serviço `saveSupabaseFinanceData` já calcula o delta).
8. Comparar totais antes de trocar a leitura do app.

## Validacoes minimas

Ao importar dados legados, confira por usuario:

- quantidade de carteiras
- quantidade de cartoes
- quantidade de grupos de transacao
- quantidade de transacoes
- total de lancamentos pagos
- saldo por carteira
- total aberto e pago por fatura
- quantidade de categorias, tags, beneficiarios e desejos

## Limites praticos

O plano Free deve servir para desenvolvimento e validacao. O boot e o fallback de recuperacao agregam um snapshot atomico no PostgreSQL, sem o limite padrao de paginacao do PostgREST. Depois do boot, o frontend ja consome revisoes e tombstones em paginas de commits completos; snapshots muito grandes ainda consomem memoria e banda quando um fallback for necessario.

Veja [finance-persistence.md](./finance-persistence.md) para segurança familiar, invariantes, rollout, pré-validação e testes.
