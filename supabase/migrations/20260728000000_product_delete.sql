-- ============================================================================
-- Inventory Tracker — allow deleting products (with no stock history)
-- Migration 0005 (product delete)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run.
--
-- Adds a DELETE privilege + RLS policy so the team can remove catalog entries.
-- The append-only ledger stays protected WITHOUT any special-casing: movements
-- reference products.barcode via a foreign key, so a product that has ANY
-- movement simply cannot be deleted (the FK blocks it). Only products with no
-- stock history can be removed — exactly what we want (e.g. a mis-scanned item).
-- ============================================================================

grant delete on public.products to authenticated;

create policy "products: team can delete"
  on public.products for delete
  to authenticated
  using (true);
