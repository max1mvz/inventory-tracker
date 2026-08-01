-- ============================================================================
-- Sample inventory — demo data to play with. Safe to run once.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste → Run.
-- You must have signed into the app at least once (so an auth user exists);
-- the movements get attributed to your account.
--
-- TO REMOVE when you go live: run the two DELETE lines at the very bottom.
-- ============================================================================

-- 10 sample products. `on conflict do nothing` protects any real products you
-- may already have with the same barcode.
insert into public.products (barcode, name, sku, unit, reorder_point) values
  ('4806509148921', 'Cement 40kg',            'CEM-40',    'bag',   15),
  ('4801234567890', 'Rebar 10mm x 6m',        'RB-10',     'pc',    30),
  ('4809876543210', 'Plywood 1/2" 4x8',       'PLY-12',    'sheet', 10),
  ('5059059136005', 'Blue Nitrile Gloves (M)','GLV-BLU-M', 'box',   20),
  ('4006381333931', 'Ballpoint Pens (black)', 'PEN-BLK',   'pc',    50),
  ('8710398513029', 'Packing Tape 50mm',      'TAPE-50',   'roll',  12),
  ('4901234567894', 'Cable Ties 200mm',       'CT-200',    'pack',  15),
  ('0012345678905', 'AA Batteries (4pk)',     'BAT-AA4',   'pack',  25),
  ('7350053850019', 'Safety Goggles',         'GOG-01',    'pc',     8),
  ('4711234567890', 'Masking Tape 24mm',      'TAPE-24',   'roll',  40)
on conflict (barcode) do nothing;

-- Movements spread across the last ~30 days (with several in the last 7 so the
-- charts have something to draw), attributed to the first signed-in user.
do $$
declare uid uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise notice 'No auth user yet — sign into the app once, then re-run this.';
    return;
  end if;
  if exists (select 1 from public.movements where note = 'demo') then
    raise notice 'Demo movements already seeded — skipping.';
    return;
  end if;

  insert into public.movements (barcode, delta, reason, note, user_id, created_at)
  select
    p.barcode,
    case
      when g = 0 then 40 + (abs(hashtext(p.barcode)) % 60)                    -- opening stock
      when (abs(hashtext(p.barcode || g::text)) % 4) = 0
        then -(1 + (abs(hashtext(p.barcode || g::text || 'x')) % 6))          -- a sale
      else 2 + (abs(hashtext(p.barcode || g::text)) % 12)                     -- a delivery
    end,
    case
      when g = 0 then 'received'
      when (abs(hashtext(p.barcode || g::text)) % 4) = 0 then 'sold'
      else 'received'
    end::public.movement_reason,
    'demo',
    uid,
    case
      when g = 0 then now() - interval '27 days'
      else now()
           - ((abs(hashtext(p.barcode || g::text)) % 7) || ' days')::interval
           - ((abs(hashtext(p.barcode || g::text || 'h')) % 10) || ' hours')::interval
    end
  from public.products p
  cross join generate_series(0, 6) g
  where p.sku in ('CEM-40','RB-10','PLY-12','GLV-BLU-M','PEN-BLK',
                  'TAPE-50','CT-200','BAT-AA4','GOG-01','TAPE-24');

  raise notice 'Demo data seeded.';
end $$;

-- ============================================================================
-- CLEANUP (run these two lines to remove all demo data):
-- delete from public.movements where note = 'demo';
-- delete from public.products where sku in ('CEM-40','RB-10','PLY-12','GLV-BLU-M','PEN-BLK','TAPE-50','CT-200','BAT-AA4','GOG-01','TAPE-24');
-- ============================================================================
