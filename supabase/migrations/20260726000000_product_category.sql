-- ============================================================================
-- Inventory Tracker — add product category
-- Migration 0003 (category)
--
-- HOW TO RUN
--   Option A (dashboard): paste this whole file into the Supabase SQL Editor
--                         and run it.
--   Option B (CLI):       `supabase db push`
--
-- Adds an optional `category` to the catalog and surfaces it on the
-- `current_stock` view so the app can group/report by category. Non-breaking:
-- existing products get NULL (shown as "Uncategorized" in the UI).
-- ============================================================================

alter table public.products
  add column if not exists category text;

comment on column public.products.category is
  'Optional grouping label (e.g. "Tools", "Electrical"). NULL = uncategorized.';

-- Speeds up category rollups as the catalog grows.
create index if not exists products_category_idx on public.products (category);

-- Recreate the view to include category. NOTE: `create or replace view` can only
-- APPEND columns (it rejects reordering/renaming existing ones), so `category`
-- must go LAST. The app selects by column name, so position is irrelevant.
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
  p.category
from public.products p
left join public.movements m on m.barcode = p.barcode
group by p.barcode;
