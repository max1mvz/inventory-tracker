# Changelog

The version shown in the app (account menu → *Version x.y.z*) matches the
`version` field in `package.json`. Bump it there when shipping a change, add an
entry here, then deploy with `npx vercel --prod`.

## 1.18.0 — 2026-08-04

### Added
- **Billing due reminders (Bills tab, owner/admin only).** Track recurring
  monthly bills — credit cards, loans, e-wallets, subscriptions — as
  credit-card-style cards (8 colour themes) showing issuer, a masked account
  ref, amount, and a due chip. Each bill has a **recurring due day of month**
  (29–31 clamps to a short month's last day).
  - **Calendar integration** — per card, **Download .ics** (Outlook / Apple
    Calendar) or **Add to Google Calendar**. Both create a monthly recurring
    all-day event with a one-day-before alert, so the user's own calendar app
    fires the reminder — no account linking or backend needed.
  - **Monthly due counter** — a banner totalling the bills due this month
    (count + amount) with an upcoming-vs-passed split.
  - **Requires a database migration** (`…_bills.sql`, 0014) that adds the
    `bills` table with owner/admin RLS. The tab degrades gracefully until it's
    run.

## 1.17.0 — 2026-08-03

### Added
- **Tap a label to view it at scannable size.** Sheet-preview labels are shrunk
  to fit the page mock and are too small to scan off the screen. Tapping the large
  preview, any sheet-preview label, or a batch-sheet slot (⤢) now opens that one
  label large enough to scan straight from the display. (Screen scanning is still
  less reliable than paper — scan the printed label for a definitive test.)

### Changed
- **Labels encode a selected product's exact saved barcode**, never a check-digit
  "corrected" variant. A corrected code could differ from the product's database
  key, so scanning the sticker returned "Product not found". A product whose saved
  barcode isn't a valid EAN-13 is now flagged by name with a one-click **Assign** fix.
- The sheet preview is labelled as a scaled layout mock, steering you to scan the
  printed sheet or the tap-to-zoom view rather than the tiny on-screen labels.
- Renamed the batch tab from "Batch sheet (21)" to "Batch sheet".
- Removed the "Show the price on each label" checkbox — the **Price line** field is
  now the control: fill it to print a price, leave it blank to omit it.

## 1.16.0 — 2026-08-03

### Added
- **Confirm before adding an unrecognized barcode.** Scanning a barcode that
  isn't in inventory now asks *"This barcode is not in the inventory list. Would
  you like to add it as a new product?"* — **Yes** opens the Add Product form with
  the barcode prefilled; **No** discards the scan and returns to scanning.
- **Batch 21-up label sheet.** A new **Batch sheet (21)** tab in the Barcode
  studio lays out a standard 3×7 A4 sticker sheet. Assign any product to any slot
  by dragging it from the product list, clicking an empty slot to pick, filling
  all remaining slots with one product, or auto-arranging a ticked
  multi-selection. Move labels between slots, clear a slot, or clear the sheet.
  Prints a mixed sheet with every slot fixed in place (empty slots print blank)
  so each label lands on the right sticker.

### Changed
- Removed the per-code **Generate new** button from the Barcode studio — a
  product's barcode is its identity, so ad-hoc generation there was misleading.

### Fixed
- **Deleted products no longer resurface when scanned.** A product deleted on
  another device could still resolve from this device's local cache. Scans now
  treat the server's "not found" as authoritative — evicting the stale cache row
  and prompting to add the item as new — unless an offline-created record is still
  queued to sync.
- **Unknown barcodes no longer read as phantom empty products.** Fixed an
  offline-cache wrapper that returned a truthy placeholder on a cache miss, which
  had masked the "not found" result.
- **Barcode digits now show on the sheet preview**, matching what prints on each
  label.

## 1.15.1 — 2026-08-03

### Changed
- The auto-generated SKU now appears on the Add Product form **only after both
  Name and Category are filled in** (the SKU section is hidden until then).

## 1.15.0 — 2026-08-03

### Added
- **Auto-generated structured SKU on the Add Product form.** SKUs now follow
  `CATEGORY-NAME-ATTRIBUTE-SEQUENCE` (e.g. `ELE-CAB-BLACK-001`), built from the
  category code, a 3-letter code from the product name, a new optional
  **Attribute** field (colour / colour+size, `STD` when blank), and a global
  sequence number. The sequence uses an atomic Postgres counter, so two people
  saving at once never collide. A live SKU preview shows on the form; the
  barcode (EAN-13) stays the product's identity.
  - **Requires a database migration** (`…_sku_counter.sql`) that adds the
    `sku_counter` table and the `next_sku_seq()` function.

## 1.14.0 — 2026-08-03

### Added
- **Supplier location on expenses.** Address, Municipality / City, and Barangay
  fields on the expense form, shown on each ledger row when present.
  - **Requires a database migration** (`…_expense_location.sql`) that adds the
    `address`, `municipality`, and `barangay` columns.

## 1.13.0 — 2026-08-02

### Added
- **Attach a receipt photo to an expense.** "Add receipt photo" on the expense
  form takes or picks a photo (compressed on-device), previews it, and saves it
  with the record. Receipts live in a **private, owner/admin-only** storage
  bucket (not public like product photos) and are viewed later via a short-lived
  signed link ("View receipt" on each row). No AI — you fill the fields yourself.
  - **Requires a database migration** (`…_expense_receipts.sql`) that adds
    `receipt_path` and the private `expense-receipts` bucket.

## 1.12.2 — 2026-08-02

### Fixed
- **Expense "Print report" still printed blank.** Reworked it to build a clean,
  self-contained report document (a proper table grouped by month, with totals)
  and print that in a hidden iframe — instead of trying to print the app window,
  whose height:100% / flex / sticky layout the browser's print engine collapses
  to a blank page. The printout no longer depends on the app's CSS at all.

## 1.12.1 — 2026-08-02

### Fixed
- Attempted print fix by resetting root height / flattening layout (superseded by
  the iframe approach in 1.12.2).

## 1.12.0 — 2026-08-02

### Changed
- **Expenses tab is now VAT-first and report-ready:**
  - A large **Total VAT collected** headline banner at the top.
  - VAT is the highlighted figure on every row (total shown as a muted line).
  - Expenses are grouped by **month/year** with per-month VAT + total subtotals;
    each month collapses/expands with a click.
  - **TIN** is strict numeric with automatic dashes (XXX-XXX-XXX-XXX) and a
    "numbers only" notice.
  - A **Print report** button produces a clean, chrome-free printable summary
    (all months included, even collapsed ones).

## 1.11.0 — 2026-08-02

### Added
- **Expenses tab (owner/admin only).** A lightweight expense / VAT ledger for
  tax bookkeeping — record date, vendor, TIN, net/VAT/total, and category, with
  a this-month total + by-category summary and a searchable list. Separate from
  inventory (an expense is never a stock movement). Manual entry for now; photo
  auto-capture is a future phase.
  - **Requires a database migration** (`supabase/migrations/…_expenses.sql`) and
    optional sample data (`supabase/seed_expenses.sql`) — run them in the
    Supabase SQL editor.

### Changed
- **Mobile navigation decluttered.** Overview and Activity are now desktop-only
  (they're analysis/review views); mobile shows Scan · Stock · Barcodes ·
  Expenses. Low-stock is still surfaced on mobile via the Stock list.

## 1.10.0 — 2026-08-02

### Changed
- **Sign-in screen redesign.** Added the app's cube logo, centered the brand
  lockup, gave the card real elevation and a tighter width, and a subtle
  on-brand background glow — a more polished first impression. Works in light
  and dark.
- **Dashboard KPIs** now sit in a balanced 3×2 grid on desktop instead of five
  across with a lonely sixth tile.

No functional changes.

## 1.9.0 — 2026-08-02

### Changed
- **Accessibility & design polish (no functional changes).** Every interactive
  element now shows a visible keyboard focus ring (buttons, sidebar, tab bar,
  account menu, and text fields), so the app is fully navigable by keyboard and
  screen reader. The app also respects the OS "reduce motion" setting globally.
- Introduced a shared radius / spacing / elevation token scale (matched to the
  existing look, so nothing shifts) to keep the UI consistent going forward, and
  switched data tables to tabular figures so quantities and prices align in
  columns.

## 1.8.0 — 2026-08-02

### Added
- **Auto-generated barcodes when adding a product manually.** The desktop
  "+ Add product" form now pre-fills the barcode field with a valid internal
  EAN-13 (200 prefix — the in-store / restricted-circulation range, so it never
  collides with a real retail barcode), checked for uniqueness against the
  catalog. A **Generate** button makes a fresh one on demand, and the field
  stays fully editable — type or scan the product's real barcode over it if it
  already has one. The scan flow is unchanged.

## 1.7.0 — 2026-07-26

### Added
- **Bulk Excel/CSV import.** Upload a spreadsheet of products from the Stock tab
  to create and update them in one go. Column headers are matched flexibly
  (e.g. "QTY", "Unit Cost (₱)"), a preview shows exactly what will change
  (new / update / stock Δ / skipped) before anything is written, and a
  Quantity column sets each product's stock by appending a count movement — so
  the append-only ledger is preserved. Includes a downloadable template.
- **Stock export.** Download the current inventory as a formatted **Excel**
  workbook (with totals) or a print-ready **PDF** report.
- The spreadsheet engine (SheetJS) is code-split and loaded only when you
  import or export, so it doesn't affect the app's normal load time.

## 1.6.1 — 2026-07-26

### Fixed
- **Dashboard panels went blank** (Top 10 moving, Top Selling Products, By
  reason, Recent activity, Movements today). 1.6.0 queried a `movements.source`
  column that only exists after migration `0010`; because that migration hadn't
  been run, every movement query failed and the dashboard treated it as being
  offline. The queries no longer depend on it.

### Removed
- **Marketplace integration (Shopee / TikTok Shop) reverted** — on hold. The
  webhook function, migration `0010`, SKU linking and channel badges are gone.
  No database changes had been applied, so nothing needs undoing in Supabase.

## 1.6.0 — 2026-07-26 *(withdrawn — see 1.6.1)*
- Marketplace integration foundation. Reverted before it was ever enabled.

## 1.5.0 — 2026-07-26

### Added
- **Assign a generated barcode to a product.** The studio now shows whether a
  code actually resolves to a product ("Scans as …" / "Not assigned to any
  product"), and can point the chosen product at a newly generated code in one
  click. Previously a generated label printed fine but scanned to nothing,
  because the code was never linked to anything.

## 1.4.0 — 2026-07-26

### Added
- **Sheet preview.** The barcode preview now shows a scaled mock of the actual
  page — paper proportions, margins, gaps, label size and count all derived from
  the same geometry the printer uses, so changing paper, labels-per-row or the
  number of copies is reflected immediately (including the leftover space at the
  foot of the page).

## 1.3.0 — 2026-07-26

### Added
- **Fill a whole page with labels.** The barcode studio now calculates how many
  labels fit on A4 or Letter and fills one or more pages in a click. It also
  reports the printed barcode's magnification and warns below 80%, where
  scanners become unreliable — so a denser sheet never silently stops working.

## 1.2.1 — 2026-07-26

### Fixed
- **Demo barcodes are now valid EAN-13.** The seeded catalogs used made-up
  13-digit numbers whose final digit wasn't a real check digit, so they wouldn't
  scan. Migration `0009` recomputes them in place; stock history is preserved by
  switching the movements foreign key to `ON UPDATE CASCADE`.

### Changed
- Editing a product's barcode now works even when it has stock history — the
  movements follow it instead of blocking the change (after migration `0009`).

## 1.2.0 — 2026-07-26

### Added
- **Top 10 moving / Top 10 not moving** on the dashboard, over the last 30 days.
  Idle stock is ranked by the money tied up in it, and counts the whole catalog
  (not just products that moved), so dead stock actually surfaces.
- **Barcode studio** — a new tab that generates scannable EAN-13 barcodes from a
  product or any number, computes/corrects the check digit, previews the result,
  and prints a sheet of labels (1–200 copies, 2–5 per row, optional price line
  and cut guides). EAN-13 is encoded from the spec, so no new dependency.

## 1.1.2 — 2026-07-26

### Fixed
- Activity header sat flush against the first row. The feed now has proper
  vertical rhythm, with a divider separating the filters from the timeline.

## 1.1.1 — 2026-07-26

### Fixed
- Activity filters (All / Stock / Catalog) wrapped onto two rows — the shared
  segmented control was a fixed two-column grid; it now sizes to its contents.

## 1.1.0 — 2026-07-26

### Added
- **Named audit trail.** Every stock movement and catalog change now shows *who*
  did it, by name, instead of "You / Teammate".
- **Catalog change log.** Product creates, edits (field-by-field, old → new),
  and deletes are recorded by a database trigger — so the record is complete
  regardless of where the change came from. Requires migration `0008`.
- **Activity tab** became a full audit trail with All / Stock / Catalog filters.

## 1.0.0 — 2026-07-26

First versioned release. Everything below was already built; this is the point
the app started tracking its own version.

### Added
- **Product photos.** Take or pick a photo when creating/editing a product.
  Images are downscaled on the device (≤900px, WebP) before upload, stored in
  Supabase Storage, and shown as lazy-loaded thumbnails in the stock list and
  table. Requires migration `0007`.
- **Update badge.** A new build now announces itself with an "Update available"
  prompt instead of swapping in silently; the app checks on launch, hourly, and
  whenever it returns to the foreground.
- **Version display** in the account menu.
- **App shortcuts** — long-press the installed icon to jump to Scan or Stock.

### Changed
- Service worker returned to a caching install (`prompt` mode) after the
  temporary self-destroying build; product images are cached for offline use.

### Earlier (unversioned)
- Barcode scanning with a single-scan cooldown and success beep.
- Append-only movement ledger with computed stock and realtime sync.
- Offline queue (IndexedDB outbox) with automatic flush on reconnect.
- Dashboard: inventory value in ₱, category and reason breakdowns, reorder list.
- Product create/edit/delete, admin user management, light + dark themes.
