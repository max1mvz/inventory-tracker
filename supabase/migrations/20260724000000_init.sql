-- ============================================================================
-- Inventory Tracker — initial schema, Row-Level Security, and auth wiring
-- Migration 0001 (init)
--
-- HOW TO RUN
--   Option A (dashboard): paste this whole file into the Supabase SQL Editor
--                         and run it.
--   Option B (CLI):       `supabase db push`  (file lives in supabase/migrations)
--
-- CORE PRINCIPLE ENFORCED HERE
--   Stock is never overwritten. Every change is an append-only row in
--   `movements`. `current_stock` is a computed view. This migration makes that
--   immutability a database guarantee, not just an app convention: there is NO
--   update or delete policy on `movements`, so once a row lands, it is permanent.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. products — the catalog. Editable metadata; NEVER holds a quantity.
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  barcode        text primary key,                       -- text, never numeric (keeps UPC leading zeros)
  name           text not null check (btrim(name) <> ''),
  sku            text,
  unit           text default 'pcs',
  reorder_point  integer not null default 0 check (reorder_point >= 0),
  image_url      text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users(id)
);

comment on table public.products is
  'Product catalog keyed by barcode. Holds descriptive/reorder metadata only — never a stock quantity.';


-- ----------------------------------------------------------------------------
-- 2. movements — the append-only ledger. One row per stock change.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'movement_reason') then
    create type public.movement_reason as enum (
      'received', 'sold', 'damaged', 'returned', 'count_adjustment', 'transfer'
    );
  end if;
end $$;

create table if not exists public.movements (
  id          bigserial primary key,
  barcode     text not null references public.products(barcode),
  delta       integer not null,                           -- signed: +received, -sold, etc.
  reason      public.movement_reason not null,
  note        text,
  user_id     uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now()
);

comment on table public.movements is
  'Append-only stock ledger. No UPDATE/DELETE is permitted (enforced by RLS) — this is the audit trail.';

-- Supports "latest movements for a barcode" and per-product history views.
create index if not exists movements_barcode_created_idx
  on public.movements (barcode, created_at desc);


-- ----------------------------------------------------------------------------
-- 3. current_stock — computed live stock levels + low-stock flag.
--    security_invoker = true so the view respects the querying user's RLS
--    (Supabase best practice; prevents a view from bypassing row security).
-- ----------------------------------------------------------------------------
create or replace view public.current_stock
with (security_invoker = true) as
select
  p.barcode,
  p.name,
  p.sku,
  p.unit,
  p.reorder_point,
  coalesce(sum(m.delta), 0)                        as qty,
  coalesce(sum(m.delta), 0) <= p.reorder_point     as needs_reorder,
  max(m.created_at)                                as last_movement
from public.products p
left join public.movements m on m.barcode = p.barcode
group by p.barcode;


-- ============================================================================
-- 4. ROW-LEVEL SECURITY
--
-- Model: this is a small, trusted, invite-only team. Any *authenticated* user
-- is a team member and shares one catalog. Access is therefore scoped to the
-- `authenticated` role. The `anon` role gets NO policies, so signed-out
-- requests see nothing.
--
-- >>> IMPORTANT AUTH-CONFIG STEP (do this in the dashboard, it is NOT SQL):
--     Authentication > Providers > Email: turn OFF "Allow new users to sign up"
--     and add team members via "Invite user". RLS granting access to
--     `authenticated` is only as safe as who is allowed to become authenticated.
--     If you want membership enforced in SQL instead, see the note at the very
--     bottom of this file.
-- ============================================================================

alter table public.products  enable row level security;
alter table public.movements enable row level security;

-- Explicit grants, scoped to authenticated only. Note the deliberate omissions:
-- no DELETE on products, no UPDATE/DELETE on movements. (RLS is the real gate,
-- but this keeps privileges honest too.)
grant select, insert, update on public.products  to authenticated;
grant select, insert          on public.movements to authenticated;
grant usage, select on sequence public.movements_id_seq to authenticated;
grant select on public.current_stock to authenticated;

-- --- products policies ------------------------------------------------------
create policy "products: team can read"
  on public.products for select
  to authenticated
  using (true);

create policy "products: team can create"
  on public.products for insert
  to authenticated
  with check (created_by = auth.uid());     -- can't forge someone else as creator

create policy "products: team can edit metadata"
  on public.products for update
  to authenticated
  using (true)
  with check (true);
-- (no delete policy: products with history cannot be deleted — protects the ledger)

-- --- movements policies -----------------------------------------------------
create policy "movements: team can read"
  on public.movements for select
  to authenticated
  using (true);

create policy "movements: team can append"
  on public.movements for insert
  to authenticated
  with check (user_id = auth.uid());        -- the user_id column is guaranteed truthful
-- (NO update policy, NO delete policy: movements are permanent. This is the
--  database-level expression of "never overwrite a quantity".)


-- ============================================================================
-- 5. REALTIME — every device reflects a scan within a second (brief step 6).
--    RLS is respected on realtime too, so this leaks nothing.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'movements'
  ) then
    alter publication supabase_realtime add table public.movements;
  end if;
end $$;


-- ============================================================================
-- OPTIONAL UPGRADE — enforce team membership in SQL instead of via the
-- invite-only dashboard toggle. If you'd rather not rely on that toggle, add a
-- members table and swap the `using (true)` / `auth.uid()` checks for a
-- membership test. Ask and I'll write it — left out for now to match the brief,
-- which specifies magic-link accounts but no explicit members table.
-- ============================================================================
