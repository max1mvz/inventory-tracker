import { supabase } from '../supabaseClient'
import { enqueue, isNetworkError, isOffline, pendingDeltaMap } from '../offline/sync'
import {
  productCacheGet,
  productCachePut,
  productCachePutMany,
  productCacheAll,
  productCacheDelete,
} from '../offline/db'

// Thin data layer over Supabase with an offline fallback. Reads cache the
// catalog locally; writes fall back to the IndexedDB outbox when the network is
// down. RLS fills created_by / user_id from auth.uid() via column defaults.

// Local pub/sub so open lists (Stock, Overview) refresh the instant a product is
// created, edited, or deleted on this device. Product rows aren't in the realtime
// channel (only movements are), so we announce catalog changes ourselves.
const productListeners = new Set()
export function onProductsChanged(cb) {
  productListeners.add(cb)
  return () => productListeners.delete(cb)
}
export function emitProductsChanged() {
  productListeners.forEach((l) => {
    try {
      l()
    } catch {
      /* ignore a bad listener */
    }
  })
}

const cacheShape = (row) => ({
  barcode: row.barcode,
  name: row.name,
  sku: row.sku ?? null,
  category: row.category ?? null,
  unit: row.unit ?? 'pcs',
  reorder_point: row.reorder_point ?? 0,
  cost: row.cost ?? 0,
  price: row.price ?? 0,
  image_url: row.image_url ?? null,
  qty: row.qty ?? 0, // last-known server quantity (baseline for offline math)
})

const toStockRow = (cached, pendingDelta = 0) => {
  const qty = (cached.qty ?? 0) + pendingDelta
  return {
    barcode: cached.barcode,
    name: cached.name,
    sku: cached.sku ?? null,
    category: cached.category ?? null,
    unit: cached.unit ?? 'pcs',
    reorder_point: cached.reorder_point ?? 0,
    cost: cached.cost ?? 0,
    price: cached.price ?? 0,
    image_url: cached.image_url ?? null,
    qty,
    needs_reorder: qty <= (cached.reorder_point ?? 0),
    last_movement: cached.last_movement ?? null,
    stale: true, // came from cache, not a fresh server read
  }
}

/**
 * Look up a barcode. Online: reads current_stock and caches it. Offline: serves
 * the cached catalog with any queued deltas applied. Returns the row or null.
 */
export async function lookupProduct(barcode) {
  if (!isOffline()) {
    try {
      const { data, error } = await supabase
        .from('current_stock')
        .select('*')
        .eq('barcode', barcode)
        .maybeSingle()
      if (error) throw error
      if (data) await productCachePut(cacheShape(data))
      if (data) return data
      // Not on server — but a queued create may exist only in the local cache.
    } catch (e) {
      if (!isNetworkError(e)) throw e
      // network error → fall through to cache
    }
  }
  const cached = await productCacheGet(barcode)
  if (!cached) return null
  const deltas = await pendingDeltaMap()
  return toStockRow(cached, deltas[barcode] || 0)
}

/**
 * All products with computed stock, low-stock first, then alphabetical.
 * Online reads the server (and refreshes the cache); offline builds from cache.
 */
export async function listStock() {
  if (!isOffline()) {
    try {
      const { data, error } = await supabase
        .from('current_stock')
        .select('*')
        .order('needs_reorder', { ascending: false })
        .order('name', { ascending: true })
      if (error) throw error
      const rows = data ?? []
      if (rows.length) await productCachePutMany(rows.map(cacheShape))
      return rows
    } catch (e) {
      if (!isNetworkError(e)) throw e
    }
  }
  const cached = await productCacheAll()
  const deltas = await pendingDeltaMap()
  return cached
    .map((c) => toStockRow(c, deltas[c.barcode] || 0))
    .sort(
      (a, b) =>
        Number(b.needs_reorder) - Number(a.needs_reorder) ||
        (a.name || '').localeCompare(b.name || ''),
    )
}

/**
 * Create a catalog entry. Never touches quantity — a new product starts at 0.
 * Offline: queues the insert and caches it locally so it's usable immediately.
 */
export async function createProduct({
  barcode,
  name,
  sku,
  category,
  unit,
  reorderPoint,
  cost,
  price,
  imageUrl,
}) {
  const payload = {
    barcode,
    name: name.trim(),
    sku: sku?.trim() || null,
    category: category?.trim() || null,
    unit: unit?.trim() || 'pcs',
    reorder_point: Number.isFinite(reorderPoint) ? reorderPoint : 0,
    cost: Number.isFinite(cost) ? cost : 0,
    price: Number.isFinite(price) ? price : 0,
    image_url: imageUrl || null,
  }

  const cacheAndReturn = async (queued) => {
    await productCachePut({ ...payload, qty: 0 })
    emitProductsChanged()
    return {
      queued,
      product: toStockRow({ ...payload, qty: 0 }, 0),
    }
  }

  if (isOffline()) {
    await enqueue('product', payload)
    return cacheAndReturn(true)
  }
  try {
    const { error } = await supabase.from('products').insert(payload)
    if (error) throw error
    await productCachePut({ ...payload, qty: 0 })
    emitProductsChanged()
    return { queued: false, product: null }
  } catch (e) {
    if (!isNetworkError(e)) throw e
    await enqueue('product', payload)
    return cacheAndReturn(true)
  }
}

/**
 * Update a product's catalog metadata (never its quantity). Online-only —
 * editing details offline is a rare case, so it isn't queued; callers get a
 * clear error instead. Refreshes the local cache on success.
 */
export async function updateProduct(
  barcode,
  { name, sku, category, unit, reorderPoint, cost, price, imageUrl, barcode: newBarcode },
) {
  const patch = {
    name: name.trim(),
    sku: sku?.trim() || null,
    category: category?.trim() || null,
    unit: unit?.trim() || 'pcs',
    reorder_point: Number.isFinite(reorderPoint) ? reorderPoint : 0,
    cost: Number.isFinite(cost) ? cost : 0,
    price: Number.isFinite(price) ? price : 0,
    image_url: imageUrl || null,
  }
  const trimmedNew = newBarcode?.trim()
  const changingBarcode = Boolean(trimmedNew) && trimmedNew !== barcode
  if (changingBarcode) patch.barcode = trimmedNew

  if (isOffline()) {
    throw new Error('You’re offline — product details can only be edited online.')
  }
  const { error } = await supabase.from('products').update(patch).eq('barcode', barcode)
  if (error) {
    if (changingBarcode && (isMissingProductFk(error) || error.code === '23503')) {
      throw new Error(
        'Can’t change the barcode while this product has stock history. Run migration 0009 in Supabase to let history follow a renamed barcode.',
      )
    }
    if (changingBarcode && error.code === '23505') {
      throw new Error('That barcode is already used by another product.')
    }
    throw error
  }

  const effective = changingBarcode ? trimmedNew : barcode
  const cached = await productCacheGet(barcode)
  if (changingBarcode) await productCacheDelete(barcode)
  await productCachePut({ ...(cached || {}), ...patch, barcode: effective, qty: cached?.qty ?? 0 })
  emitProductsChanged()
  return { barcode: effective }
}

/**
 * Delete a product. The append-only ledger is protected: a product that has any
 * movements is guarded by the barcode foreign key and can't be deleted — only
 * products with no stock history can. Requires the product-delete migration.
 */
export async function deleteProduct(barcode) {
  if (isOffline()) {
    throw new Error('You’re offline — deleting is only available online.')
  }
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('barcode', barcode)
    .select()
  if (error) {
    if (isMissingProductFk(error) || error.code === '23503') {
      const e = new Error(
        'This product has stock history, which protects the audit trail.',
      )
      e.code = 'HAS_HISTORY' // lets the UI offer an admin-only force delete
      throw e
    }
    throw error
  }
  if (!data || data.length === 0) {
    throw new Error('Delete wasn’t permitted. Run the product-delete migration (0005) in Supabase.')
  }
  await productCacheDelete(barcode)
  emitProductsChanged()
}

/**
 * Force-delete a product AND all its movements (owner/admin only, via a
 * SECURITY DEFINER function). Irreversible — the product's audit trail is gone.
 * Requires migration 0006.
 */
export async function forceDeleteProduct(barcode) {
  if (isOffline()) {
    throw new Error('You’re offline — deleting is only available online.')
  }
  const { error } = await supabase.rpc('delete_product_cascade', { p_barcode: barcode })
  if (error) {
    if (/only owners or admins/i.test(error.message || '')) {
      throw new Error('Only owners or admins can delete a product with stock history.')
    }
    if (/function .*delete_product_cascade.* does not exist/i.test(error.message || '')) {
      throw new Error('Force-delete isn’t set up yet. Run migration 0006 in Supabase.')
    }
    throw error
  }
  await productCacheDelete(barcode)
  emitProductsChanged()
}

// A movement whose barcode has no matching products row trips this FK. It can
// happen when a product exists only in the local cache (a create that was
// queued during a blip and never synced) — we can self-heal from the cache.
function isMissingProductFk(error) {
  if (!error) return false
  return (
    error.code === '23503' ||
    /movements_barcode_fkey|foreign key/i.test(`${error.message || ''}`)
  )
}

// Make sure a product row exists on the server for this barcode, so a movement
// can reference it. Uses the row the UI is showing, else the local cache, else a
// placeholder name (the user can rename via Edit) — so a scan is NEVER blocked
// just because the catalog entry didn't persist. Throws only on a real DB error.
async function ensureProductOnServer(barcode, product) {
  const cached = await productCacheGet(barcode)
  const src = product || cached || {}
  const name = (src.name && String(src.name).trim()) || `Item ${barcode}`
  const { error } = await supabase.from('products').upsert(
    {
      barcode,
      name,
      sku: src.sku ?? null,
      category: src.category ?? null,
      unit: src.unit ?? 'pcs',
      reorder_point: src.reorder_point ?? 0,
      cost: src.cost ?? 0,
      price: src.price ?? 0,
    },
    { onConflict: 'barcode' },
  )
  if (error) throw new Error(`re-save failed: ${error.message}`)
  // Keep the local cache consistent with what we just wrote.
  await productCachePut({ ...cached, barcode, name, qty: cached?.qty ?? 0 })
}

/**
 * Append a stock movement — the ONLY way stock changes. Offline: queues it.
 * Returns { queued } so callers can update the UI optimistically.
 *
 * Self-heals the "product exists only in the local cache" case: if the insert
 * fails the barcode foreign key, we re-save the product from cache and retry.
 */
export async function recordMovement({ barcode, delta, reason, note, product }) {
  const payload = { barcode, delta, reason, note: note?.trim() || null }

  if (isOffline()) {
    await enqueue('movement', payload)
    return { queued: true }
  }
  try {
    let { error } = await supabase.from('movements').insert(payload)

    if (error && isMissingProductFk(error)) {
      // The product row is missing on the server — re-create it, then retry once.
      await ensureProductOnServer(barcode, product)
      ;({ error } = await supabase.from('movements').insert(payload))
    }

    if (error) throw error
    return { queued: false }
  } catch (e) {
    if (isNetworkError(e)) {
      await enqueue('movement', payload)
      return { queued: true }
    }
    throw e
  }
}

/**
 * Movement history for one product, newest first. Online-only — history is a
 * review feature, so it isn't cached for offline.
 */
export async function movementHistory(barcode, limit = 50) {
  const { data, error } = await supabase
    .from('movements')
    .select('id, delta, reason, note, user_id, created_at')
    .eq('barcode', barcode)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/**
 * Recent movements across every product (the audit feed), newest first, with
 * the product name embedded via the movements → products foreign key.
 */
export async function recentMovements(limit = 100) {
  const { data, error } = await supabase
    .from('movements')
    .select('id, barcode, delta, reason, note, user_id, created_at, products(name, unit)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/**
 * All movements since a timestamp (with product name + user), newest first.
 * One query powers the whole dashboard: today's count, the 7-day chart, the
 * 30-day top movers, and the recent-activity panel. Online-only.
 */
export async function movementsSince(sinceISO, limit = 500) {
  const { data, error } = await supabase
    .from('movements')
    .select('id, barcode, delta, reason, note, user_id, created_at, products(name)')
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Suggested categories for the create/edit product forms (free-text; not
// enforced — you can still type anything).
/**
 * Team directory: { [userId]: { email, role } }. Used to name the person behind
 * each movement / catalog change. `profiles` is readable by any signed-in team
 * member (see migration 0002), and it's small, so we fetch it whole and cache it.
 */
let profilesCache = null
export async function listProfiles({ force = false } = {}) {
  if (profilesCache && !force) return profilesCache
  const { data, error } = await supabase.from('profiles').select('id, email, role')
  if (error) throw error
  profilesCache = Object.fromEntries(
    (data ?? []).map((p) => [p.id, { email: p.email, role: p.role }]),
  )
  return profilesCache
}

/**
 * Recent catalog changes (who renamed / re-priced / deleted a product), newest
 * first. Written by a database trigger, so it covers every change. Online-only.
 */
export async function recentAudit(limit = 100) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, table_name, record_id, action, actor_id, changed, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    // Migration 0008 not run yet — degrade to "no catalog history" rather than
    // breaking the feed. PostgREST reports this as 42P01 or a schema-cache miss.
    const msg = `${error.message || ''}`
    if (error.code === '42P01' || /audit_log|schema cache/i.test(msg)) return []
    throw error
  }
  return data ?? []
}

export const PRODUCT_CATEGORIES = [
  'Apparel & Accessories',
  'Electronics & Gadgets',
  'Home & Living',
  'Health & Beauty',
  'Sporting Goods / Outdoor & Recreation',
  'Hardware & Hand Tools',
  'Perishables',
  'Dry & Shelf-Stable Goods',
  'Beverages',
  'Frozen Foods',
  'Household & Cleaning',
  'Packaging & Disposables',
  'Raw Materials',
  'Work-in-Progress (WIP)',
  'Finished Goods',
  'MRO (Maintenance, Repair, & Operations)',
  'Janitorial & Facilities',
  'Office Supplies',
  'Hardware & IT Assets',
  'Pharmaceuticals',
  'Medical Supplies',
  'Surgical Equipment',
  'Diagnostic Gear',
]

export const MOVEMENT_REASONS = [
  'received',
  'sold',
  'damaged',
  'returned',
  'count_adjustment',
  'transfer',
]
