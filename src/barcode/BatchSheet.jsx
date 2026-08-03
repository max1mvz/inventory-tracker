import { useEffect, useMemo, useRef, useState } from 'react'
import { peso } from '../format'
import { PAGES_STYLE_ID } from './sheet'
import BarcodeSVG from './BarcodeSVG.jsx'

// A standard 21-up sticker sheet (Avery L7160 family): 3 columns × 7 rows on A4.
// Slots stay in fixed positions so a printed label lands on the right sticker —
// empty slots print blank rather than collapsing the grid.
const COLS = 3
const ROWS = 7
const SLOTS = COLS * ROWS // 21

/**
 * Batch label sheet builder. Assign any product to any of the 21 sticker slots —
 * by dragging from the list, clicking an empty slot, filling the remaining
 * slots, or auto-arranging a multi-selection — then print a mixed sheet.
 */
export default function BatchSheet({ products }) {
  const [slots, setSlots] = useState(() => Array(SLOTS).fill(null)) // product row | null
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(() => new Set()) // barcodes ticked for auto-arrange
  const [fillWith, setFillWith] = useState('')
  const [showPrice, setShowPrice] = useState(true)
  // Native drag payload — dataTransfer can't hold an object, so keep it in a ref.
  const dragFrom = useRef(null) // { type: 'list' | 'slot', product, index? }

  // The 21-up sheet is always A4. @page can't read CSS variables, so write the
  // rule into the shared <style> element (same id the single studio uses).
  useEffect(() => {
    let el = document.getElementById(PAGES_STYLE_ID)
    if (!el) {
      el = document.createElement('style')
      el.id = PAGES_STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = '@media print { @page { size: A4; margin: 10mm; } }'
    return () => el?.remove()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) || String(p.barcode).includes(q),
    )
  }, [products, query])

  const filledCount = slots.filter(Boolean).length
  const emptyCount = SLOTS - filledCount

  function updateSlots(fn) {
    setSlots((s) => fn(s.slice()))
  }
  function assign(index, product) {
    updateSlots((n) => {
      n[index] = product
      return n
    })
  }
  function clearSlot(index) {
    updateSlots((n) => {
      n[index] = null
      return n
    })
  }
  function clearAll() {
    setSlots(Array(SLOTS).fill(null))
  }

  function toggleSelected(barcode) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(barcode) ? next.delete(barcode) : next.add(barcode)
      return next
    })
  }

  // ---- native drag & drop ----
  function onChipDragStart(e, product) {
    dragFrom.current = { type: 'list', product }
    e.dataTransfer.effectAllowed = 'copy'
    try {
      e.dataTransfer.setData('text/plain', String(product.barcode))
    } catch {
      /* some browsers require a payload; ignore if setData is blocked */
    }
  }
  function onSlotDragStart(e, index) {
    if (!slots[index]) {
      e.preventDefault()
      return
    }
    dragFrom.current = { type: 'slot', index, product: slots[index] }
    e.dataTransfer.effectAllowed = 'move'
  }
  function onSlotDrop(e, index) {
    e.preventDefault()
    const from = dragFrom.current
    dragFrom.current = null
    if (!from) return
    if (from.type === 'list') {
      assign(index, from.product)
    } else if (from.type === 'slot' && from.index !== index) {
      // Move to an empty slot, or swap with an occupied one.
      updateSlots((n) => {
        const tmp = n[index]
        n[index] = from.product
        n[from.index] = tmp
        return n
      })
    }
  }

  function fillRemaining() {
    const p = products.find((x) => x.barcode === fillWith)
    if (!p) return
    updateSlots((n) => n.map((slot) => slot || p))
  }
  function autoArrange() {
    if (selected.size === 0) return
    const chosen = products.filter((p) => selected.has(p.barcode))
    updateSlots((n) => {
      let qi = 0
      for (let i = 0; i < n.length && qi < chosen.length; i++) {
        if (!n[i]) n[i] = chosen[qi++]
      }
      return n
    })
  }

  return (
    <div className="batch">
      <div className="batch-toolbar">
        <div className="batch-count">
          <strong>{filledCount}</strong> of {SLOTS} slots filled
          {emptyCount > 0 && <span className="batch-count-sub">{emptyCount} empty</span>}
        </div>
        <div className="batch-actions">
          <div className="batch-fill">
            <select value={fillWith} onChange={(e) => setFillWith(e.target.value)}>
              <option value="">Fill remaining with…</option>
              {products.map((p) => (
                <option key={p.barcode} value={p.barcode}>
                  {p.name} — {p.barcode}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn small"
              onClick={fillRemaining}
              disabled={!fillWith || emptyCount === 0}
            >
              Fill {emptyCount}
            </button>
          </div>
          <button
            type="button"
            className="btn small"
            onClick={autoArrange}
            disabled={selected.size === 0 || emptyCount === 0}
            title="Place the ticked products into the next empty slots"
          >
            Auto-arrange {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
          <label className="bc-check batch-check">
            <input
              type="checkbox"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
            />
            <span>Price</span>
          </label>
          <button
            type="button"
            className="btn small"
            onClick={clearAll}
            disabled={filledCount === 0}
          >
            Clear sheet
          </button>
          <button
            className="btn primary small"
            onClick={() => window.print()}
            disabled={filledCount === 0}
          >
            Print sheet
          </button>
        </div>
      </div>

      <div className="batch-grid">
        {/* ---------- product list ---------- */}
        <div className="panel batch-products">
          <div className="panel-head">
            <h3>Products</h3>
          </div>
          <input
            className="batch-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or barcode"
          />
          <p className="field-hint batch-hint">
            Drag a product onto a slot, or tick a few and use Auto-arrange. On touch
            devices, tap an empty slot to choose.
          </p>
          <ul className="batch-chip-list">
            {filtered.length === 0 && (
              <li className="batch-empty">No products match.</li>
            )}
            {filtered.map((p) => (
              <li
                key={p.barcode}
                className={`batch-chip ${selected.has(p.barcode) ? 'sel' : ''}`}
                draggable
                onDragStart={(e) => onChipDragStart(e, p)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.barcode)}
                  onChange={() => toggleSelected(p.barcode)}
                  aria-label={`Select ${p.name}`}
                />
                <span className="batch-chip-body">
                  <span className="batch-chip-name">{p.name}</span>
                  <span className="batch-chip-code">{p.barcode}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- the 21-up sheet ---------- */}
        <div className="panel batch-sheet-panel">
          <div className="panel-head">
            <h3>Sheet · 3 × 7 (A4)</h3>
          </div>
          <div
            className="batch-sheet"
            style={{ aspectRatio: `${210} / ${297}` }}
          >
            {slots.map((product, i) => (
              <div
                key={i}
                className={`batch-slot ${product ? 'filled' : 'empty'}`}
                draggable={Boolean(product)}
                onDragStart={(e) => onSlotDragStart(e, i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onSlotDrop(e, i)}
              >
                {product ? (
                  <>
                    <button
                      type="button"
                      className="batch-slot-clear"
                      onClick={() => clearSlot(i)}
                      aria-label="Clear slot"
                      title="Clear slot"
                    >
                      ×
                    </button>
                    <span className="batch-slot-name">{product.name}</span>
                    <BarcodeSVG
                      code={product.barcode}
                      scale={2}
                      className="batch-slot-bc"
                    />
                    {showPrice && product.price ? (
                      <span className="batch-slot-price">{peso(product.price)}</span>
                    ) : null}
                  </>
                ) : (
                  <label className="batch-slot-add">
                    <span className="batch-slot-plus" aria-hidden="true">
                      +
                    </span>
                    <select
                      value=""
                      onChange={(e) => {
                        const p = products.find((x) => x.barcode === e.target.value)
                        if (p) assign(i, p)
                      }}
                      aria-label={`Add product to slot ${i + 1}`}
                    >
                      <option value="">Add…</option>
                      {products.map((p) => (
                        <option key={p.barcode} value={p.barcode}>
                          {p.name} — {p.barcode}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- printable sheet (screen-hidden, print-only) ---------- */}
      {filledCount > 0 && (
        <div className="print-area" aria-hidden="true">
          <div className="label-sheet batch-print" style={{ '--per-row': COLS }}>
            {slots.map((product, i) =>
              product ? (
                <div className="label" key={i}>
                  <div className="label-name">{product.name}</div>
                  <BarcodeSVG code={product.barcode} scale={2} className="label-bc" />
                  {showPrice && product.price ? (
                    <div className="label-price">{peso(product.price)}</div>
                  ) : null}
                </div>
              ) : (
                <div className="label label-empty" key={i} />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
