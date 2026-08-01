import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listStock, onProductsChanged } from '../data/inventory'
import { useRealtimeMovements } from '../data/useRealtimeMovements'
import { useProductView } from '../product/ProductViewContext.jsx'
import { peso } from '../format'
import Icon from '../ui/Icon.jsx'
import StockImport from './StockImport.jsx'
import StockExport from './StockExport.jsx'
import './StockTable.css'

const COLUMNS = [
  { key: 'name', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'sku', label: 'SKU' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'qty', label: 'Qty', num: true },
  { key: 'reorder_point', label: 'Reorder', num: true },
  { key: 'price', label: 'Price', num: true },
  { key: 'last_movement', label: 'Last movement' },
]

export default function StockTable() {
  const { openProduct, openCreate } = useProductView()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'needs_reorder', dir: 'desc' })
  const timer = useRef(null)

  const load = useCallback(async () => {
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

  useRealtimeMovements(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 400)
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? rows.filter(
          (r) =>
            r.name?.toLowerCase().includes(q) ||
            r.barcode?.toLowerCase().includes(q) ||
            r.sku?.toLowerCase().includes(q) ||
            r.category?.toLowerCase().includes(q),
        )
      : rows
    const { key, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
      return `${av ?? ''}`.localeCompare(`${bv ?? ''}`) * mul
    })
  }, [rows, query, sort])

  const lowCount = rows.filter((r) => r.needs_reorder).length

  return (
    <section className="stock-table-wrap">
      <div className="stock-head">
        <div className="stock-summary">
          <strong>{rows.length}</strong> products
          {lowCount > 0 && <span className="low-pill">{lowCount} low</span>}
        </div>
        <div className="stock-head-actions">
          <input
            className="stock-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, barcode, or SKU"
          />
          <StockImport onDone={load} />
          <StockExport rows={rows} />
          <button className="btn primary small add-product" onClick={openCreate}>
            <Icon name="plus" size={16} />
            Add product
          </button>
        </div>
      </div>

      {loading && (
        <div className="looking">
          <span className="spinner" /> Loading stock…
        </div>
      )}
      {error && <p className="create-error">{error}</p>}
      {!loading && rows.length === 0 && (
        <div className="stock-empty">
          <p>No products yet.</p>
          <p className="muted">Scan or type a barcode to add your first one.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={c.num ? 'num' : ''}
                    onClick={() => toggleSort(c.key)}
                  >
                    {c.label}
                    {sort.key === c.key && (
                      <span className="sort-arrow">{sort.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                ))}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr
                  key={r.barcode}
                  className={r.needs_reorder ? 'low' : ''}
                  onClick={() => openProduct(r.barcode)}
                >
                  <td className="strong">
                    <span className="cell-product">
                      {r.image_url ? (
                        <img className="row-thumb" src={r.image_url} alt="" loading="lazy" />
                      ) : (
                        <span className="row-thumb empty" aria-hidden="true" />
                      )}
                      {r.name}
                    </span>
                  </td>
                  <td className="muted">{r.category || '—'}</td>
                  <td className="muted">{r.sku || '—'}</td>
                  <td className="mono muted">{r.barcode}</td>
                  <td className="num strong">
                    {r.qty} <span className="unit">{r.unit}</span>
                  </td>
                  <td className="num muted">{r.reorder_point}</td>
                  <td className="num muted">{peso(r.price)}</td>
                  <td className="muted">
                    {r.last_movement
                      ? new Date(r.last_movement).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td>
                    {r.needs_reorder ? (
                      <span className="badge danger">Low</span>
                    ) : (
                      <span className="badge muted">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
