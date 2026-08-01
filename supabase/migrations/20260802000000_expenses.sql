-- ============================================================================
-- Inventory Tracker — expense / VAT ledger (for tax records)
-- Migration 0010 (expenses)
--
-- HOW TO RUN
--   Option A (dashboard): paste this whole file into the Supabase SQL Editor
--                         and run it.
--   Option B (CLI):       `supabase db push`
--
-- WHAT THIS IS
--   A lightweight record of business expenses captured for tax/bookkeeping —
--   supplier name + TIN, the date, and the amount (with an optional net/VAT
--   split for input-VAT tracking). This is SEPARATE from inventory: an expense
--   is a bookkeeping record, never a stock movement, so it does not touch
--   `movements` or `current_stock`.
--
--   Unlike `movements` (append-only, immutable), expenses are a hand-maintained
--   ledger, so the team can edit and delete their own typos.
-- ============================================================================

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  expense_date  date        not null,
  vendor        text,
  tin           text,                                   -- supplier TIN, text (keeps format/leading zeros)
  net_amount    numeric(12, 2) check (net_amount  is null or net_amount  >= 0),
  vat_amount    numeric(12, 2) check (vat_amount  is null or vat_amount  >= 0),
  total_amount  numeric(12, 2) not null check (total_amount >= 0),
  category      text,
  note          text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users(id)
);

comment on table public.expenses is
  'Business expense / VAT records for tax. Bookkeeping only — never a stock movement.';

-- Newest-first listing and month rollups.
create index if not exists expenses_date_idx on public.expenses (expense_date desc, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS: same trusted-team model as the rest of the app — any authenticated user
-- is a team member. anon gets no policies, so signed-out requests see nothing.
-- ----------------------------------------------------------------------------
alter table public.expenses enable row level security;

grant select, insert, update, delete on public.expenses to authenticated;

drop policy if exists "expenses: team can read"   on public.expenses;
create policy "expenses: team can read"
  on public.expenses for select
  to authenticated
  using (true);

drop policy if exists "expenses: team can create" on public.expenses;
create policy "expenses: team can create"
  on public.expenses for insert
  to authenticated
  with check (created_by = auth.uid());     -- can't forge someone else as creator

drop policy if exists "expenses: team can edit"   on public.expenses;
create policy "expenses: team can edit"
  on public.expenses for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "expenses: team can delete" on public.expenses;
create policy "expenses: team can delete"
  on public.expenses for delete
  to authenticated
  using (true);
