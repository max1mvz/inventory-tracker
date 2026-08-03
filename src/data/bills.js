import { supabase } from '../supabaseClient'

/**
 * Billing due reminders — recurring monthly bills (credit cards, loans,
 * e-wallets, subscriptions). Owner/admin only (RLS), online-only like expenses:
 * callers surface any network error to the user.
 */

const numOrNull = (v) => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const clampDay = (v) => Math.min(31, Math.max(1, parseInt(v, 10) || 1))

// Card colour presets (UI only). Keys are stored on the row; the gradient lives
// in bills.css as .bill-theme-<key>.
export const CARD_THEMES = [
  { key: 'slate', label: 'Slate' },
  { key: 'red', label: 'Red' },
  { key: 'blue', label: 'Blue' },
  { key: 'green', label: 'Green' },
  { key: 'orange', label: 'Orange' },
  { key: 'violet', label: 'Violet' },
  { key: 'teal', label: 'Teal' },
  { key: 'gold', label: 'Gold' },
]

// Free-text suggestions for the "issuer / type" field.
export const BILL_ISSUERS = [
  'Credit Card',
  'Bank Loan',
  'E-Wallet',
  'Utility',
  'Internet / Telco',
  'Insurance',
  'Subscription',
  'Rent / Lease',
]

/** All bills, soonest due-day first. */
export async function listBills() {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .order('due_day', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

function toPayload({ name, issuer, accountRef, amount, dueDay, theme, note, active }) {
  return {
    name: name.trim(),
    issuer: issuer?.trim() || null,
    account_ref: accountRef?.trim() || null,
    amount: numOrNull(amount),
    due_day: clampDay(dueDay),
    theme: theme || 'slate',
    note: note?.trim() || null,
    active: active !== false,
  }
}

/** Create a bill. `name` and `dueDay` are required. */
export async function createBill(fields) {
  const { data, error } = await supabase.from('bills').insert(toPayload(fields)).select().single()
  if (error) throw error
  return data
}

/** Update a bill's details. */
export async function updateBill(id, fields) {
  const { data, error } = await supabase
    .from('bills')
    .update(toPayload(fields))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Toggle a bill active/paused without deleting it. */
export async function setBillActive(id, active) {
  const { error } = await supabase.from('bills').update({ active }).eq('id', id)
  if (error) throw error
}

/** Delete a bill. */
export async function deleteBill(id) {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw error
}
