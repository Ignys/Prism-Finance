# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Prism Finance — personal finance web app (React 19 + TypeScript + Vite + Tailwind v4 + Supabase). UI text and most docs are in Portuguese; keep that language in user-facing strings. `AGENTS.md` (pt-BR) holds the file-organization rules for this repo — small files, split responsibilities, page components as orchestrators — and applies here too.

## Commands

```bash
npm run dev              # Vite dev server (add -- --host for LAN)
npm run build            # vite build --configLoader runner
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm run test             # vitest run --configLoader runner
npm run test -- src/context/finance/installmentTransactions.test.ts   # single file
npm run test -- -t "nome do caso"                                     # single case
npm run test:migrations  # replays supabase/migrations in PGlite + runtime assertions
```

`--configLoader runner` is required for build/test (Vite/Vitest config loading in this environment); keep it when adding scripts.

Env: `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only, never service_role).

## Architecture

### Data flow

PostgreSQL is the source of truth. React state and the local backup are cache/recovery only — they must never define balances, invoice totals, family permissions, or write ordering.

- Boot: single `load_finance_snapshot()` RPC.
- Updates: pages of complete revisions from `load_finance_changes()`.
- Writes: deltas to `apply_finance_changes(expected_revision, changes, client_id)`; it locks the user's revision row, rejects a stale base revision, applies upserts + explicit deletes in one transaction, writes tombstones, refreshes projections, and publishes the new revision only on commit.
- An empty list in a delta never means "delete the table".
- Conflicts: the client reloads the committed snapshot and does a per-field three-way merge (`financeSyncMerge.ts`); a server-confirmed delete beats an edit made on a stale base.
- Writes are queued and retried in `useFinanceSyncQueue.ts`, persisted across reloads via `pendingFinanceSyncStorage.ts`, and mirrored across browser tabs by `crossTabSync.ts`.

`docs/finance-persistence.md` is the authoritative description of this model, DB invariants, and family security — read it before touching sync, ledger, or invoice logic.

### Database invariants live in Postgres

Ledger entries are deterministic projections of paid transactions; the RPC **rejects** client upserts/deletes of `ledger_entries`. `wallets.balance`, `credit_card_invoices.total_amount` and `paid_amount` are recomputed server-side. Composite FKs prevent cross-user references. Family tables are writable only through RPCs (`create_family`, `create_family_invite`, `accept_family_invite`, `cancel_family_invite`, `remove_family_member`). Never edit an applied migration in `supabase/migrations/`; add a new numbered one and validate with `npm run test:migrations`.

### Frontend state

`FinanceProvider` (`src/context/finance/provider.tsx`) wraps one big store hook (`useFinanceStore.ts`) and fans it out into ~20 narrow contexts (`contexts.ts`) to limit re-renders. Consume through the granular hooks in `hooks.ts` (`useFinanceWallets`, `useFinanceTransactions(period)`, `useFinanceActions`, `useFinanceSync`, …); `useFinance()` returns everything and should be a last resort.

### Domain layers under `src/context/finance/`

- `financeCore.ts`, `ledger.ts`, `snapshot.ts`, `normalizers.ts`, `invoiceStatus.ts` — pure domain logic re-exported by `index.ts`.
- `transactionCreation/` — draft → snapshot creation (`createTransactionSnapshot.ts`).
- `transactionSeries/` — edits/deletes across scopes with `atomicPersistence.ts` and `invariants.ts`.
- `recurrence/` — rules, period math, occurrence projection/materialization, series revision merging.
- `installmentTransactions.ts`, `invoiceSettlement.ts`, `syncCreditCardInvoices.ts`, `permanentDeletion.ts`.

Transactions are single, installment, or recurring; installment/recurring ones belong to a transaction group and are edited with scope (this occurrence / this and future / whole series). Per-occurrence fields on `transactions` are overrides over the group's defaults; the `effective_transactions` view resolves them with `coalesce` — do not add a third copy of that data.

`src/supabase/finance/` is the only place that talks to Supabase (RPC calls, row mappers, realtime, incremental service, attachment cleanup). Keep domain rules out of it and out of components.

### UI

`App.tsx` lazy-loads each page and routes both Portuguese and English paths to the same component. Pages under `src/components/pages/<page>/` are orchestrators composed of panel/card/form subcomponents; shared pieces live in `common/` and `ui/`. Tailwind v4 via `@tailwindcss/vite` (no tailwind.config); charts through both Chart.js and Recharts (`src/lib/chart.ts` registers Chart.js).

## Working rules

- Inspect the relevant implementation before editing; prefer minimal, focused changes and existing patterns over new abstractions. Don't refactor unrelated code unless asked.
- Keep strict typing; avoid `any` and never silence TS errors to make a build pass. Derive types from existing domain models.
- Don't duplicate business rules between frontend and database — the DB already enforces the financial invariants.
- Layouts must stay responsive (desktop and mobile); avoid fixed widths.
- After a change: review the diff, run `npm run typecheck`, the relevant tests, and lint. State plainly what was and wasn't verified.
