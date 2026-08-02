-- ============================================================================
-- Inventory Tracker — address fields on expenses
-- Migration 0012 (expense location)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run.
--
-- Adds optional supplier location fields to each expense: a free-text address
-- plus municipality and barangay (PH local address units). All nullable — they
-- inherit the expenses table's owner/admin RLS, so no new policies are needed.
-- ============================================================================

alter table public.expenses add column if not exists address      text;
alter table public.expenses add column if not exists municipality text;
alter table public.expenses add column if not exists barangay     text;
