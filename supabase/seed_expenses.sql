-- ============================================================================
-- Inventory Tracker — SAMPLE expense records (for demo / trying the feature)
--
-- HOW TO RUN: run the 0010_expenses migration FIRST, then paste this into the
-- Supabase SQL Editor and run. These are fake rows spread across two months so
-- the "this month" total and the history list both show data.
--
-- created_by is left null on purpose (rows inserted from the SQL editor aren't
-- tied to a user session). To remove all sample data later:
--     delete from public.expenses where created_by is null;
-- ============================================================================

insert into public.expenses
  (expense_date, vendor, tin, net_amount, vat_amount, total_amount, category, note)
values
  -- ---- current month ----
  ('2026-08-01', 'Meralco',                     '000-100-200-001', 5000.00,  600.00,  5600.00, 'Utilities',              'Electricity — August'),
  ('2026-08-02', 'Maynilad Water Services',     '000-100-200-002', 1200.00,  144.00,  1344.00, 'Utilities',              'Water — August'),
  ('2026-08-03', 'PLDT',                        '000-100-200-003', 2500.00,  300.00,  2800.00, 'Communication',          'Internet + landline'),
  ('2026-08-05', 'Petron Bagsakan',             '000-100-200-004', 3000.00,  360.00,  3360.00, 'Fuel',                   'Delivery van fuel'),
  ('2026-08-08', 'ACE Hardware Supply',         '000-100-200-005', 4000.00,  480.00,  4480.00, 'Supplies',               'Packaging + shelving'),
  ('2026-08-10', 'Lalamove PH',                 '000-100-200-006',  800.00,   96.00,   896.00, 'Transportation',         'Same-day delivery'),
  ('2026-08-01', 'J. Santos Realty',            null,             15000.00,     null, 15000.00, 'Rent',                   'Store rent — August'),

  -- ---- last month (history) ----
  ('2026-07-01', 'Meralco',                     '000-100-200-001', 4500.00,  540.00,  5040.00, 'Utilities',              'Electricity — July'),
  ('2026-07-04', 'Bureau of Internal Revenue',  null,               500.00,     null,   500.00, 'Taxes & Licenses',       'Annual registration fee'),
  ('2026-07-12', 'Reyes Accounting Services',   '000-100-200-007', 5000.00,  600.00,  5600.00, 'Professional Fees',      'Monthly bookkeeping'),
  ('2026-07-18', 'CoolAir Servicing',           '000-100-200-008', 2000.00,  240.00,  2240.00, 'Repairs & Maintenance',  'Aircon cleaning'),
  ('2026-07-25', 'National Book Store',         '000-100-200-009', 1000.00,  120.00,  1120.00, 'Supplies',               'Office supplies');
