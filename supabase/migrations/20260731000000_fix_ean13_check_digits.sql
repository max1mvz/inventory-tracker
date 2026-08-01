-- ============================================================================
-- Inventory Tracker — correct demo barcodes to valid EAN-13
-- Migration 0009 (EAN-13 check digits)
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run.
--
-- The demo catalogs were seeded with made-up 13-digit numbers whose final digit
-- wasn't a real EAN-13 check digit — they look like barcodes but a scanner
-- rejects them. This recomputes the check digit for demo products only.
--
-- Stock history is preserved: the movements foreign key is first switched to
-- ON UPDATE CASCADE, so every movement follows its product to the corrected
-- barcode. No movement rows are deleted, and no quantity changes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EAN-13 check digit, in SQL. Positions alternate ×1 / ×3 from the left; the
--    check digit is whatever rounds the total up to a multiple of ten.
-- ----------------------------------------------------------------------------
create or replace function public.ean13_check_digit(p_body text)
returns int
language plpgsql
immutable
as $$
declare
  s int := 0;
  i int;
begin
  if p_body is null or p_body !~ '^\d{12}$' then
    return null;
  end if;
  for i in 1..12 loop
    s := s + substr(p_body, i, 1)::int * (case when i % 2 = 1 then 1 else 3 end);
  end loop;
  return (10 - (s % 10)) % 10;
end;
$$;

comment on function public.ean13_check_digit(text) is
  'EAN-13 check digit for a 12-digit body; null if the input is not 12 digits.';

-- ----------------------------------------------------------------------------
-- 2. Let a barcode correction carry through to its movements.
--    (Also makes editing a barcode in the app work for products that already
--    have stock history — the ledger rows follow rather than blocking it.)
-- ----------------------------------------------------------------------------
alter table public.movements drop constraint if exists movements_barcode_fkey;
alter table public.movements
  add constraint movements_barcode_fkey
  foreign key (barcode) references public.products(barcode)
  on update cascade;

-- ----------------------------------------------------------------------------
-- 3. Fix the demo products. Scoped to the seeded SKUs so real products you
--    added yourself are left completely alone.
-- ----------------------------------------------------------------------------
do $$
declare
  fixed int;
begin
  with candidates as (
    select
      p.barcode                                                as old_code,
      substr(p.barcode, 1, 12)
        || public.ean13_check_digit(substr(p.barcode, 1, 12))::text as new_code
    from public.products p
    where p.barcode ~ '^\d{13}$'
      and (
        p.sku ~ '^(BLD|FST|TLS|ELC|PLB|PNT|SFT|ADH|OFC|CLN)-'          -- 100-product seed
        or p.sku in ('CEM-40','RB-10','PLY-12','GLV-BLU-M','PEN-BLK',  -- original 10-product seed
                     'TAPE-50','CT-200','BAT-AA4','GOG-01','TAPE-24')
      )
      and substr(p.barcode, 13, 1)
          <> public.ean13_check_digit(substr(p.barcode, 1, 12))::text
  )
  update public.products p
  set barcode = c.new_code
  from candidates c
  where p.barcode = c.old_code
    -- never collide with a barcode that already exists
    and not exists (select 1 from public.products x where x.barcode = c.new_code);

  get diagnostics fixed = row_count;
  raise notice 'Corrected % demo barcode(s) to valid EAN-13.', fixed;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Verify: this should return no rows once the fix has run.
--    (Any rows returned are products whose barcode still wouldn't scan.)
-- ----------------------------------------------------------------------------
-- select barcode, sku, name from public.products
-- where barcode ~ '^\d{13}$'
--   and substr(barcode, 13, 1) <> public.ean13_check_digit(substr(barcode, 1, 12))::text;
