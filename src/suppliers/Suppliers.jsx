import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  setSupplierActive,
  exportSuppliers,
  downloadSupplierTemplate,
  parseSupplierFile,
  importSuppliers,
  PAYMENT_METHODS,
  SHIPPING_METHODS,
} from '../data/suppliers'
import Icon from '../ui/Icon.jsx'
import './suppliers.css'

const PAGE_SIZES = [10, 25, 50]

const emptyForm = {
  id: null,
  name: '',
  contactPerson: '',
  contactNumber: '',
  email: '',
  address: '',
  website: '',
  productName: '',
  sizeSpecs: '',
  sizePerPiece: '',
  qtyPerPack: '',
  vatInclusive: '',
  paymentMethod: '',
  shippingMethod: '',
  leadTimeDays: '',
  remarks: '',
  active: true,
  rating: 0,
}

function fromRow(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name || '',
    contactPerson: r.contact_person || '',
    contactNumber: r.contact_number || '',
    email: r.email || '',
    address: r.address || '',
    website: r.website || '',
    productName: r.product_name || '',
    sizeSpecs: r.size_specs || '',
    sizePerPiece: r.size_per_piece || '',
    qtyPerPack: r.qty_per_pack ?? '',
    vatInclusive: r.vat_inclusive == null ? '' : r.vat_inclusive ? 'Yes' : 'No',
    paymentMethod: r.payment_method || '',
    shippingMethod: r.shipping_method || '',
    leadTimeDays: r.lead_time_days ?? '',
    remarks: r.remarks || '',
    active: r.active !== false,
    rating: r.rating || 0,
  }
}

function Stars({ value, onChange, size = 15 }) {
  return (
    <span className={`stars ${onChange ? 'editable' : ''}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`star ${n <= value ? 'on' : ''}`}
          onClick={onChange ? () => onChange(n === value ? 0 : n) : undefined}
          disabled={!onChange}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          title={onChange ? `${n}/5` : undefined}
        >
          <Icon name="star" size={size} />
        </button>
      ))}
    </span>
  )
}

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Supplier' },
  { key: 'contact', label: 'Contact', sortKey: 'contact_person' },
  { key: 'product', label: 'Product', sortKey: 'product_name' },
  { key: 'vat', label: 'VAT', sortKey: 'vat_inclusive' },
  { key: 'payment', label: 'Payment', sortKey: 'payment_method' },
  { key: 'shipping', label: 'Shipping', sortKey: 'shipping_method' },
  { key: 'lead', label: 'Lead', sortKey: 'lead_time_days' },
  { key: 'rating', label: 'Rating' },
  { key: 'status', label: 'Status', sortKey: 'active' },
]

export default function Suppliers() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)

  const [form, setForm] = useState(null) // null = closed; object = add/edit
  const [view, setView] = useState(null) // supplier row being viewed
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  // table controls
  const [search, setSearch] = useState('')
  const [fVat, setFVat] = useState('all')
  const [fPay, setFPay] = useState('all')
  const [fShip, setFShip] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // import
  const fileRef = useRef(null)
  const [importPreview, setImportPreview] = useState(null) // { rows, skipped }
  const [importMsg, setImportMsg] = useState(null)

  async function load() {
    setLoading(true)
    setLoadErr(null)
    try {
      setRows(await listSuppliers())
    } catch (e) {
      setLoadErr(e.message || 'Could not load suppliers.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const payOptions = useMemo(
    () => [...new Set(rows.map((r) => r.payment_method).filter(Boolean))].sort(),
    [rows],
  )
  const shipOptions = useMemo(
    () => [...new Set(rows.map((r) => r.shipping_method).filter(Boolean))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter((r) => {
      if (q) {
        const hay = `${r.code} ${r.name} ${r.product_name} ${r.contact_person}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (fVat !== 'all') {
        const want = fVat === 'yes'
        if (r.vat_inclusive !== want) return false
      }
      if (fPay !== 'all' && r.payment_method !== fPay) return false
      if (fShip !== 'all' && r.shipping_method !== fShip) return false
      if (fStatus !== 'all') {
        const active = r.active !== false
        if (fStatus === 'active' ? !active : active) return false
      }
      return true
    })
    const { key, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      const av = a[key] ?? ''
      const bv = b[key] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mul
    })
    return list
  }, [rows, search, fVat, fPay, fShip, fStatus, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageClamped = Math.min(page, totalPages)
  const pageRows = filtered.slice((pageClamped - 1) * pageSize, pageClamped * pageSize)

  // Reset to page 1 when filters/search change.
  useEffect(() => {
    setPage(1)
  }, [search, fVat, fPay, fShip, fStatus, pageSize])

  function toggleSort(col) {
    const key = col.sortKey || col.key
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormErr('Supplier name is required.')
      return
    }
    setBusy(true)
    setFormErr(null)
    try {
      if (form.id) await updateSupplier(form.id, form)
      else await createSupplier(form)
      await load()
      setForm(null)
    } catch (e) {
      setFormErr(e.message || 'Could not save the supplier.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await deleteSupplier(id)
      setConfirmId(null)
      if (view?.id === id) setView(null)
      await load()
    } catch (e) {
      setLoadErr(e.message || 'Could not delete the supplier.')
    }
  }

  async function toggleActive(r) {
    try {
      await setSupplierActive(r.id, r.active === false)
      await load()
    } catch (e) {
      setLoadErr(e.message || 'Could not update the supplier.')
    }
  }

  function duplicate(r) {
    const f = fromRow(r)
    setForm({ ...f, id: null, name: `${f.name} (copy)` })
    setFormErr(null)
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportMsg(null)
    try {
      const parsed = await parseSupplierFile(file)
      if (parsed.rows.length === 0) {
        setImportMsg({ err: true, text: 'No supplier rows found in that file.' })
        return
      }
      setImportPreview(parsed)
    } catch (err) {
      setImportMsg({ err: true, text: err.message || 'Could not read that file.' })
    }
  }

  async function runImport() {
    if (!importPreview) return
    setBusy(true)
    try {
      const n = await importSuppliers(importPreview.rows)
      setImportPreview(null)
      setImportMsg({ text: `Imported ${n} supplier${n === 1 ? '' : 's'}.` })
      await load()
    } catch (e) {
      setImportMsg({ err: true, text: e.message || 'Import failed.' })
    } finally {
      setBusy(false)
    }
  }

  const vatLabel = (v) => (v == null ? '—' : v ? 'Yes' : 'No')

  return (
    <section className="suppliers">
      <div className="sup-head">
        <h3>
          <Icon name="truck" size={18} /> Suppliers
          <span className="sup-total">{filtered.length}</span>
        </h3>
        <div className="sup-head-actions">
          <button className="btn small" onClick={() => exportSuppliers(filtered)} disabled={rows.length === 0}>
            <Icon name="download" size={15} /> Export
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={15} /> Import
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onPickFile} />
          <button className="btn primary small" onClick={() => { setForm({ ...emptyForm }); setFormErr(null) }}>
            <Icon name="plus" size={15} /> Add supplier
          </button>
        </div>
      </div>

      {/* import preview / message */}
      {importPreview && (
        <div className="sup-import">
          <span>
            Ready to import <strong>{importPreview.rows.length}</strong> supplier
            {importPreview.rows.length === 1 ? '' : 's'}
            {importPreview.skipped > 0 && ` · ${importPreview.skipped} skipped (no name)`}.
          </span>
          <div>
            <button className="btn ghost small" onClick={() => setImportPreview(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary small" onClick={runImport} disabled={busy}>
              {busy ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      )}
      {importMsg && (
        <p className={importMsg.err ? 'create-error' : 'bc-note ok'}>
          {importMsg.text}{' '}
          <button className="linklike" onClick={() => downloadSupplierTemplate()}>
            Download template
          </button>
        </p>
      )}

      {/* toolbar: search + filters */}
      <div className="sup-toolbar">
        <div className="sup-search">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, product, code…"
          />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={fVat} onChange={(e) => setFVat(e.target.value)}>
          <option value="all">VAT: all</option>
          <option value="yes">VAT: Yes</option>
          <option value="no">VAT: No</option>
        </select>
        {payOptions.length > 0 && (
          <select value={fPay} onChange={(e) => setFPay(e.target.value)}>
            <option value="all">All payment</option>
            {payOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        {shipOptions.length > 0 && (
          <select value={fShip} onChange={(e) => setFShip(e.target.value)}>
            <option value="all">All shipping</option>
            {shipOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {loadErr && <p className="create-error">{loadErr}</p>}

      {/* table */}
      {loading ? (
        <p className="chart-empty">Loading suppliers…</p>
      ) : filtered.length === 0 ? (
        <p className="chart-empty">
          {rows.length === 0 ? 'No suppliers yet. Add your first one.' : 'No suppliers match your filters.'}
        </p>
      ) : (
        <>
          <div className="sup-table-wrap">
            <table className="sup-table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => {
                    const key = c.sortKey || c.key
                    const on = sort.key === key
                    return (
                      <th key={c.key} onClick={() => toggleSort(c)} className={on ? 'sorted' : ''}>
                        {c.label}
                        {on && <span className="sup-sort">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                      </th>
                    )
                  })}
                  <th className="sup-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className={r.active === false ? 'inactive' : ''}>
                    <td className="sup-code">{r.code}</td>
                    <td>
                      <button className="linklike sup-name" onClick={() => setView(r)}>
                        {r.name}
                      </button>
                    </td>
                    <td>
                      <div>{r.contact_person || '—'}</div>
                      {r.contact_number && <div className="sup-sub">{r.contact_number}</div>}
                    </td>
                    <td>
                      <div>{r.product_name || '—'}</div>
                      {r.size_specs && <div className="sup-sub">{r.size_specs}</div>}
                    </td>
                    <td>{vatLabel(r.vat_inclusive)}</td>
                    <td>{r.payment_method || '—'}</td>
                    <td>{r.shipping_method || '—'}</td>
                    <td>{r.lead_time_days != null ? `${r.lead_time_days}d` : '—'}</td>
                    <td>{r.rating ? <Stars value={r.rating} /> : <span className="sup-sub">—</span>}</td>
                    <td>
                      <button
                        className={`sup-badge ${r.active === false ? 'off' : 'on'}`}
                        onClick={() => toggleActive(r)}
                        title="Toggle active / inactive"
                      >
                        {r.active === false ? 'Inactive' : 'Active'}
                      </button>
                    </td>
                    <td className="sup-actions-col">
                      <div className="sup-row-actions">
                        <button onClick={() => setView(r)} title="View details">
                          <Icon name="search" size={15} />
                        </button>
                        <button onClick={() => { setForm(fromRow(r)); setFormErr(null) }} title="Edit">
                          <Icon name="edit" size={15} />
                        </button>
                        <button onClick={() => duplicate(r)} title="Duplicate">
                          <Icon name="copy" size={15} />
                        </button>
                        {confirmId === r.id ? (
                          <>
                            <button className="danger" onClick={() => remove(r.id)}>Delete</button>
                            <button onClick={() => setConfirmId(null)}>Keep</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmId(r.id)} title="Delete">
                            <Icon name="trash" size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="sup-pager">
            <div className="sup-pagesize">
              Rows:
              {PAGE_SIZES.map((n) => (
                <button
                  key={n}
                  className={pageSize === n ? 'on' : ''}
                  onClick={() => setPageSize(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="sup-pagenav">
              <button disabled={pageClamped <= 1} onClick={() => setPage(pageClamped - 1)}>
                ‹ Prev
              </button>
              <span>
                Page {pageClamped} of {totalPages}
              </span>
              <button disabled={pageClamped >= totalPages} onClick={() => setPage(pageClamped + 1)}>
                Next ›
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---------- add / edit modal ---------- */}
      {form && (
        <div className="sup-modal" onClick={() => !busy && setForm(null)}>
          <form className="sup-modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="sup-modal-head">
              <h3>{form.id ? 'Edit supplier' : 'New supplier'}</h3>
              <button type="button" className="sup-modal-x" onClick={() => setForm(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="sup-form-grid">
              <label className="field">
                <span>Supplier name *</span>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} autoFocus required />
              </label>
              <label className="field">
                <span>Contact person</span>
                <input value={form.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} />
              </label>
              <label className="field">
                <span>Contact number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.contactNumber}
                  onChange={(e) => setField('contactNumber', e.target.value)}
                  placeholder="0917 123 4567"
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
              </label>
              <label className="field sup-col-2">
                <span>Address</span>
                <input value={form.address} onChange={(e) => setField('address', e.target.value)} />
              </label>
              <label className="field sup-col-2">
                <span>Website / social page</span>
                <input value={form.website} onChange={(e) => setField('website', e.target.value)} />
              </label>

              <label className="field">
                <span>Product name</span>
                <input value={form.productName} onChange={(e) => setField('productName', e.target.value)} />
              </label>
              <label className="field">
                <span>Size / specs</span>
                <input value={form.sizeSpecs} onChange={(e) => setField('sizeSpecs', e.target.value)} />
              </label>
              <label className="field">
                <span>Size per piece</span>
                <input value={form.sizePerPiece} onChange={(e) => setField('sizePerPiece', e.target.value)} />
              </label>
              <label className="field">
                <span>Qty per pack</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.qtyPerPack}
                  onChange={(e) => setField('qtyPerPack', e.target.value)}
                />
              </label>

              <label className="field">
                <span>VAT inclusive</span>
                <select value={form.vatInclusive} onChange={(e) => setField('vatInclusive', e.target.value)}>
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </label>
              <label className="field">
                <span>Payment method</span>
                <input
                  list="sup-payments"
                  value={form.paymentMethod}
                  onChange={(e) => setField('paymentMethod', e.target.value)}
                />
                <datalist id="sup-payments">
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>Shipping method</span>
                <input
                  list="sup-shipping"
                  value={form.shippingMethod}
                  onChange={(e) => setField('shippingMethod', e.target.value)}
                />
                <datalist id="sup-shipping">
                  {SHIPPING_METHODS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>Lead time (days)</span>
                <input
                  type="number"
                  min="0"
                  value={form.leadTimeDays}
                  onChange={(e) => setField('leadTimeDays', e.target.value)}
                />
              </label>

              <div className="field">
                <span>Reliability rating</span>
                <Stars value={form.rating} onChange={(n) => setField('rating', n)} size={22} />
              </div>
              <label className="field sup-status-field">
                <span>Status</span>
                <label className="sup-switch">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setField('active', e.target.checked)}
                  />
                  <span>{form.active ? 'Active' : 'Inactive'}</span>
                </label>
              </label>

              <label className="field sup-col-2">
                <span>Remarks</span>
                <textarea
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => setField('remarks', e.target.value)}
                  placeholder="Notes on reliability, terms, minimums…"
                />
              </label>
            </div>

            {formErr && <p className="create-error">{formErr}</p>}

            <div className="sup-modal-actions">
              <button type="button" className="btn ghost" onClick={() => setForm(null)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={busy || !form.name.trim()}>
                {busy ? 'Saving…' : form.id ? 'Save changes' : 'Add supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- view details modal ---------- */}
      {view && (
        <div className="sup-modal" onClick={() => setView(null)}>
          <div className="sup-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sup-modal-head">
              <h3>
                {view.name}{' '}
                <span className="sup-code-chip">{view.code}</span>
              </h3>
              <button type="button" className="sup-modal-x" onClick={() => setView(null)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="sup-view-grid">
              {[
                ['Contact person', view.contact_person],
                ['Contact number', view.contact_number],
                ['Email', view.email],
                ['Address', view.address],
                ['Website', view.website],
                ['Product', view.product_name],
                ['Size / specs', view.size_specs],
                ['Size per piece', view.size_per_piece],
                ['Qty per pack', view.qty_per_pack],
                ['VAT inclusive', vatLabel(view.vat_inclusive)],
                ['Payment method', view.payment_method],
                ['Shipping method', view.shipping_method],
                ['Lead time', view.lead_time_days != null ? `${view.lead_time_days} days` : null],
              ].map(([label, val]) => (
                <div className="sup-view-item" key={label}>
                  <span className="sup-view-label">{label}</span>
                  <span className="sup-view-val">{val || '—'}</span>
                </div>
              ))}
              <div className="sup-view-item">
                <span className="sup-view-label">Rating</span>
                <span className="sup-view-val">{view.rating ? <Stars value={view.rating} /> : '—'}</span>
              </div>
              <div className="sup-view-item">
                <span className="sup-view-label">Status</span>
                <span className={`sup-badge ${view.active === false ? 'off' : 'on'}`}>
                  {view.active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
            </div>
            {view.remarks && (
              <div className="sup-view-remarks">
                <span className="sup-view-label">Remarks</span>
                <p>{view.remarks}</p>
              </div>
            )}
            <div className="sup-modal-actions">
              <button className="btn ghost" onClick={() => { setForm(fromRow(view)); setView(null) }}>
                <Icon name="edit" size={15} /> Edit
              </button>
              <button className="btn" onClick={() => setView(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
