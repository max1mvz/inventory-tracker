-- ============================================================================
-- Inventory Tracker — force-delete a product AND its stock history
-- Migration 0006 (delete_product_cascade)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run. (Run after 0005.)
--
-- Normal deletes stay protective: movements have NO delete policy, so the ledger
-- is immutable for everyone. This SECURITY DEFINER function is the ONE controlled
-- exception — it removes a product together with its movements, but ONLY when the
-- caller is an owner/admin. Use it for cleanup (e.g. removing test data). It is
-- irreversible: the audit trail for that product is gone.
-- ============================================================================

create or replace function public.delete_product_cascade(p_barcode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'Only owners or admins can delete a product with stock history';
  end if;

  delete from public.movements where barcode = p_barcode;
  delete from public.products  where barcode = p_barcode;
end;
$$;

revoke all     on function public.delete_product_cascade(text) from public, anon;
grant  execute on function public.delete_product_cascade(text) to authenticated;
