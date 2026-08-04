-- ============================================================================
-- Inventory Tracker — supplier management
-- Migration 0015 (suppliers)
--
-- HOW TO RUN
--   Option A (dashboard): paste this whole file into the Supabase SQL Editor
--                         and run it.
--   Option B (CLI):       `supabase db push`
--
-- WHAT THIS IS
--   A directory of suppliers with the product they supply, contact + commercial
--   terms (VAT, payment / shipping method, lead time), a lifecycle status and a
--   reliability rating. Owner/admin only — the same model as expenses & bills.
--   Each supplier gets an auto code SUP-001, SUP-002, … from a sequence.
-- ============================================================================

create sequence if not exists public.supplier_code_seq;

create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,                                       -- SUP-001 (set by trigger)
  name            text not null,
  contact_person  text,
  contact_number  text,
  email           text,
  address         text,
  website         text,
  product_name    text,
  size_specs      text,
  size_per_piece  text,
  qty_per_pack    numeric(12, 2) check (qty_per_pack is null or qty_per_pack >= 0),
  vat_inclusive   boolean,                                           -- Yes / No (null = unset)
  payment_method  text,
  shipping_method text,
  lead_time_days  integer check (lead_time_days is null or lead_time_days >= 0),
  remarks         text,
  active          boolean  not null default true,                    -- Active / Inactive (archive)
  rating          smallint not null default 0 check (rating between 0 and 5),  -- 0 = unrated
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references auth.users(id)
);

comment on table public.suppliers is
  'Supplier directory (owner/admin only): one supplied product per row, with terms, status and rating.';

create index if not exists suppliers_name_idx on public.suppliers (name);
create index if not exists suppliers_product_idx on public.suppliers (product_name);

-- Auto-assign SUP-00N on insert when no code was supplied (e.g. CSV import may set one).
create or replace function public.set_supplier_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'SUP-' || lpad(nextval('public.supplier_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists suppliers_set_code on public.suppliers;
create trigger suppliers_set_code
  before insert on public.suppliers
  for each row execute function public.set_supplier_code();

-- ----------------------------------------------------------------------------
-- Access: OWNER + ADMIN only (same as expenses / bills). is_admin() is defined
-- here too so this migration runs standalone.
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

alter table public.suppliers enable row level security;

grant select, insert, update, delete on public.suppliers to authenticated;
grant usage on sequence public.supplier_code_seq to authenticated;   -- trigger's nextval()

drop policy if exists "suppliers: admins can read" on public.suppliers;
create policy "suppliers: admins can read"
  on public.suppliers for select
  to authenticated
  using (public.is_admin());

drop policy if exists "suppliers: admins can create" on public.suppliers;
create policy "suppliers: admins can create"
  on public.suppliers for insert
  to authenticated
  with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "suppliers: admins can edit" on public.suppliers;
create policy "suppliers: admins can edit"
  on public.suppliers for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "suppliers: admins can delete" on public.suppliers;
create policy "suppliers: admins can delete"
  on public.suppliers for delete
  to authenticated
  using (public.is_admin());
