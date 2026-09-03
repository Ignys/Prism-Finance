# Persistência financeira

## Modelo de consistência

O PostgreSQL é a fonte de verdade. O estado React e o backup local são cache e mecanismo de recuperação; eles não podem definir saldos, totais de fatura, permissões familiares ou a ordem global das gravações.

Cada usuário possui uma revisão monotônica em `finance_sync_state`. O boot lê todos os dados com uma única chamada a `load_finance_snapshot()`; atualizações posteriores consomem páginas de revisões completas por `load_finance_changes()`. Gravações enviam deltas para `apply_finance_changes(expected_revision, changes, client_id)`.

A gravação:

1. bloqueia a linha de revisão do usuário;
2. rejeita uma revisão-base obsoleta;
3. aplica upserts e deleções explícitas na mesma transação;
4. registra tombstones e a auditoria da revisão;
5. atualiza projeções financeiras e publica a nova revisão somente no commit.

Isso elimina a janela na qual a aplicação podia combinar tabelas de revisões diferentes e elimina a dependência do limite de paginação do PostgREST. Uma lista vazia em um delta não significa “apague a tabela”.

## Conflitos e deleções

As tabelas financeiras possuem `version` e `updated_at`. Deleções são registradas em `finance_tombstones` com a mesma revisão do commit. Em um conflito, o cliente recarrega o snapshot confirmado e faz um merge de três vias por campo: edições independentes na mesma entidade são combinadas. Uma deleção confirmada pelo servidor vence uma alteração feita sobre uma base obsoleta, evitando ressurreição acidental em outro dispositivo.

Cada entidade removida por cascata recebe seu próprio tombstone. Ações `SET NULL` também atualizam `version`, portanto consumidores incrementais recebem tanto a remoção do pai quanto os filhos removidos ou desvinculados. O snapshot canônico continua sendo o fallback para lacunas de revisão.

`save_finance_snapshot` permanece temporariamente disponível como adaptador não destrutivo para clientes antigos: ele converte o snapshot em upserts, nunca interpreta ausência como deleção e ignora entidades que já possuem tombstone. Assim, paginação, coleções vazias ou caches antigos não apagam nem ressuscitam dados. Deleções e recriações intencionais exigem `apply_finance_changes`; remova o adaptador depois do rollout.

## Invariantes no banco

- lançamentos do ledger são projeções determinísticas das transações pagas; o RPC rejeita upserts/deletes de ledger vindos do cliente e marcar/desmarcar pagamento cria ou remove as partidas no PostgreSQL;
- `wallets.balance` e `ledger_entries.balance_after` são recalculados a partir de `initial_balance + ledger_entries.amount`.
- `credit_card_invoices.total_amount` é recalculado a partir das transações ligadas à fatura.
- `credit_card_invoices.paid_amount` é a soma das transações pagas ligadas por `payment_for_invoice_id`; o frontend já persiste esse vínculo e o marcador em notas continua apenas como compatibilidade para clientes antigos durante o rollout.
- pagamentos que excedem o total da fatura são rejeitados antes de gerar débito no ledger.
- uma transação paga precisa ter `paid_at`; outros estados não podem ter `paid_at`;
- valores de fatura, desejos, limites e totais possuem limites não negativos;
- ciclos de fatura e números de parcela não podem se repetir no mesmo escopo;
- uma transação ligada a uma fatura deve resolver para o mesmo cartão;
- FKs compostas impedem referências a entidades de outro usuário;
- ações `SET NULL` de FKs compostas nomeiam apenas a coluna opcional, preservando o `user_id`; carteiras/cartões removidos em definitivo propagam `CASCADE` para operações dependentes;
- deleções de transações/faturas removem lançamentos dependentes, detalhes, metadados de anexos e tags no banco;
- caminhos de blobs removidos por cascata entram em `attachment_deletion_queue` e são drenados pela API de Storage depois do commit, com retry seguro.

Os campos de nome/categoria/carteira no grupo são defaults da série. Os campos equivalentes em `transactions` são overrides por ocorrência. A view `effective_transactions` resolve isso com `coalesce(transaction.override, transaction_group.default)` e evita uma terceira cópia.

## Segurança familiar

Não existe escrita direta em `families`, `family_members` ou `family_invites` para `authenticated`. As únicas operações aceitas são:

- `create_family`;
- `create_family_invite`;
- `accept_family_invite`;
- `cancel_family_invite`;
- `remove_family_member`.

O papel de um novo membro é sempre `member`, definido no PostgreSQL. O aceite exige convite pendente, não expirado, bloqueado com `FOR UPDATE`; o criador não pode aceitar o próprio convite. O dono é protegido por constraint deferred e precisa continuar membro ativo/admin. `member_count` é projeção mantida por trigger.

`get_current_family_context` retorna membros, convites visíveis ao admin e somente a projeção compartilhável das wishlists. As tabelas financeiras dos outros membros continuam protegidas por RLS e não são consultáveis diretamente. Mudanças compartilháveis incrementam `family_share_sync_state`; o Realtime transmite apenas essa revisão e cada cliente recarrega a projeção estreita.

## Rollout

1. Faça backup e rode as consultas de pré-validação abaixo.
2. Aplique migrations `005` a `014`, na ordem numérica.
3. Publique o frontend com protocolo incremental 2. Ele continua aceitando a resposta antiga da migration `007`.
4. Aplique as migrations `015` e `016`; clientes novos passam a receber somente o delta canônico, enquanto abas antigas continuam recebendo o snapshot compatível durante o rollout. A `016` ajusta as RPCs ao schema real do `pgcrypto` no Supabase.
5. Execute `supabase test db` no ambiente local/staging.
6. Compare contagens, saldos e faturas por usuário antes/depois.
7. Monitore conflitos e `finance_change_log` durante o rollout.
8. Atualizações Realtime/cross-tab usam `load_finance_changes(since_revision, revision_limit)`; a paginação ocorre por revisões completas, nunca cortando uma transação no meio. Boot inicial, conflitos e qualquer lacuna (`requires_full_reload`) usam o snapshot atômico como fallback seguro.

A migration `015` também troca projeções linha a linha por lotes e move a fila pendente do `localStorage` para IndexedDB.

Pré-validação recomendada:

```sql
select user_id, count(*) from family_members where status = 'active' group by user_id having count(*) > 1;
select user_id, credit_card_id, cycle_key, count(*) from credit_card_invoices group by 1, 2, 3 having count(*) > 1;
select user_id, group_id, installment_number, count(*) from transactions where installment_number is not null group by 1, 2, 3 having count(*) > 1;
select user_id, transaction_id, wallet_id, count(*) from ledger_entries where transaction_id is not null group by 1, 2, 3 having count(*) > 1;
select user_id, count(*) from beneficiaries where is_self_profile group by 1 having count(*) > 1;
select user_id, id from transactions where amount <= 0;
select user_id, id, storage_path from transaction_attachments where storage_path not like user_id::text || '/%';
select i.user_id, i.id, i.total_amount, sum(abs(t.amount)) filter (where t.status = 'paid') as legacy_payment_total
  from credit_card_invoices i join transactions t
    on t.user_id = i.user_id and split_part(t.notes, '|', 2) = i.id
 where t.notes like '[prism-invoice-payment]|%|%'
 group by i.user_id, i.id, i.total_amount having sum(abs(t.amount)) filter (where t.status = 'paid') > i.total_amount;
```

Pagamentos legados que excedam o total não são descartados: a migration `010` mantém a transação/ledger, não cria o vínculo relacional excedente e permite conciliação manual posterior.

As constraints de transferências e estado de faturas foram criadas como `NOT VALID` para não bloquear o deploy por registros legados. Depois de corrigir os resultados abaixo, valide-as:

```sql
alter table transaction_groups validate constraint transaction_groups_transfer_wallets_check;
alter table credit_card_invoices validate constraint credit_card_invoices_paid_state_check;
alter table transactions validate constraint transactions_amount_positive_check;
alter table transaction_attachments validate constraint transaction_attachments_owner_path_check;
```

## Testes

Os testes TypeScript cobrem geração/aplicação de deltas, merges concorrentes, liquidação de faturas e permanent delete. `test:migrations` sobe PostgreSQL embarcado e executa todas as migrations e cenários de RLS, convite, CAS, projeções, cascatas, tombstones, anexos e fallback. A suíte pgTAP em `supabase/tests` pode ser executada adicionalmente no Supabase local/staging.

```bash
npm test
npm run test:migrations
npm run typecheck
npm run lint
npm run build
supabase test db
```
