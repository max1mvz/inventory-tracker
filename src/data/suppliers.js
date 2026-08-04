import { supabase } from '../supabaseClient'

/**
 * Supplier directory — owner/admin only (RLS), online-only like expenses/bills.
 * One supplied product per supplier row. The `code` (SUP-001) is assigned by a
 * database trigger, so it comes back on insert without an extra round-trip.
 */

const numOrNull = (v) => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const intOrNull = (v) => {
  const n = numOrNull(v)
  return n == null ? null : Math.round(n)
}
const str = (v) => (v == null ? null : String(v).trim() || null)

// VAT is a Yes/No dropdown → boolean | null (unset).
const toVat = (v) => {
  if (v === true || v === false) return v
  const s = String(v ?? '').trim().toLowerCase()
  if (['yes', 'y', 'true', '1', 'vat', 'inclusive'].includes(s)) return true
  if (['no', 'n', 'false', '0', 'exclusive'].includes(s)) return false
  return null
}

export const PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'Cheque',
  'GCash',
  'Credit Card',
  'Credit Terms (30 days)',
  'Credit Terms (60 days)',
  'COD',
]

export const SHIPPING_METHODS = [
  'Pickup',
  'Supplier Delivery',
  'Courier',
  'Freight / Cargo',
  'Third-party Logistics',
]

function toPayload(f) {
  return {
    name: String(f.name || '').trim(),
    contact_person: str(f.contactPerson),
    contact_number: str(f.contactNumber),
    email: str(f.email),
    address: str(f.address),
    website: str(f.website),
    product_name: str(f.productName),
    size_specs: str(f.sizeSpecs),
    size_per_piece: str(f.sizePerPiece),
    qty_per_pack: numOrNull(f.qtyPerPack),
    vat_inclusive: toVat(f.vatInclusive),
    payment_method: str(f.paymentMethod),
    shipping_method: str(f.shippingMethod),
    lead_time_days: intOrNull(f.leadTimeDays),
    remarks: str(f.remarks),
    active: f.active !== false,
    rating: Math.max(0, Math.min(5, parseInt(f.rating, 10) || 0)),
  }
}

/** All suppliers, newest first. */
export async function listSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createSupplier(fields) {
  const { data, error } = await supabase.from('suppliers').insert(toPayload(fields)).select().single()
  if (error) throw error
  return data
}

export async function updateSupplier(id, fields) {
  const { data, error } = await supabase
    .from('suppliers')
    .update(toPayload(fields))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setSupplierActive(id, active) {
  const { error } = await supabase.from('suppliers').update({ active }).eq('id', id)
  if (error) throw error
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

// --- CSV / Excel ------------------------------------------------------------
// SheetJS is loaded on demand so it never weighs down the initial app.
const xlsx = () => import('xlsx')
const today = () => new Date().toISOString().slice(0, 10)

const EXPORT_COLUMNS = [
  ['Code', (r) => r.code || ''],
  ['Supplier Name', (r) => r.name || ''],
  ['Contact Person', (r) => r.contact_person || ''],
  ['Contact Number', (r) => r.contact_number || ''],
  ['Email', (r) => r.email || ''],
  ['Address', (r) => r.address || ''],
  ['Website', (r) => r.website || ''],
  ['Product Name', (r) => r.product_name || ''],
  ['Size / Specs', (r) => r.size_specs || ''],
  ['Size per Piece', (r) => r.size_per_piece || ''],
  ['Qty per Pack', (r) => (r.qty_per_pack ?? '') === '' ? '' : r.qty_per_pack],
  ['VAT Inclusive', (r) => (r.vat_inclusive == null ? '' : r.vat_inclusive ? 'Yes' : 'No')],
  ['Payment Method', (r) => r.payment_method || ''],
  ['Shipping Method', (r) => r.shipping_method || ''],
  ['Lead Time (days)', (r) => (r.lead_time_days ?? '') === '' ? '' : r.lead_time_days],
  ['Status', (r) => (r.active === false ? 'Inactive' : 'Active')],
  ['Rating', (r) => r.rating || 0],
  ['Remarks', (r) => r.remarks || ''],
]

/** Download suppliers as a formatted .xlsx workbook. */
export async function exportSuppliers(rows) {
  const XLSX = await xlsx()
  const header = EXPORT_COLUMNS.map((c) => c[0])
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => c[1](r)))
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  ws['!cols'] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
  XLSX.writeFile(wb, `Suppliers_${today()}.xlsx`)
}

/** A ready-to-fill import template with an example row. */
export async function downloadSupplierTemplate() {
  const XLSX = await xlsx()
  const header = EXPORT_COLUMNS.map((c) => c[0])
  const example = [
    '', // Code auto-assigns
    'ABC Trading',
    'Juan dela Cruz',
    '0917 123 4567',
    'sales@abctrading.ph',
    '123 Market St, Cebu City',
    'facebook.com/abctrading',
    'Paper Cups 14oz',
    '14oz, white',
    '1 pc',
    50,
    'Yes',
    'Bank Transfer',
    'Supplier Delivery',
    3,
    'Active',
    4,
    'Reliable, delivers on time',
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, example])
  ws['!cols'] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
  XLSX.writeFile(wb, 'Suppliers_import_template.xlsx')
}

// Header spelling → canonical form field, so imports tolerate label variations.
const HEADER_MAP = {
  code: 'code',
  'supplier name': 'name',
  name: 'name',
  supplier: 'name',
  'contact person': 'contactPerson',
  contact: 'contactPerson',
  'contact number': 'contactNumber',
  phone: 'contactNumber',
  'phone number': 'contactNumber',
  mobile: 'contactNumber',
  email: 'email',
  address: 'address',
  website: 'website',
  'social page': 'website',
  'product name': 'productName',
  product: 'productName',
  'size / specs': 'sizeSpecs',
  'size specs': 'sizeSpecs',
  specs: 'sizeSpecs',
  size: 'sizeSpecs',
  'size per piece': 'sizePerPiece',
  'qty per pack': 'qtyPerPack',
  'quantity per pack': 'qtyPerPack',
  'pack qty': 'qtyPerPack',
  'vat inclusive': 'vatInclusive',
  vat: 'vatInclusive',
  'payment method': 'paymentMethod',
  payment: 'paymentMethod',
  'shipping method': 'shippingMethod',
  shipping: 'shippingMethod',
  'lead time days': 'leadTimeDays',
  'lead time': 'leadTimeDays',
  'lead time (days)': 'leadTimeDays',
  'delivery lead time': 'leadTimeDays',
  status: 'status',
  active: 'status',
  rating: 'rating',
  remarks: 'remarks',
  notes: 'remarks',
}

const normHeader = (h) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[()#:*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Parse a supplier spreadsheet into form-shaped rows (not yet inserted).
 * Returns { rows, skipped } — rows without a Supplier Name are skipped.
 */
export async function parseSupplierFile(file) {
  const XLSX = await xlsx()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('That file has no sheets.')
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: null })
  if (grid.length < 2) throw new Error('The sheet needs a header row and at least one supplier row.')

  const cols = grid[0].map((h) => HEADER_MAP[normHeader(h)] || null)
  if (!cols.includes('name')) throw new Error('No "Supplier Name" column found.')

  const rows = []
  let skipped = 0
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r]
    if (!raw || raw.every((c) => c === null || c === '')) continue
    const rec = {}
    cols.forEach((field, c) => {
      if (field) rec[field] = raw[c]
    })
    if (!String(rec.name ?? '').trim()) {
      skipped += 1
      continue
    }
    // "Status" text → active boolean.
    if (rec.status != null) {
      const s = String(rec.status).toLowerCase()
      rec.active = !(s.includes('inactive') || s === 'no' || s === 'false' || s === '0')
      delete rec.status
    }
    rows.push(rec)
  }
  return { rows, skipped }
}

/** Bulk-insert parsed supplier rows. Returns the number created. */
export async function importSuppliers(rows) {
  const payloads = rows.map(toPayload)
  // Insert in waves so a large file doesn't hit request limits.
  let created = 0
  for (let i = 0; i < payloads.length; i += 200) {
    const batch = payloads.slice(i, i + 200)
    const { error } = await supabase.from('suppliers').insert(batch)
    if (error) throw new Error(`Import failed at row ${i + 1}: ${error.message}`)
    created += batch.length
  }
  return created
}
