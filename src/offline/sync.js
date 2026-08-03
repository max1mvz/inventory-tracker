import { supabase } from '../supabaseClient'
import { outboxAdd, outboxAll, outboxDelete, outboxCount } from './db'

// Pub/sub so the UI can show a live pending count.
const listeners = new Set()
export function onOutboxChange(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
async function emit() {
  const count = await outboxCount()
  listeners.forEach((l) => l(count))
}

export function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

// Only network failures get queued/retried. A real error (RLS, constraint) must
// surface instead of looping forever.
export function isNetworkError(e) {
  if (isOffline()) return true
  const msg = `${e?.message || e?.error_description || e || ''}`
  return /failed to fetch|networkerror|load failed|fetch|timeout/i.test(msg) || e?.name === 'TypeError'
}

export async function enqueue(type, payload) {
  await outboxAdd({ type, payload })
  await emit()
}

async function sendItem(item) {
  const table = item.type === 'movement' ? 'movements' : 'products'
  const { error } = await supabase.from(table).insert(item.payload)
  if (error) throw error
}

let flushing = false

/**
 * Try to push every queued write, in the order it was made (FIFO — so a product
 * create always lands before the movements that reference it). Stops on the
 * first network error, keeping the rest for the next attempt.
 */
export async function flushOutbox() {
  if (flushing) return { flushed: 0, remaining: await outboxCount() }
  if (isOffline()) return { flushed: 0, remaining: await outboxCount(), offline: true }
  flushing = true
  let flushed = 0
  try {
    const items = await outboxAll()
    for (const item of items) {
      try {
        await sendItem(item)
        await outboxDelete(item.id)
        flushed++
        await emit()
      } catch (e) {
        if (isNetworkError(e)) break // still offline — keep everything, retry later
        // Non-network failure would wedge the queue forever; drop it so later
        // items can still sync, and surface it for debugging.
        console.error('Dropping un-syncable queued item', item, e)
        await outboxDelete(item.id)
        await emit()
      }
    }
  } finally {
    flushing = false
  }
  return { flushed, remaining: await outboxCount() }
}

// Barcodes with a queued 'product' create that hasn't synced yet. A server
// "not found" for one of these is EXPECTED (the insert is still in the outbox),
// so a lookup must keep trusting the local cache for it. A server "not found"
// for any OTHER barcode means the product genuinely doesn't exist (deleted, or
// never created) — the cache must not resurrect it.
export async function pendingProductBarcodes() {
  const items = await outboxAll()
  const set = new Set()
  for (const it of items) {
    if (it.type === 'product' && it.payload?.barcode) set.add(it.payload.barcode)
  }
  return set
}

// Sum of queued movement deltas per barcode — used to show an optimistic
// quantity while offline (cached server qty + unsynced local changes).
export async function pendingDeltaMap() {
  const items = await outboxAll()
  const map = {}
  for (const it of items) {
    if (it.type === 'movement') {
      map[it.payload.barcode] = (map[it.payload.barcode] || 0) + it.payload.delta
    }
  }
  return map
}
