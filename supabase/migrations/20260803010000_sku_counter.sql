-- ============================================================================
-- Inventory Tracker — global SKU sequence counter
-- Migration 0013 (SKU counter)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run.
--
-- Backs the auto-generated structured SKU (CAT-NAME-ATTR-###) on the Add
-- Product form. A single global counter, incremented ATOMICALLY, so two team
-- members saving at the same moment never get the same sequence number.
-- The SKU is stored in the existing products.sku column; the barcode (EAN-13)
-- remains the product's identity — this only fills in the human-readable SKU.
-- ============================================================================

create table if not exists public.sku_counter (
  counter_key   text primary key,
  current_value integer not null default 0
);

insert into public.sku_counter (counter_key, current_value)
values ('global', 0)
on conflict (counter_key) do nothing;

-- Lock the table down: no client reads/writes. Only the SECURITY DEFINER
-- function below touches it, which keeps the count tamper-proof.
alter table public.sku_counter enable row level security;
revoke all on public.sku_counter from anon, authenticated;

-- Atomic increment-and-return. `UPDATE ... RETURNING` is a single statement, so
-- concurrent callers are serialized by row lock and each gets a distinct value.
create or replace function public.next_sku_seq()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  update public.sku_counter
     set current_value = current_value + 1
   where counter_key = 'global'
   returning current_value into v;
  return v;
end $$;

grant execute on function public.next_sku_seq() to authenticated;
