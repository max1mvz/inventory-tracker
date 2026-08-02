import { supabase } from '../supabaseClient'
import { compressImage } from '../scan/productImage'

const RECEIPT_BUCKET = 'expense-receipts'

/**
 * Expense / VAT records for tax bookkeeping. Separate from inventory — an
 * expense is never a stock movement. Online-only for now (no offline queue);
 * callers surface any network error to the user.
 */

const numOrNull = (v) => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** All expenses, newest date first. */
export async function listExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Record a new expense. `expenseDate` and `totalAmount` are required. */
export async function createExpense({
  expenseDate,
  vendor,
  tin,
  netAmount,
  vatAmount,
  totalAmount,
  category,
  note,
  receiptPath,
}) {
  const payload = {
    expense_date: expenseDate,
    vendor: vendor?.trim() || null,
    tin: tin?.trim() || null,
    net_amount: numOrNull(netAmount),
    vat_amount: numOrNull(vatAmount),
    total_amount: Number(totalAmount) || 0,
    category: category?.trim() || null,
    note: note?.trim() || null,
  }
  // Only reference receipt_path when there's a photo, so adding a plain expense
  // keeps working even before the expense-receipts migration adds the column.
  if (receiptPath) payload.receipt_path = receiptPath
  const { data, error } = await supabase.from('expenses').insert(payload).select().single()
  if (error) throw error
  return data
}

/** Delete an expense by id. */
export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

/**
 * Compress and upload a receipt photo to the private receipts bucket. Returns
 * the storage PATH to save on the expense (view it later via getReceiptUrl).
 */
export async function uploadReceiptImage(file) {
  const { blob, ext, type } = await compressImage(file, { maxDim: 1600, quality: 0.85 })
  const path = `${new Date().getFullYear()}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, blob, {
    contentType: type,
    upsert: false,
  })
  if (error) {
    if (/bucket not found/i.test(error.message || '')) {
      throw new Error('Receipt storage isn’t set up yet. Run the expense-receipts migration.')
    }
    throw error
  }
  return path
}

/** A short-lived signed URL to view a private receipt image. */
export async function getReceiptUrl(path) {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 120)
  if (error) throw error
  return data.signedUrl
}

// Suggested categories for the entry form (free text — type anything).
export const EXPENSE_CATEGORIES = [
  'Utilities',
  'Rent',
  'Fuel',
  'Transportation',
  'Supplies',
  'Repairs & Maintenance',
  'Communication',
  'Professional Fees',
  'Taxes & Licenses',
  'Salaries & Wages',
  'Miscellaneous',
]
