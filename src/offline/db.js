// Minimal IndexedDB wrapper — no external dependency. Two stores:
//   outbox   : queued writes (movements / product creates) awaiting the network
//   products : a local cache of the catalog so lookups work offline
const DB_NAME = 'inventory-tracker'
const DB_VERSION = 1

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'barcode' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const result = fn(s)
        // Read the value in `oncomplete` — AFTER the request's onsuccess has
        // populated the holder. A reqValue() holder always carries a `__value`
        // key, so return it even when it's undefined (a cache miss / empty get).
        // The old `result?.__value ?? result` wrongly fell back to the holder
        // OBJECT on a miss, so productCacheGet(unknown) resolved truthy and
        // every unknown barcode looked like a phantom empty product. Anything
        // that isn't a holder (e.g. the {__value: count} from putMany, or a
        // bare value) passes through unchanged.
        t.oncomplete = () =>
          resolve(
            result && typeof result === 'object' && '__value' in result
              ? result.__value
              : result,
          )
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

function reqValue(request) {
  // Wrap an IDBRequest so tx() can return its result after completion.
  const holder = { __value: undefined }
  request.onsuccess = () => {
    holder.__value = request.result
  }
  return holder
}

// ---- outbox ----
export function outboxAdd(item) {
  return tx('outbox', 'readwrite', (s) =>
    reqValue(s.add({ ...item, created_at: Date.now() })),
  )
}

export function outboxAll() {
  return tx('outbox', 'readonly', (s) => reqValue(s.getAll()))
}

export function outboxDelete(id) {
  return tx('outbox', 'readwrite', (s) => reqValue(s.delete(id)))
}

export function outboxCount() {
  return tx('outbox', 'readonly', (s) => reqValue(s.count()))
}

// ---- product cache ----
export function productCachePut(product) {
  return tx('products', 'readwrite', (s) => reqValue(s.put(product)))
}

export function productCachePutMany(products) {
  return tx('products', 'readwrite', (s) => {
    products.forEach((p) => s.put(p))
    return { __value: products.length }
  })
}

export function productCacheGet(barcode) {
  return tx('products', 'readonly', (s) => reqValue(s.get(barcode)))
}

export function productCacheDelete(barcode) {
  return tx('products', 'readwrite', (s) => reqValue(s.delete(barcode)))
}

export function productCacheAll() {
  return tx('products', 'readonly', (s) => reqValue(s.getAll()))
}
