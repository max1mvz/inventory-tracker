-- ============================================================================
-- Sample inventory — 100 demo products across 10 categories, plus movements.
-- Prices are in Philippine pesos (₱). cost = unit cost, price = retail.
-- Barcodes are real EAN-13s with correct check digits, so they scan.
-- Run AFTER migrations:
--   20260726000000_product_category.sql  (adds category)
--   20260727000000_product_pricing.sql   (adds cost + price)
-- Safe to run once; re-running backfills category/cost/price on existing rows.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste → Run.
-- You must have signed into the app at least once (so an auth user exists);
-- the seeded movements are attributed to the first user.
--
-- TO REMOVE: run the two DELETE lines at the very bottom.
-- ============================================================================

insert into public.products (barcode, name, sku, category, unit, reorder_point, cost, price) values
  ('4806500000016', 'Portland Cement 40kg', 'BLD-001', 'Building Materials', 'bag', 15, 260, 364),
  ('4806500000023', 'Rebar 10mm x 6m', 'BLD-002', 'Building Materials', 'pc', 30, 210, 294),
  ('4806500000030', 'Plywood 1/2" 4x8', 'BLD-003', 'Building Materials', 'sheet', 10, 720, 1008),
  ('4806500000047', 'Washed Sand', 'BLD-004', 'Building Materials', 'bag', 20, 90, 126),
  ('4806500000054', 'Gravel 3/4"', 'BLD-005', 'Building Materials', 'bag', 20, 110, 154),
  ('4806500000061', 'Hollow Blocks 4"', 'BLD-006', 'Building Materials', 'pc', 100, 18, 25),
  ('4806500000078', 'Lumber 2x2 x 8ft', 'BLD-007', 'Building Materials', 'pc', 40, 95, 133),
  ('4806500000085', 'Gypsum Board 9mm', 'BLD-008', 'Building Materials', 'sheet', 12, 380, 532),
  ('4806500000092', 'Corrugated Roofing Sheet', 'BLD-009', 'Building Materials', 'sheet', 15, 560, 784),
  ('4806500000108', 'Welded Wire Mesh', 'BLD-010', 'Building Materials', 'roll', 6, 1250, 1750),
  ('4806510000112', 'Common Nails 2"', 'FST-001', 'Fasteners & Hardware', 'kg', 10, 75, 105),
  ('4806510000129', 'Wood Screws 1.5"', 'FST-002', 'Fasteners & Hardware', 'box', 20, 145, 203),
  ('4806510000136', 'Machine Bolts M10', 'FST-003', 'Fasteners & Hardware', 'pc', 50, 22, 31),
  ('4806510000143', 'Hex Nuts M10', 'FST-004', 'Fasteners & Hardware', 'pc', 80, 6, 8),
  ('4806510000150', 'Flat Washers M10', 'FST-005', 'Fasteners & Hardware', 'pc', 100, 3, 4),
  ('4806510000167', 'Expansion Anchor Bolts', 'FST-006', 'Fasteners & Hardware', 'pc', 40, 35, 49),
  ('4806510000174', 'Door Hinges 3"', 'FST-007', 'Fasteners & Hardware', 'pair', 25, 65, 91),
  ('4806510000181', 'Door Knob Set', 'FST-008', 'Fasteners & Hardware', 'set', 12, 420, 588),
  ('4806510000198', 'Brass Padlock 40mm', 'FST-009', 'Fasteners & Hardware', 'pc', 15, 180, 252),
  ('4806510000204', 'Drawer Slides 18"', 'FST-010', 'Fasteners & Hardware', 'pair', 18, 240, 336),
  ('4806520000218', 'Claw Hammer 16oz', 'TLS-001', 'Tools', 'pc', 8, 320, 448),
  ('4806520000225', 'Screwdriver Set (6pc)', 'TLS-002', 'Tools', 'set', 10, 480, 672),
  ('4806520000232', 'Hand Saw 20"', 'TLS-003', 'Tools', 'pc', 8, 350, 490),
  ('4806520000249', 'Tape Measure 5m', 'TLS-004', 'Tools', 'pc', 20, 160, 224),
  ('4806520000256', 'Utility Knife', 'TLS-005', 'Tools', 'pc', 25, 85, 119),
  ('4806520000263', 'Cordless Drill 18V', 'TLS-006', 'Tools', 'pc', 5, 2650, 3710),
  ('4806520000270', 'Angle Grinder 4"', 'TLS-007', 'Tools', 'pc', 5, 1850, 2590),
  ('4806520000287', 'Combination Wrench Set', 'TLS-008', 'Tools', 'set', 6, 1250, 1750),
  ('4806520000294', 'Long Nose Pliers', 'TLS-009', 'Tools', 'pc', 12, 220, 308),
  ('4806520000300', 'Spirit Level 24"', 'TLS-010', 'Tools', 'pc', 10, 540, 756),
  ('4806530000314', 'THHN Wire 3.5mm', 'ELC-001', 'Electrical', 'roll', 10, 1750, 2450),
  ('4806530000321', 'Circuit Breaker 20A', 'ELC-002', 'Electrical', 'pc', 15, 210, 294),
  ('4806530000338', 'Duplex Wall Outlet', 'ELC-003', 'Electrical', 'pc', 30, 95, 133),
  ('4806530000345', 'Single Light Switch', 'ELC-004', 'Electrical', 'pc', 30, 78, 109),
  ('4806530000352', 'LED Bulb 9W', 'ELC-005', 'Electrical', 'pc', 40, 120, 168),
  ('4806530000369', 'Extension Cord 3m', 'ELC-006', 'Electrical', 'pc', 15, 260, 364),
  ('4806530000376', 'Insulating Tape', 'ELC-007', 'Electrical', 'roll', 30, 28, 39),
  ('4806530000383', 'PVC Junction Box', 'ELC-008', 'Electrical', 'pc', 40, 22, 31),
  ('4806530000390', 'PVC Conduit 1/2"', 'ELC-009', 'Electrical', 'pc', 25, 45, 63),
  ('4806530000406', 'Wire Connectors (pk)', 'ELC-010', 'Electrical', 'pack', 20, 65, 91),
  ('4806540000410', 'PVC Pipe 1/2" x 3m', 'PLB-001', 'Plumbing', 'pc', 25, 85, 119),
  ('4806540000427', 'PVC Elbow 1/2"', 'PLB-002', 'Plumbing', 'pc', 60, 12, 17),
  ('4806540000434', 'Kitchen Faucet', 'PLB-003', 'Plumbing', 'pc', 10, 650, 910),
  ('4806540000441', 'Brass Ball Valve 1/2"', 'PLB-004', 'Plumbing', 'pc', 20, 145, 203),
  ('4806540000458', 'Teflon Thread Tape', 'PLB-005', 'Plumbing', 'roll', 50, 15, 21),
  ('4806540000465', 'P-Trap 1-1/4"', 'PLB-006', 'Plumbing', 'pc', 18, 95, 133),
  ('4806540000472', 'Pipe Wrench 14"', 'PLB-007', 'Plumbing', 'pc', 8, 780, 1092),
  ('4806540000489', 'Shower Head', 'PLB-008', 'Plumbing', 'pc', 12, 350, 490),
  ('4806540000496', 'Flexible Hose 12"', 'PLB-009', 'Plumbing', 'pc', 20, 110, 154),
  ('4806540000502', 'Pipe Thread Sealant', 'PLB-010', 'Plumbing', 'tube', 15, 85, 119),
  ('4806550000516', 'Latex Paint White 1gal', 'PNT-001', 'Paint & Finishes', 'can', 12, 620, 868),
  ('4806550000523', 'Enamel Paint Black 1L', 'PNT-002', 'Paint & Finishes', 'can', 15, 240, 336),
  ('4806550000530', 'Masonry Primer 1gal', 'PNT-003', 'Paint & Finishes', 'can', 10, 580, 812),
  ('4806550000547', 'Paint Roller 9"', 'PNT-004', 'Paint & Finishes', 'pc', 20, 120, 168),
  ('4806550000554', 'Paint Brush 2"', 'PNT-005', 'Paint & Finishes', 'pc', 30, 65, 91),
  ('4806550000561', 'Paint Thinner 1L', 'PNT-006', 'Paint & Finishes', 'can', 18, 130, 182),
  ('4806550000578', 'Clear Varnish 1L', 'PNT-007', 'Paint & Finishes', 'can', 12, 280, 392),
  ('4806550000585', 'Spray Paint Gray', 'PNT-008', 'Paint & Finishes', 'can', 24, 175, 245),
  ('4806550000592', 'Sandpaper #120', 'PNT-009', 'Paint & Finishes', 'sheet', 60, 18, 25),
  ('4806550000608', 'Acrylic Putty 1kg', 'PNT-010', 'Paint & Finishes', 'tub', 15, 145, 203),
  ('4806560000612', 'Safety Goggles', 'SFT-001', 'Safety Gear', 'pc', 8, 95, 133),
  ('4806560000629', 'Hard Hat', 'SFT-002', 'Safety Gear', 'pc', 15, 180, 252),
  ('4806560000636', 'Leather Work Gloves', 'SFT-003', 'Safety Gear', 'pair', 25, 85, 119),
  ('4806560000643', 'Dust Mask (pk)', 'SFT-004', 'Safety Gear', 'pack', 20, 120, 168),
  ('4806560000650', 'Foam Ear Plugs (pk)', 'SFT-005', 'Safety Gear', 'pack', 20, 90, 126),
  ('4806560000667', 'Hi-Vis Safety Vest', 'SFT-006', 'Safety Gear', 'pc', 15, 150, 210),
  ('4806560000674', 'Steel Toe Boots', 'SFT-007', 'Safety Gear', 'pair', 8, 1450, 2030),
  ('4806560000681', 'Welding Face Shield', 'SFT-008', 'Safety Gear', 'pc', 6, 380, 532),
  ('4806560000698', 'First Aid Kit', 'SFT-009', 'Safety Gear', 'kit', 5, 650, 910),
  ('4806560000704', 'Knee Pads', 'SFT-010', 'Safety Gear', 'pair', 10, 240, 336),
  ('4806570000718', 'Packing Tape 50mm', 'ADH-001', 'Adhesives & Tapes', 'roll', 12, 45, 63),
  ('4806570000725', 'Masking Tape 24mm', 'ADH-002', 'Adhesives & Tapes', 'roll', 40, 35, 49),
  ('4806570000732', 'Duct Tape 48mm', 'ADH-003', 'Adhesives & Tapes', 'roll', 20, 95, 133),
  ('4806570000749', 'Super Glue 3g', 'ADH-004', 'Adhesives & Tapes', 'pc', 30, 35, 49),
  ('4806570000756', 'Wood Glue 250ml', 'ADH-005', 'Adhesives & Tapes', 'bottle', 18, 85, 119),
  ('4806570000763', 'Epoxy Adhesive', 'ADH-006', 'Adhesives & Tapes', 'set', 15, 120, 168),
  ('4806570000770', 'Silicone Sealant', 'ADH-007', 'Adhesives & Tapes', 'tube', 20, 165, 231),
  ('4806570000787', 'Contact Cement 250ml', 'ADH-008', 'Adhesives & Tapes', 'can', 12, 110, 154),
  ('4806570000794', 'Double-Sided Tape', 'ADH-009', 'Adhesives & Tapes', 'roll', 25, 55, 77),
  ('4806570000800', 'Foam Mounting Tape', 'ADH-010', 'Adhesives & Tapes', 'roll', 20, 78, 109),
  ('4806580000814', 'Ballpoint Pens (black)', 'OFC-001', 'Office & Packaging', 'pc', 50, 12, 17),
  ('4806580000821', 'Bond Paper A4', 'OFC-002', 'Office & Packaging', 'ream', 20, 230, 322),
  ('4806580000838', 'Desktop Stapler', 'OFC-003', 'Office & Packaging', 'pc', 10, 145, 203),
  ('4806580000845', 'Permanent Marker', 'OFC-004', 'Office & Packaging', 'pc', 30, 45, 63),
  ('4806580000852', 'Cardboard Box (M)', 'OFC-005', 'Office & Packaging', 'pc', 40, 28, 39),
  ('4806580000869', 'Bubble Wrap Roll', 'OFC-006', 'Office & Packaging', 'roll', 10, 320, 448),
  ('4806580000876', 'Cable Ties 200mm', 'OFC-007', 'Office & Packaging', 'pack', 15, 55, 77),
  ('4806580000883', 'Ziplock Bags (pk)', 'OFC-008', 'Office & Packaging', 'pack', 25, 65, 91),
  ('4806580000890', 'Sticky Notes 3x3', 'OFC-009', 'Office & Packaging', 'pad', 30, 40, 56),
  ('4806580000906', 'Clipboard A4', 'OFC-010', 'Office & Packaging', 'pc', 15, 75, 105),
  ('4806590000910', 'Dishwashing Liquid 1L', 'CLN-001', 'Cleaning Supplies', 'bottle', 20, 85, 119),
  ('4806590000927', 'Chlorine Bleach 1L', 'CLN-002', 'Cleaning Supplies', 'bottle', 18, 45, 63),
  ('4806590000934', 'Floor Mop', 'CLN-003', 'Cleaning Supplies', 'pc', 12, 180, 252),
  ('4806590000941', 'Soft Broom', 'CLN-004', 'Cleaning Supplies', 'pc', 12, 145, 203),
  ('4806590000958', 'Trash Bags XL (pk)', 'CLN-005', 'Cleaning Supplies', 'pack', 25, 95, 133),
  ('4806590000965', 'Scrub Sponge (pk)', 'CLN-006', 'Cleaning Supplies', 'pack', 30, 55, 77),
  ('4806590000972', 'Glass Cleaner 500ml', 'CLN-007', 'Cleaning Supplies', 'bottle', 15, 90, 126),
  ('4806590000989', 'Disinfectant 1L', 'CLN-008', 'Cleaning Supplies', 'bottle', 18, 135, 189),
  ('4806590000996', 'Rubber Gloves', 'CLN-009', 'Cleaning Supplies', 'pair', 20, 65, 91),
  ('4806590001009', 'Utility Bucket 10L', 'CLN-010', 'Cleaning Supplies', 'pc', 10, 120, 168)
on conflict (barcode) do update
  set category = excluded.category,   -- backfill on rows that already existed
      cost     = excluded.cost,
      price    = excluded.price;

-- Movements: an opening "received" ~27 days ago for every product, plus a spread
-- of receipts and sales over the last week so the charts and category breakdown
-- have something to show. Tagged note='demo100' for easy cleanup.
do $$
declare uid uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise notice 'No auth user yet — sign into the app once, then re-run this.';
    return;
  end if;
  if exists (select 1 from public.movements where note = 'demo100') then
    raise notice 'demo100 movements already seeded — skipping.';
    return;
  end if;

  insert into public.movements (barcode, delta, reason, note, user_id, created_at)
  select
    p.barcode,
    case
      when g = 0 then 40 + (abs(hashtext(p.barcode)) % 120)                  -- opening stock
      when (abs(hashtext(p.barcode || g::text)) % 3) = 0
        then -(1 + (abs(hashtext(p.barcode || g::text || 'x')) % 8))         -- a sale
      else 2 + (abs(hashtext(p.barcode || g::text)) % 15)                    -- a delivery
    end,
    case
      when g = 0 then 'received'
      when (abs(hashtext(p.barcode || g::text)) % 3) = 0 then 'sold'
      else 'received'
    end::public.movement_reason,
    'demo100',
    uid,
    case
      when g = 0 then now() - interval '27 days'
      else now()
           - ((abs(hashtext(p.barcode || g::text)) % 7) || ' days')::interval
           - ((abs(hashtext(p.barcode || g::text || 'h')) % 12) || ' hours')::interval
    end
  from public.products p
  cross join generate_series(0, 5) g
  where p.sku ~ '^(BLD|FST|TLS|ELC|PLB|PNT|SFT|ADH|OFC|CLN)-';

  raise notice '100-product demo data seeded.';
end $$;

-- ============================================================================
-- CLEANUP (run these two lines to remove this demo data):
-- delete from public.movements where note = 'demo100';
-- delete from public.products  where sku ~ '^(BLD|FST|TLS|ELC|PLB|PNT|SFT|ADH|OFC|CLN)-';
-- ============================================================================
