-- ============================================================================
-- Inventory Tracker — billing due reminders
-- Migration 0014 (bills)
--
-- HOW TO RUN
--   Option A (dashboard): paste this whole file into the Supabase SQL Editor
--                         and run it.
--   Option B (CLI):       `supabase db push`
--
-- WHAT THIS IS
--   Recurring monthly bills (credit cards, loans, e-wallets, subscriptions) with
--   a due day-of-month, so the app can show due reminders and let the user add
--   each bill to their own calendar (.ics / Google Calendar). Financial data, so
--   access is OWNER + ADMIN only — the same model as `expenses`, NOT shared with
--   regular members.
-- ============================================================================

create table if not exists public.bills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                                    -- "BPI Credit Card"
  issuer      text,                                             -- "Credit Card" / "Bank Loan" / "E-Wallet"
  account_ref text,                                             -- masked "•••• 1234" or a note
  amount      numeric(12, 2) check (amount is null or amount >= 0),
  due_day     smallint not null check (due_day between 1 and 31),
  theme       text not null default 'slate',                    -- card colour key (UI only)
  note        text,
  active      boolean not null default true,                    -- pause a bill without deleting it
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id)
);

comment on table public.bills is
  'Recurring monthly billing reminders (owner/admin only). UI/reminder data — never a stock movement.';

-- Sorted display by due day, then name.
create index if not exists bills_due_day_idx on public.bills (due_day, name);

-- ----------------------------------------------------------------------------
-- Access: OWNER + ADMIN only (same as expenses). is_admin() is defined here too
-- (SECURITY DEFINER, STABLE) so this migration runs standalone even if the
-- expenses migration hasn't been applied yet.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

alter table public.bills enable row level security;

grant select, insert, update, delete on public.bills to authenticated;

drop policy if exists "bills: admins can read" on public.bills;
create policy "bills: admins can read"
  on public.bills for select
  to authenticated
  using (public.is_admin());

drop policy if exists "bills: admins can create" on public.bills;
create policy "bills: admins can create"
  on public.bills for insert
  to authenticated
  with check (public.is_admin() and created_by = auth.uid());   -- role-gated + can't forge creator

drop policy if exists "bills: admins can edit" on public.bills;
create policy "bills: admins can edit"
  on public.bills for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "bills: admins can delete" on public.bills;
create policy "bills: admins can delete"
  on public.bills for delete
  to authenticated
  using (public.is_admin());
