import { useRef, useState } from 'react'
import { listStock } from '../data/inventory'
import Icon from '../ui/Icon.jsx'
import {
  applyImport,
  buildImportPlan,
  downloadImportTemplate,
  parseSpreadsheet,
} from './importExport'
import './stockImport.css'

const STATUS_LABEL = { new: 'New', update: 'Update', skip: 'Skip' }

/**
 * Bulk product import from an Excel/CSV file: pick a file, preview exactly what
 * will change, then apply. Stock is set by appending count movements, so the
 * ledger and audit trail stay intact.
 */
export default function StockImport({ onDone }) {
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | parsing | preview | applying | done | error
  const [fileName, setFileName] = useState('')
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)

  function reset() {
    setPhase('idle')
    setFileName('')
    setPlan(null)
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: 0 })
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileName(file.name)
    setPhase('parsing')
    setError(null)
    try {
      const [parsed, current] = await Promise.all([parseSpreadsheet(file), listStock()])
      const built = buildImportPlan(parsed, current)
      setPlan(built)
      setPhase('preview')
    } catch (err) {
      setError(err.message || 'Could not read that file.')
      setPhase('error')
    }
  }

  async function run() {
    if (!plan) return
    setPhase('applying')
    setError(null)
    try {
      const summary = await applyImport(plan, (done, total) => setProgress({ done, total }))
      setResult(summary)
      setPhase('done')
      onDone?.()
    } catch (err) {
      setError(err.message || 'Import failed partway through.')
      setPhase('error')
    }
  }

  const s = plan?.summary
  const willDo = s ? s.newCount + s.updateCount : 0
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <>
      <button className="btn small" onClick={() => setOpen(true)}>
        <Icon name="upload" size={15} />
        Import
      </button>

      {open && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Import products from Excel</h3>
              <button className="btn ghost small" onClick={close}>
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="modal-body">
              {phase === 'idle' && (
                <div className="imp-drop">
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={onFile}
                    hidden
                  />
                  <p className="imp-lead">Upload an .xlsx, .xls or .csv file.</p>
                  <button className="btn primary" onClick={() => inputRef.current?.click()}>
                    Choose file
                  </button>
                  <p className="imp-hint">
                    Needs a <strong>Barcode</strong> and <strong>Name</strong> column. Optional:
                    Category, SKU, Unit, Quantity, Reorder point, Unit cost, Retail price.
                    A <strong>Quantity</strong> column sets each product’s stock.
                  </p>
                  <button className="imp-link" onClick={downloadImportTemplate}>
                    Download a template
                  </button>
                </div>
              )}

              {phase === 'parsing' && (
                <div className="looking">
                  <span className="spinner" /> Reading {fileName}…
                </div>
              )}

              {phase === 'preview' && s && (
                <>
                  <div className="imp-summary">
                    <span className="imp-file">{fileName}</span>
                    <div className="imp-stats">
                      <span className="imp-stat new">{s.newCount} new</span>
                      <span className="imp-stat upd">{s.updateCount} update</span>
                      {plan.setsQuantity && (
                        <span className="imp-stat qty">{s.stockChanges} stock change{s.stockChanges === 1 ? '' : 's'}</span>
                      )}
                      {s.skipped > 0 && <span className="imp-stat skip">{s.skipped} skipped</span>}
                    </div>
                  </div>

                  {!plan.setsQuantity && (
                    <p className="imp-note">
                      No Quantity column — this updates product details only and won’t change any
                      stock levels.
                    </p>
                  )}

                  <div className="imp-preview">
                    <table>
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Barcode</th>
                          <th>Name</th>
                          <th></th>
                          <th className="num">Stock Δ</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.entries.slice(0, 200).map((e, i) => (
                          <tr key={i} className={e.status}>
                            <td className="muted">{e._row}</td>
                            <td className="mono">{e.barcode || '—'}</td>
                            <td>{e.name || ''}</td>
                            <td>
                              <span className={`imp-tag ${e.status}`}>{STATUS_LABEL[e.status]}</span>
                            </td>
                            <td className="num">
                              {e.status === 'skip' || e.delta === 0
                                ? '—'
                                : `${e.delta > 0 ? '+' : ''}${e.delta}`}
                            </td>
                            <td className="muted">
                              {e.reason ||
                                (e.status === 'update' && !e.changedMeta && e.delta === 0
                                  ? 'no change'
                                  : e.targetQty != null
                                    ? `set to ${e.targetQty}`
                                    : '')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.entries.length > 200 && (
                      <p className="imp-hint">Showing the first 200 of {plan.entries.length} rows.</p>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button className="btn ghost" onClick={reset}>
                      Choose a different file
                    </button>
                    <button className="btn primary grow" disabled={willDo === 0} onClick={run}>
                      {willDo === 0 ? 'Nothing to import' : `Import ${willDo} product${willDo === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </>
              )}

              {phase === 'applying' && (
                <div className="imp-progress">
                  <p>Importing… {progress.done} of {progress.total}</p>
                  <div className="imp-bar">
                    <div className="imp-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="imp-hint">Please keep this open until it finishes.</p>
                </div>
              )}

              {phase === 'done' && result && (
                <div className="imp-done">
                  <div className="imp-done-icon">✓</div>
                  <p className="imp-done-lead">Import complete</p>
                  <ul className="imp-done-list">
                    <li>{result.newCount} product{result.newCount === 1 ? '' : 's'} created</li>
                    <li>{result.updateCount} updated</li>
                    <li>{result.stockChanges} stock level{result.stockChanges === 1 ? '' : 's'} set</li>
                    {result.skipped > 0 && <li className="muted">{result.skipped} row(s) skipped</li>}
                  </ul>
                  <button className="btn primary" onClick={close}>
                    Done
                  </button>
                </div>
              )}

              {phase === 'error' && (
                <div className="imp-error">
                  <p className="create-error">{error}</p>
                  <button className="btn" onClick={reset}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
