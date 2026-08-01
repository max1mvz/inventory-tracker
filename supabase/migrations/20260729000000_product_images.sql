-- ============================================================================
-- Inventory Tracker — product photos
-- Migration 0007 (product images)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run.
--
-- `products.image_url` already exists (migration 0001) but was never surfaced.
-- This exposes it on `current_stock` and creates a public storage bucket for the
-- photos themselves. Images are stored as files (NOT base64 in the database) and
-- are downscaled on the device before upload, so rows stay small and lists fast.
-- ============================================================================

-- 1. Surface image_url on the view. `create or replace view` can only APPEND
--    columns, so it goes LAST (after category/cost/price from 0003 + 0004).
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
  p.price,
  p.image_url
from public.products p
left join public.movements m on m.barcode = p.barcode
group by p.barcode;

-- 2. Public bucket for the photos. Public read keeps <img> simple and lets the
--    service worker cache thumbnails; writes stay restricted to the team.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- 3. Storage policies (drop-then-create so this file is safe to re-run).
drop policy if exists "product images: public read"      on storage.objects;
drop policy if exists "product images: team can upload"  on storage.objects;
drop policy if exists "product images: team can replace" on storage.objects;
drop policy if exists "product images: team can remove"  on storage.objects;

create policy "product images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product images: team can upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "product images: team can replace"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

create policy "product images: team can remove"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
