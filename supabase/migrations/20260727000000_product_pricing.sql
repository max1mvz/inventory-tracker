-- ============================================================================
-- Inventory Tracker — add product pricing (Philippine pesos)
-- Migration 0004 (pricing)
--
-- HOW TO RUN
--   Option A (dashboard): paste this whole file into the Supabase SQL Editor
--                         and run it.  (Run AFTER migration 0003_category.)
--   Option B (CLI):       `supabase db push`
--
-- Adds `cost` (what you pay per unit) and `price` (retail per unit), both in ₱,
-- and surfaces them on `current_stock` so the app can compute inventory value.
-- Non-breaking: existing products default to 0 until priced.
-- ============================================================================

alter table public.products
  add column if not exists cost  numeric(12, 2) not null default 0 check (cost  >= 0),
  add column if not exists price numeric(12, 2) not null default 0 check (price >= 0);

comment on column public.products.cost is
  'Unit cost in PHP (what you pay). Basis for inventory value on hand.';
comment on column public.products.price is
  'Unit retail price in PHP (what you sell for).';

-- Recreate the view to include cost + price. `create or replace view` can only
-- APPEND columns, so these go LAST (after category from migration 0003). The app
-- selects by column name, so position is irrelevant.
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
  max(m.created_at)                                as last_movement,
  p.category,
  p.cost,
  p.price
from public.products p
left join public.movements m on m.barcode = p.barcode
group by p.barcode;
