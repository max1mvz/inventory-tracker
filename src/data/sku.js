import { supabase } from '../supabaseClient'

/**
 * Structured SKU generation for the Add Product form:
 *   CATEGORY-NAME-ATTRIBUTE-SEQUENCE   e.g. ELE-CAB-BLK-001
 * The SKU lives in products.sku; the barcode (EAN-13) stays the identity.
 */

// 3-letter code per known category. Unknown/custom categories fall back to the
// first three letters of the name.
const CATEGORY_CODES = {
  'Apparel & Accessories': 'APP',
  'Electronics & Gadgets': 'ELE',
  'Home & Living': 'HOM',
  'Health & Beauty': 'HEA',
  'Sporting Goods / Outdoor & Recreation': 'SPT',
  'Hardware & Hand Tools': 'HHT',
  Perishables: 'PER',
  'Dry & Shelf-Stable Goods': 'DRY',
  Beverages: 'BEV',
  'Frozen Foods': 'FRZ',
  'Household & Cleaning': 'HHC',
  'Packaging & Disposables': 'PKG',
  'Raw Materials': 'RAW',
  'Work-in-Progress (WIP)': 'WIP',
  'Finished Goods': 'FIN',
  'MRO (Maintenance, Repair, & Operations)': 'MRO',
  'Janitorial & Facilities': 'JAN',
  'Office Supplies': 'OFF',
  'Hardware & IT Assets': 'HIT',
  Pharmaceuticals: 'PHA',
  'Medical Supplies': 'MED',
  'Surgical Equipment': 'SUR',
  'Diagnostic Gear': 'DIA',
}

const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '')

export function categoryCode(name) {
  const key = String(name || '').trim()
  if (CATEGORY_CODES[key]) return CATEGORY_CODES[key]
  return (letters(key).slice(0, 3) || 'GEN').padEnd(3, 'X')
}

export function nameCode(name) {
  return (letters(name).slice(0, 3) || 'ITM').padEnd(3, 'X')
}

// 3–6 letters from the attribute (colour / colour+size); STD when there's nothing usable.
export function attrCode(attribute) {
  const a = letters(attribute).slice(0, 6)
  return a.length >= 3 ? a : 'STD'
}

/** Live preview with a placeholder sequence (the real number is assigned on save). */
export function skuPreview({ category, name, attribute }) {
  if (!category?.trim() || !name?.trim()) return ''
  return `${categoryCode(category)}-${nameCode(name)}-${attrCode(attribute)}-###`
}

/** Atomically claim the next global sequence number (single DB transaction). */
export async function nextSkuSeq() {
  const { data, error } = await supabase.rpc('next_sku_seq')
  if (error) throw error
  return data
}

/**
 * Build the full SKU, claiming a sequence number. Call once on save. If the
 * save later fails the number is simply skipped — never rolled back — so codes
 * stay unique even if it leaves small gaps.
 */
export async function generateSku({ category, name, attribute }) {
  const seq = await nextSkuSeq()
  return `${categoryCode(category)}-${nameCode(name)}-${attrCode(attribute)}-${String(seq).padStart(3, '0')}`
}
