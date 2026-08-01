import { supabase } from '../supabaseClient'
import { emitProductsChanged } from '../data/inventory'

// Bulk import / export for the product catalog. The spreadsheet library
// (SheetJS) is loaded on demand so it never weighs down the initial app.
// Imports never overwrite a quantity directly — stock is set by appending a
// movement (a count adjustment) exactly like a manual recount, so the
// append-only ledger and audit trail stay intact.

const xlsx = () => import('xlsx')

// --- header matching -------------------------------------------------------
// A canonical field ← the header spellings we'll accept for it. Normalised
// (lowercased, punctuation/units stripped) so "Unit Cost (₱)" == "unit cost".
const FIELD_ALIASES = {
  barcode: ['barcode', 'bar code', 'ean', 'ean13', 'upc', 'code', 'product code', 'item code'],
  name: ['name', 'product', 'product name', 'item', 'item name', 'description', 'title'],
  sku: ['sku', 'stock code', 'article', 'article code', 'ref'],
  category: ['category', 'type', 'group', 'department'],
  unit: ['unit', 'uom', 'units', 'unit of measure'],
  cost: ['cost', 'unit cost', 'cost price', 'buy price', 'buying price', 'purchase price', 'capital'],
  price: ['price', 'retail', 'retail price', 'sell price', 'selling price', 'srp', 'unit price'],
  reorderPoint: ['reorder point', 'reorder', 'reorder level', 'reorder qty', 'min', 'minimum', 'min stock', 'low stock', 'par'],
  quantity: ['quantity', 'qty', 'stock', 'stocks', 'stock on hand', 'on hand', 'onhand', 'count', 'counted', 'current stock', 'inventory', 'balance', 'available'],
}

const normHeader = (h) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[()₱$*:#.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const HEADER_TO_FIELD = (() => {
  const m = new Map()
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) m.set(a, field)
  }
  return m
})()

function num(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  const s = String(v).replace(/[^0-9.\-]/g, '')
  if (s === '' || s === '-' || s === '.') return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * Read a spreadsheet File into normalized rows. Returns:
 *   { rows: [{barcode,name,sku,category,unit,cost,price,reorderPoint,quantity, _row}],
 *     fields: Set of canonical columns detected, headers: original header labels }
 */
export async function parseSpreadsheet(file) {
  const XLSX = await xlsx()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('That file has no sheets.')

  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: null })
  if (grid.length < 2) throw new Error('The sheet needs a header row and at least one product row.')

  const headers = grid[0].map((h) => str(h))
  const colField = headers.map((h) => HEADER_TO_FIELD.get(normHeader(h)) || null)
  const fields = new Set(colField.filter(Boolean))

  if (!fields.has('barcode')) {
    throw new Error('No "Barcode" column found. The file needs at least Barcode and Name columns.')
  }

  const rows = []
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r]
    if (!raw || raw.every((c) => c === null || c === '')) continue
    const rec = { _row: r + 1 } // 1-based, matching the spreadsheet
    colField.forEach((field, c) => {
      if (field) rec[field] = raw[c]
    })
    rows.push(rec)
  }
  return { rows, fields, headers }
}

/**
 * Turn parsed rows into an executable plan against the current catalog.
 * Every row is classified new / update / skip, with a per-row reason when
 * skipped, so the preview can show exactly what will happen.
 */
export function buildImportPlan(parsed, currentStock) {
  const { rows, fields } = parsed
  const byBarcode = new Map(currentStock.map((p) => [String(p.barcode), p]))
  const setsQuantity = fields.has('quantity')

  const entries = []
  const toCreate = []
  const toUpdate = []
  const movements = []
  const seen = new Set()

  for (const row of rows) {
    const barcode = str(row.barcode)
    if (!barcode) {
      entries.push({ _row: row._row, status: 'skip', reason: 'no barcode' })
      continue
    }
    if (seen.has(barcode)) {
      entries.push({ _row: row._row, barcode, status: 'skip', reason: 'duplicate barcode in file' })
      continue
    }
    seen.add(barcode)

    const existing = byBarcode.get(barcode)
    const name = str(row.name) || existing?.name || ''
    if (!existing && !name) {
      entries.push({ _row: row._row, barcode, status: 'skip', reason: 'new product needs a name' })
      continue
    }

    // Numeric fields — a present-but-unparseable cell is an error, not a 0.
    const nums = {}
    for (const f of ['cost', 'price', 'reorderPoint', 'quantity']) {
      if (fields.has(f) && row[f] !== null && row[f] !== undefined && row[f] !== '') {
        const n = num(row[f])
        if (Number.isNaN(n)) {
          nums._bad = f
          break
        }
        nums[f] = n
      }
    }
    if (nums._bad) {
      entries.push({ _row: row._row, barcode, status: 'skip', reason: `"${nums._bad}" isn't a number` })
      continue
    }

    const targetQty = setsQuantity && nums.quantity !== undefined ? nums.quantity : null
    const currentQty = existing?.qty ?? 0
    const delta = targetQty === null ? 0 : Math.round(targetQty - currentQty)

    if (existing) {
      // Update only the columns the file actually carries, and only if changed —
      // so a partial file never wipes fields (e.g. photos) it doesn't mention.
      const patch = {}
      if (fields.has('name') && str(row.name) && str(row.name) !== existing.name) patch.name = str(row.name)
      if (fields.has('sku') && str(row.sku) !== (existing.sku || '')) patch.sku = str(row.sku) || null
      if (fields.has('category') && str(row.category) !== (existing.category || ''))
        patch.category = str(row.category) || null
      if (fields.has('unit') && str(row.unit) && str(row.unit) !== existing.unit) patch.unit = str(row.unit)
      if (nums.cost !== undefined && nums.cost !== existing.cost) patch.cost = nums.cost
      if (nums.price !== undefined && nums.price !== existing.price) patch.price = nums.price
      if (nums.reorderPoint !== undefined && nums.reorderPoint !== existing.reorder_point)
        patch.reorder_point = nums.reorderPoint

      const changedMeta = Object.keys(patch).length > 0
      if (changedMeta) toUpdate.push({ barcode, patch })
      entries.push({
        _row: row._row,
        barcode,
        name,
        status: 'update',
        changedMeta,
        delta,
        targetQty,
      })
    } else {
      toCreate.push({
        barcode,
        name,
        sku: fields.has('sku') ? str(row.sku) || null : null,
        category: fields.has('category') ? str(row.category) || null : null,
        unit: (fields.has('unit') && str(row.unit)) || 'pcs',
        reorder_point: nums.reorderPoint ?? 0,
        cost: nums.cost ?? 0,
        price: nums.price ?? 0,
      })
      entries.push({ _row: row._row, barcode, name, status: 'new', delta, targetQty })
    }

    if (delta !== 0) {
      movements.push({
        barcode,
        delta,
        reason: existing ? 'count_adjustment' : 'received',
        note: 'Excel import',
      })
    }
  }

  const skipped = entries.filter((e) => e.status === 'skip').length
  return {
    entries,
    toCreate,
    toUpdate,
    movements,
    setsQuantity,
    summary: {
      total: rows.length,
      newCount: toCreate.length,
      updateCount: entries.filter((e) => e.status === 'update').length,
      stockChanges: movements.length,
      skipped,
    },
  }
}

async function chunked(items, size, fn, onStep) {
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    await Promise.all(chunk.map(fn))
    onStep?.(Math.min(i + size, items.length))
  }
}

/** Execute a plan. `onProgress(done, total)` is called as it goes. */
export async function applyImport(plan, onProgress) {
  const total = plan.toCreate.length + plan.toUpdate.length + plan.movements.length
  let done = 0
  const bump = (n) => {
    done += n
    onProgress?.(done, total)
  }

  // 1) Create new products (products must exist before their movements).
  for (let i = 0; i < plan.toCreate.length; i += 500) {
    const batch = plan.toCreate.slice(i, i + 500)
    const { error } = await supabase.from('products').insert(batch)
    if (error) throw new Error(`Creating products failed: ${error.message}`)
    bump(batch.length)
  }

  // 2) Update changed metadata on existing products (parallel, in small waves).
  const createdSoFar = done
  await chunked(
    plan.toUpdate,
    20,
    async (u) => {
      const { error } = await supabase.from('products').update(u.patch).eq('barcode', u.barcode)
      if (error) throw new Error(`Updating ${u.barcode} failed: ${error.message}`)
    },
    (n) => onProgress?.(createdSoFar + n, total),
  )
  done = createdSoFar + plan.toUpdate.length

  // 3) Set stock levels by appending movements (never overwriting a quantity).
  for (let i = 0; i < plan.movements.length; i += 500) {
    const batch = plan.movements.slice(i, i + 500)
    const { error } = await supabase.from('movements').insert(batch)
    if (error) throw new Error(`Recording stock failed: ${error.message}`)
    bump(batch.length)
  }

  emitProductsChanged()
  return plan.summary
}

// --- export ----------------------------------------------------------------
const today = () => new Date().toISOString().slice(0, 10)

const EXPORT_COLUMNS = [
  ['Barcode', (r) => String(r.barcode)],
  ['Name', (r) => r.name || ''],
  ['Category', (r) => r.category || ''],
  ['SKU', (r) => r.sku || ''],
  ['Unit', (r) => r.unit || 'pcs'],
  ['Quantity', (r) => r.qty || 0],
  ['Reorder point', (r) => r.reorder_point || 0],
  ['Unit cost', (r) => r.cost || 0],
  ['Retail price', (r) => r.price || 0],
  ['Stock value', (r) => (r.qty || 0) * (r.cost || 0)],
  ['Retail value', (r) => (r.qty || 0) * (r.price || 0)],
  ['Status', (r) => (r.needs_reorder ? 'Low' : 'OK')],
  ['Last movement', (r) => (r.last_movement ? new Date(r.last_movement).toISOString().slice(0, 10) : '')],
]

/** Download the current stock as a formatted .xlsx workbook. */
export async function exportToExcel(stock) {
  const XLSX = await xlsx()
  const header = EXPORT_COLUMNS.map((c) => c[0])
  const body = stock.map((r) => EXPORT_COLUMNS.map((c) => c[1](r)))

  const totalsRow = header.map((_, i) => {
    if (i === 0) return 'TOTAL'
    if (header[i] === 'Quantity') return stock.reduce((s, r) => s + (r.qty || 0), 0)
    if (header[i] === 'Stock value') return stock.reduce((s, r) => s + (r.qty || 0) * (r.cost || 0), 0)
    if (header[i] === 'Retail value') return stock.reduce((s, r) => s + (r.qty || 0) * (r.price || 0), 0)
    return ''
  })

  const ws = XLSX.utils.aoa_to_sheet([header, ...body, [], totalsRow])
  ws['!cols'] = [
    { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 8 },
    { wch: 10 }, { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 8 }, { wch: 14 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
  XLSX.writeFile(wb, `Inventory_${today()}.xlsx`)
}

/** Download a ready-to-fill import template with example rows. */
export async function downloadImportTemplate() {
  const XLSX = await xlsx()
  const header = ['Barcode', 'Name', 'Category', 'SKU', 'Unit', 'Quantity', 'Reorder point', 'Unit cost', 'Retail price']
  const examples = [
    ['4801234567894', 'Example Product', 'Beverages', 'SKU-001', 'pcs', 24, 6, 18, 25],
    ['4809876543210', 'Another Item', 'Dry & Shelf-Stable Goods', 'SKU-002', 'box', 10, 3, 120, 160],
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, ...examples])
  ws['!cols'] = header.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  XLSX.writeFile(wb, 'Inventory_import_template.xlsx')
}
