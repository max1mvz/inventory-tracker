import { supabase } from '../supabaseClient'

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
 * Send a receipt image (data URL or base64) to the extract-receipt edge
 * function and get back suggested fields. The image is read once and never
 * stored. Returns { expense_date, vendor, tin, net_amount, vat_amount,
 * total_amount, category } — any field may be null.
 */
export async function extractReceipt(image) {
  const { data, error } = await supabase.functions.invoke('extract-receipt', { body: { image } })
  if (error) {
    let msg = error.message
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) msg = ctx.error
    } catch {
      /* ignore */
    }
    // The function isn't deployed yet.
    if (/Failed to send|Function not found|404/i.test(msg)) {
      throw new Error('Receipt scanning isn’t deployed yet. Deploy the extract-receipt function.')
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data.fields
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
