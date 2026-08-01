import { useCallback, useEffect, useRef, useState } from 'react'
import { listStock, onProductsChanged } from '../data/inventory'
import { useRealtimeMovements } from '../data/useRealtimeMovements'
import { useProductView } from '../product/ProductViewContext.jsx'
import Icon from '../ui/Icon.jsx'
import StockImport from './StockImport.jsx'
import StockExport from './StockExport.jsx'
import './StockList.css'

export default function StockList() {
  const { openProduct, openCreate } = useProductView()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const reloadTimer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await listStock())
    } catch (e) {
      setError(e.message || 'Could not load stock.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refresh when a product is created / edited / deleted on this device.
  useEffect(() => onProductsChanged(load), [load])

  // Live sync: when any teammate records a movement, refresh the list. Debounced
  // so a burst of scans triggers one reload, not one per row.
  const realtimeStatus = useRealtimeMovements(() => {
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(load, 400)
  })
  useEffect(() => () => clearTimeout(reloadTimer.current), [])

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (
      r.name?.toLowerCase().includes(q) ||
      r.barcode?.toLowerCase().includes(q) ||
      r.sku?.toLowerCase().includes(q)
    )
  })

  const lowCount = rows.filter((r) => r.needs_reorder).length

  return (
    <section className="stock">
      <div className="stock-head">
        <div className="stock-summary">
          <strong>{rows.length}</strong> product{rows.length === 1 ? '' : 's'}
          {lowCount > 0 && <span className="low-pill">{lowCount} low</span>}
        </div>
        <div className="stock-head-right">
          <span
            className={`live ${realtimeStatus === 'SUBSCRIBED' ? 'on' : ''}`}
            title={
              realtimeStatus === 'SUBSCRIBED'
                ? 'Live — updates automatically'
                : 'Connecting…'
            }
          >
            <span className="live-dot" />
            {realtimeStatus === 'SUBSCRIBED' ? 'Live' : '…'}
          </span>
          <button className="btn small primary" onClick={openCreate}>
            <Icon name="plus" size={15} />
            Add
          </button>
        </div>
      </div>

      <div className="stock-tools">
        <StockImport onDone={load} />
        {rows.length > 0 && <StockExport rows={rows} />}
      </div>

      {rows.length > 0 && (
        <input
          className="stock-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, barcode, or SKU"
        />
      )}

      {loading && (
        <div className="looking">
          <span className="spinner" /> Loading stock…
        </div>
      )}

      {error && <p className="create-error">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="stock-empty">
          <p>No products yet.</p>
          <p className="muted">Scan or type a barcode to add your first one.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <ul className="stock-list">
          {filtered.map((r) => (
            <li key={r.barcode}>
              <button
                className={`stock-row ${r.needs_reorder ? 'low' : ''}`}
                onClick={() => openProduct(r.barcode)}
              >
                {r.image_url ? (
                  <img className="row-thumb" src={r.image_url} alt="" loading="lazy" />
                ) : (
                  <span className="row-thumb empty" aria-hidden="true" />
                )}
                <span className="stock-row-main">
                  <span className="stock-name">{r.name}</span>
                  <span className="stock-sub">
                    {r.sku ? `SKU ${r.sku} · ` : ''}
                    {r.barcode}
                  </span>
                </span>
                <span className="stock-row-qty">
                  <span className="stock-qty">{r.qty}</span>
                  <span className="stock-unit">{r.unit || 'pcs'}</span>
                  {r.needs_reorder && <span className="badge danger">Low</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && rows.length > 0 && filtered.length === 0 && (
        <p className="stock-empty muted">No matches for “{query}”.</p>
      )}
    </section>
  )
}
