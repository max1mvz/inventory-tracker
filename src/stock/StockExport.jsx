import { useEffect, useRef, useState } from 'react'
import { peso } from '../format'
import Icon from '../ui/Icon.jsx'
import { exportToExcel } from './importExport'
import './stockExport.css'

/**
 * Download the current stock as Excel, or as PDF via the browser's print dialog
 * (a proper printable report is rendered below, hidden except when printing).
 */
export default function StockExport({ rows }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function excel() {
    setOpen(false)
    setBusy(true)
    try {
      await exportToExcel(rows)
    } finally {
      setBusy(false)
    }
  }

  function pdf() {
    setOpen(false)
    // The report is already in the DOM; the print stylesheet reveals just it.
    setTimeout(() => window.print(), 50)
  }

  const totals = rows.reduce(
    (t, r) => {
      t.units += r.qty || 0
      t.stockValue += (r.qty || 0) * (r.cost || 0)
      t.retailValue += (r.qty || 0) * (r.price || 0)
      if (r.needs_reorder) t.low += 1
      return t
    },
    { units: 0, stockValue: 0, retailValue: 0, low: 0 },
  )

  return (
    <div className="export-wrap" ref={ref}>
      <button className="btn small" onClick={() => setOpen((o) => !o)} disabled={busy}>
        <Icon name="download" size={15} />
        {busy ? 'Exporting…' : 'Export'}
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="export-menu">
          <button onClick={excel}>
            <Icon name="download" size={15} /> Excel (.xlsx)
          </button>
          <button onClick={pdf}>
            <Icon name="download" size={15} /> PDF (print)
          </button>
        </div>
      )}

      {/* Printable report — screen-hidden, revealed only by the print stylesheet. */}
      <div className="stock-print-area" aria-hidden="true">
        <div className="sp-head">
          <h1>Inventory report</h1>
          <div className="sp-meta">
            {new Date().toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
        <div className="sp-totals">
          <span>
            <strong>{rows.length}</strong> products
          </span>
          <span>
            <strong>{totals.units.toLocaleString()}</strong> units
          </span>
          <span>
            Stock value <strong>{peso(totals.stockValue)}</strong>
          </span>
          <span>
            Retail value <strong>{peso(totals.retailValue)}</strong>
          </span>
          <span>
            <strong>{totals.low}</strong> low
          </span>
        </div>
        <table className="sp-table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>Name</th>
              <th>Category</th>
              <th className="num">Qty</th>
              <th>Unit</th>
              <th className="num">Reorder</th>
              <th className="num">Cost</th>
              <th className="num">Price</th>
              <th className="num">Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.barcode}>
                <td className="mono">{r.barcode}</td>
                <td>{r.name}</td>
                <td>{r.category || ''}</td>
                <td className="num">{r.qty ?? 0}</td>
                <td>{r.unit || 'pcs'}</td>
                <td className="num">{r.reorder_point ?? 0}</td>
                <td className="num">{peso(r.cost || 0)}</td>
                <td className="num">{peso(r.price || 0)}</td>
                <td className="num">{peso((r.qty || 0) * (r.cost || 0))}</td>
                <td>{r.needs_reorder ? 'Low' : 'OK'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="3">TOTAL</td>
              <td className="num">{totals.units.toLocaleString()}</td>
              <td colSpan="4"></td>
              <td className="num">{peso(totals.stockValue)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
