// Draft persistence for the batch sheet — kept in localStorage, NOT Supabase.
// The work-in-progress is tiny and personal (which barcode sits in each of the
// 21 slots + the price toggle), so device-local storage resumes it across
// navigation and reloads with zero database reads/writes/storage. Only the
// barcodes are stored; product details (name / price) are re-resolved from the
// live catalog on restore, so a draft never holds stale product data.
const KEY = 'inventory-tracker:batch-draft'

export function loadBatchDraft() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    return d && Array.isArray(d.slots) ? d : null
  } catch {
    return null
  }
}

// Save the current sheet. Persists barcodes only. Returns the save timestamp, or
// null when the sheet is empty (in which case the draft is removed, not stored).
export function saveBatchDraft({ slots, showPrice }) {
  try {
    const barcodes = slots.map((p) => (p ? p.barcode : null))
    if (!barcodes.some(Boolean)) {
      localStorage.removeItem(KEY)
      return null
    }
    const savedAt = Date.now()
    localStorage.setItem(KEY, JSON.stringify({ slots: barcodes, showPrice, savedAt }))
    return savedAt
  } catch {
    return null
  }
}

export function clearBatchDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
