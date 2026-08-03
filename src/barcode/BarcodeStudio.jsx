import { useCallback, useEffect, useMemo, useState } from 'react'
import { listStock, updateProduct } from '../data/inventory'
import { peso } from '../format'
import { isValidEan13, normalizeEan13, onlyDigits } from './ean13'
import { GAP_X, GAP_Y, PAGES_STYLE_ID, PAGE_MARGIN, PAPERS, sheetLayout } from './sheet'
import BarcodeSVG from './BarcodeSVG.jsx'
import BatchSheet from './BatchSheet.jsx'
import LabelZoom from './LabelZoom.jsx'
import './barcode.css'

const PER_ROW = [2, 3, 4, 5, 6, 8]

/**
 * Barcode studio: turn a product (or any number) into a scannable EAN-13, then
 * preview and print a sheet of labels. Generation is local — nothing is saved
 * unless you print it.
 */
export default function BarcodeStudio() {
  const [mode, setMode] = useState('single') // 'single' | 'batch'
  const [products, setProducts] = useState([])
  const [input, setInput] = useState('')
  const [label, setLabel] = useState('')
  const [priceText, setPriceText] = useState('')
  const [copies, setCopies] = useState(12)
  const [perRow, setPerRow] = useState(3)
  // Price shows on each label whenever the Price line is filled — the field
  // itself is the control, so no separate on/off toggle is needed.
  const showPrice = priceText.trim().length > 0
  const [paper, setPaper] = useState('a4')
  const [pages, setPages] = useState(1)
  const [pickedBarcode, setPickedBarcode] = useState('') // product chosen above
  const [assigning, setAssigning] = useState(false)
  const [assignMsg, setAssignMsg] = useState(null)
  const [assignErr, setAssignErr] = useState(null)
  const [zoom, setZoom] = useState(null) // { code, name, price } | null — real-size view

  const loadProducts = useCallback(
    () => listStock().then(setProducts).catch(() => {}),
    [],
  )

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const layout = useMemo(
    () => sheetLayout({ paper, perRow, showName: Boolean(label), showPrice }),
    [paper, perRow, label, showPrice],
  )

  // Tell the printer which paper we're laying out for. @page can't read CSS
  // variables, so the rule is written into a dedicated <style> element.
  useEffect(() => {
    let el = document.getElementById(PAGES_STYLE_ID)
    if (!el) {
      el = document.createElement('style')
      el.id = PAGES_STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = `@media print { @page { size: ${PAPERS[paper].css}; margin: ${PAGE_MARGIN}mm; } }`
    return () => el?.remove()
  }, [paper])

  const result = useMemo(() => normalizeEan13(input), [input])
  const picked = products.find((p) => p.barcode === pickedBarcode) || null

  // The exact code encoded on EVERY label. When a product is selected and still
  // showing its own saved barcode, and that barcode is a valid EAN-13, encode it
  // verbatim — never normalizeEan13's check-digit-"corrected" variant. That
  // correction can change the digits (e.g. a saved code with a wrong check digit,
  // or a 12-digit UPC), producing a sticker that encodes a DIFFERENT number than
  // the product's database key; a perfect scan of it then misses ("Product not
  // found"). The free-form generator (no product picked, or a picked product
  // whose saved barcode isn't a valid EAN-13 and must be repaired via Assign
  // first) still uses the normalized code.
  const showingPickedBarcode =
    Boolean(picked) && input.trim() === picked.barcode && isValidEan13(picked.barcode)
  const printCode = showingPickedBarcode ? picked.barcode : result.code

  const ready = Boolean(printCode)
  const totalPages = Math.max(1, Math.ceil(copies / layout.perPage))
  // Only the first page is drawn — enough to judge the layout without rendering
  // hundreds of SVGs.
  const labelsOnFirstPage = Math.min(copies, layout.perPage)

  function pickProduct(barcode) {
    const p = products.find((x) => x.barcode === barcode)
    if (!p) return
    setPickedBarcode(p.barcode)
    setInput(p.barcode)
    setLabel(p.name || '')
    setPriceText(p.price ? peso(p.price) : '')
    setAssignMsg(null)
    setAssignErr(null)
  }

  // Which product (if any) a scan of THIS label will actually resolve to — an
  // exact match on the code we encode. A label is only useful once a product
  // truly carries that code.
  const linkedTo = ready ? products.find((p) => p.barcode === printCode) : null
  const canAssign = Boolean(ready && picked && !linkedTo)

  /** Point the chosen product at this barcode, so scanning it finds the product. */
  async function assignToPicked() {
    if (!picked) return
    setAssigning(true)
    setAssignErr(null)
    setAssignMsg(null)
    try {
      await updateProduct(picked.barcode, {
        barcode: result.code,
        name: picked.name,
        sku: picked.sku,
        category: picked.category,
        unit: picked.unit,
        reorderPoint: picked.reorder_point,
        cost: picked.cost,
        price: picked.price,
        imageUrl: picked.image_url,
      })
      await loadProducts()
      setPickedBarcode(result.code)
      setInput(result.code) // keep the field on the product's new (valid) barcode
      setAssignMsg(`${picked.name} now uses this barcode — it will scan.`)
    } catch (e) {
      setAssignErr(e.message || 'Could not assign the barcode.')
    } finally {
      setAssigning(false)
    }
  }

  const invalidSource =
    input.trim().length > 0 && onlyDigits(input).length === 13 && !isValidEan13(input)

  return (
    <section className="barcode-studio">
      <div className="seg bc-tabs">
        <button
          type="button"
          className={`seg-btn ${mode === 'single' ? 'on' : ''}`}
          onClick={() => setMode('single')}
        >
          Single label
        </button>
        <button
          type="button"
          className={`seg-btn ${mode === 'batch' ? 'on' : ''}`}
          onClick={() => setMode('batch')}
        >
          Batch sheet
        </button>
      </div>

      {mode === 'batch' ? (
        <BatchSheet products={products} />
      ) : (
      <>
      <div className="bc-grid">
        {/* ---------- controls ---------- */}
        <div className="panel bc-controls">
          <div className="panel-head">
            <h3>Create a barcode</h3>
          </div>

          <label className="field">
            <span>From a product</span>
            <select value="" onChange={(e) => pickProduct(e.target.value)}>
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={p.barcode} value={p.barcode}>
                  {p.name} — {p.barcode}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Barcode number</span>
            <input
              type="text"
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="12 digits (check digit added) or 13"
            />
            {result.error ? (
              <small className="create-error">{result.error}</small>
            ) : result.corrected ? (
              <small className="bc-note warn">
                Check digit corrected to <strong>{result.code.slice(-1)}</strong> — the
                number you entered wouldn’t scan.
              </small>
            ) : ready ? (
              <small className="bc-note ok">Valid EAN-13 ✓</small>
            ) : (
              <small className="field-hint">
                Enter 12 digits and the check digit is calculated for you.
              </small>
            )}
          </label>

          {/* Whether this code actually resolves to a product when scanned. */}
          {ready && (
            <div className={`bc-link ${linkedTo ? 'ok' : 'warn'}`}>
              {linkedTo ? (
                <span>
                  Scans as <strong>{linkedTo.name}</strong>
                </span>
              ) : (
                <>
                  <span>
                    {picked
                      ? `“${picked.name}” has a saved barcode that isn’t a scannable EAN-13, so this label won’t scan back to it yet.`
                      : 'Not assigned to any product — scanning this label won’t find anything yet.'}
                  </span>
                  {canAssign ? (
                    <button
                      type="button"
                      className="btn small primary"
                      onClick={assignToPicked}
                      disabled={assigning}
                    >
                      {assigning ? 'Assigning…' : `Assign to ${picked.name}`}
                    </button>
                  ) : (
                    <span className="bc-link-hint">
                      Choose a product above to assign it.
                    </span>
                  )}
                </>
              )}
            </div>
          )}
          {assignMsg && <small className="bc-note ok">{assignMsg}</small>}
          {assignErr && <small className="create-error">{assignErr}</small>}

          <label className="field">
            <span>Label text</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Product name"
            />
          </label>

          <div className="create-row">
            <label className="field">
              <span>Price line</span>
              <input
                type="text"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="₱0"
              />
            </label>
            <label className="field">
              <span>Labels to print</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
              />
            </label>
          </div>

          <div className="create-row">
            <label className="field">
              <span>Paper</span>
              <select value={paper} onChange={(e) => setPaper(e.target.value)}>
                {Object.values(PAPERS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.w}×{p.h}mm)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Pages to fill</span>
              <input
                type="number"
                min="1"
                max="20"
                value={pages}
                onChange={(e) =>
                  setPages(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                }
              />
            </label>
          </div>

          <label className="field">
            <span>Labels per row</span>
            <div className="seg bc-seg">
              {PER_ROW.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`seg-btn ${perRow === n ? 'on' : ''}`}
                  onClick={() => setPerRow(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </label>

          <div className="bc-fit">
            <div className="bc-fit-main">
              <strong>{layout.perPage}</strong> labels fit on one {PAPERS[paper].label} page
              <span className="bc-fit-grid">
                {layout.cols} × {layout.rows} · {layout.labelW}×{layout.labelH}mm
              </span>
            </div>
            <button
              type="button"
              className="btn small"
              onClick={() => setCopies(Math.min(1000, layout.perPage * pages))}
            >
              Fill {pages > 1 ? `${pages} pages` : 'the page'}
            </button>
          </div>

          {layout.scannable ? (
            <small className="bc-note ok">
              Barcode prints at {layout.magnificationPct}% of full size — scans reliably.
            </small>
          ) : (
            <small className="bc-note warn">
              At {perRow} per row the barcode is only {layout.magnificationPct}% of full
              size. Below 80% many scanners fail — use 5 or fewer per row.
            </small>
          )}

          <button
            className="btn primary"
            disabled={!ready}
            onClick={() => window.print()}
          >
            Print {copies} label{copies === 1 ? '' : 's'}
          </button>
          {invalidSource && (
            <small className="bc-note warn">
              Heads up: this product’s saved barcode isn’t a valid EAN-13. Printing the
              corrected number means it won’t match the code stored on the product.
            </small>
          )}
        </div>

        {/* ---------- preview ---------- */}
        <div className="panel bc-preview">
          <div className="panel-head">
            <h3>Preview</h3>
          </div>
          {ready ? (
            <>
              <div
                className="bc-single"
                role="button"
                tabIndex={0}
                title="Tap to view at scannable size"
                onClick={() =>
                  setZoom({ code: printCode, name: label, price: showPrice ? priceText : '' })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setZoom({ code: printCode, name: label, price: showPrice ? priceText : '' })
                  }
                }}
              >
                <BarcodeSVG code={printCode} scale={3} />
              </div>
              <p className="bc-preview-meta">
                {label || 'No label text'}
                {showPrice && priceText ? ` · ${priceText}` : ''}
              </p>

              {/* A true-to-scale mock of the printed sheet: page proportions,
                  margins, gaps and label count all come from the same geometry
                  the printer uses, so what's here is what comes out. */}
              <div className="bc-sheet-head">
                <span>Sheet preview</span>
                <span className="bc-sheet-pages">
                  Page 1 of {totalPages} · {PAPERS[paper].label}
                </span>
              </div>
              <p className="field-hint bc-sheet-note">
                A scaled layout mock — the small on-screen labels are too tiny to
                scan. <strong>Tap any label</strong> to open it at scannable size,
                or scan the <strong>printed</strong> sheet.
              </p>
              <div
                className="bc-page"
                style={{ aspectRatio: `${PAPERS[paper].w} / ${PAPERS[paper].h}` }}
              >
                <div
                  className="bc-page-inner"
                  style={{
                    top: `${(PAGE_MARGIN / PAPERS[paper].h) * 100}%`,
                    bottom: `${(PAGE_MARGIN / PAPERS[paper].h) * 100}%`,
                    left: `${(PAGE_MARGIN / PAPERS[paper].w) * 100}%`,
                    right: `${(PAGE_MARGIN / PAPERS[paper].w) * 100}%`,
                    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                    // Real label height, not 1fr — so any leftover space at the
                    // foot of the page shows up here exactly as it will print.
                    gridTemplateRows: `repeat(${layout.rows}, ${
                      (layout.labelH / (PAPERS[paper].h - PAGE_MARGIN * 2)) * 100
                    }%)`,
                    alignContent: 'start',
                    columnGap: `${(GAP_X / PAPERS[paper].w) * 100}%`,
                    rowGap: `${(GAP_Y / PAPERS[paper].h) * 100}%`,
                  }}
                >
                  {Array.from({ length: labelsOnFirstPage }, (_, i) => (
                    <div
                      className="bc-mini-label"
                      key={i}
                      role="button"
                      tabIndex={0}
                      title="Tap to view at scannable size"
                      onClick={() =>
                        setZoom({
                          code: printCode,
                          name: label,
                          price: showPrice ? priceText : '',
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setZoom({ code: printCode, name: label, price: showPrice ? priceText : '' })
                        }
                      }}
                    >
                      {label && <span className="bc-mini-name">{label}</span>}
                      {/* Show the human-readable digits here too, so the sheet
                          preview matches what actually prints on each label. */}
                      <BarcodeSVG code={printCode} scale={2} className="bc-mini-bc" />
                      {showPrice && priceText && (
                        <span className="bc-mini-price">{priceText}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="field-hint">
                {copies} label{copies === 1 ? '' : 's'} · {layout.cols}×{layout.rows} per
                page · {totalPages} page{totalPages === 1 ? '' : 's'} of{' '}
                {PAPERS[paper].label}
              </p>
            </>
          ) : (
            <p className="chart-empty">Enter a barcode number to see it here.</p>
          )}
        </div>
      </div>

      {/* ---------- the printable sheet (screen-hidden, print-only) ---------- */}
      {ready && (
        <div className="print-area" aria-hidden="true">
          <div className="label-sheet" style={{ '--per-row': perRow }}>
            {Array.from({ length: copies }, (_, i) => (
              <div className="label" key={i}>
                {label && <div className="label-name">{label}</div>}
                <BarcodeSVG code={printCode} scale={2} className="label-bc" />
                {showPrice && priceText && <div className="label-price">{priceText}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {zoom && (
        <LabelZoom
          code={zoom.code}
          name={zoom.name}
          price={zoom.price}
          onClose={() => setZoom(null)}
        />
      )}
      </>
      )}
    </section>
  )
}
