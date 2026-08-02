-- ============================================================================
-- Inventory Tracker — attach a receipt photo to an expense
-- Migration 0011 (expense receipts)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run.
--
-- Adds an optional receipt photo per expense. Unlike product photos (a PUBLIC
-- bucket), receipts are tax documents, so they live in a PRIVATE bucket that
-- only owner/admin can read — access is via short-lived signed URLs, never a
-- public link. We store the storage PATH in expenses.receipt_path.
--
-- Self-contained: it (re)defines is_admin() so it runs whether or not the
-- admin-gated version of the 0010 expenses migration was applied.
-- ============================================================================

alter table public.expenses add column if not exists receipt_path text;

-- Owner/admin check (SECURITY DEFINER so a storage policy can read the caller's
-- role from profiles without tripping over that table's own RLS). Idempotent.
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

-- Private bucket (public = false): no public read, signed URLs only.
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

-- Storage policies — owner/admin only, reusing is_admin() from migration 0010.
drop policy if exists "receipts: admins read"   on storage.objects;
drop policy if exists "receipts: admins upload" on storage.objects;
drop policy if exists "receipts: admins remove" on storage.objects;

create policy "receipts: admins read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'expense-receipts' and public.is_admin());

create policy "receipts: admins upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'expense-receipts' and public.is_admin());

create policy "receipts: admins remove"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'expense-receipts' and public.is_admin());
