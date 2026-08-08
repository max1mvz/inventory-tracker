import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadReceiptImage,
  getReceiptUrl,
  EXPENSE_CATEGORIES,
} from '../data/expenses'
import { pesoExact } from '../format'
import Icon from '../ui/Icon.jsx'
import './expenses.css'

// Local calendar date as YYYY-MM-DD (not UTC — avoids rolling back a day in
// PH's UTC+8 early hours).
const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// Strip to digits (max 14 = 9-digit base TIN + up to a 5-digit branch code) and
// group with dashes: the base is split into 3s and the branch is one trailing
// group — "1234567890000" → "123-456-789-0000".
const formatTin = (raw) => {
  const d = String(raw).replace(/\D/g, '').slice(0, 14)
  const base = d.slice(0, 9).replace(/(\d{3})(?=\d)/g, '$1-')
  const branch = d.slice(9) // up to 5 digits
  return branch ? `${base}-${branch}` : base
}

// The 9-digit base of a TIN identifies the vendor (the branch code is per-branch).
const tinBase = (t) => String(t ?? '').replace(/\D/g, '').slice(0, 9)

const monthLabel = (ym) =>
  new Date(ym + '-01T00:00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

const fmtDate = (d) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

export default function Expenses() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [collapsed, setCollapsed] = useState(() => new Set()) // month keys hidden

  const toggleGroup = (ym) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(ym) ? next.delete(ym) : next.add(ym)
      return next
    })

  // Entry form
  const [expenseDate, setExpenseDate] = useState(today())
  const [vendor, setVendor] = useState('')
  const [tin, setTin] = useState('')
  const [tinNotice, setTinNotice] = useState(false)
  const [address, setAddress] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [barangay, setBarangay] = useState('')
  const [netAmount, setNetAmount] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  // Edit mode: null = adding a new expense; otherwise the id being edited.
  const [editingId, setEditingId] = useState(null)
  const [existingReceiptPath, setExistingReceiptPath] = useState(null) // the row's saved receipt
  const [receiptRemoved, setReceiptRemoved] = useState(false) // user cleared the saved receipt
  // TIN auto-search: undefined = idle/too short, null = searched with no match,
  // object = matched vendor pulled from a previous record.
  const [tinMatch, setTinMatch] = useState(undefined)
  const autoFilledRef = useRef(null) // snapshot of the last auto-filled fields, to tell auto vs. manual
  const tinTimer = useRef(null)
  const fileRef = useRef(null)
  const formRef = useRef(null)

  async function load() {
    setLoading(true)
    setLoadErr(null)
    try {
      setRows(await listExpenses())
    } catch (e) {
      setLoadErr(e.message || 'Could not load expenses.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    return () => clearTimeout(tinTimer.current)
  }, [])

  // TIN-first auto-search. Once a full 9-digit TIN base is typed on a NEW expense,
  // look it up among the records already loaded (no extra database read) and
  // auto-fill the vendor + location from the most recent match. No match → the
  // user simply carries on and creates a new record for that TIN. Skipped while
  // editing an existing expense, so it never overwrites what's being edited.
  useEffect(() => {
    if (editingId) {
      setTinMatch(undefined)
      return
    }
    const base = tinBase(tin)
    if (base.length < 9) {
      setTinMatch(undefined)
      return
    }
    const timer = setTimeout(() => {
      // Only auto-modify the vendor/location fields when they haven't been touched
      // by hand: either they still hold exactly what we last auto-filled, or (if
      // we've never auto-filled) they're all still empty. This lets us refresh /
      // clear stale auto-fill when the TIN changes without ever losing a manual edit.
      const snap = autoFilledRef.current
      const canAutoFill = snap
        ? vendor === snap.vendor &&
          address === snap.address &&
          municipality === snap.municipality &&
          barangay === snap.barangay
        : !vendor && !address && !municipality && !barangay

      const matches = rows.filter((r) => tinBase(r.tin) === base)
      const best = matches.find((r) => r.vendor || r.address || r.municipality || r.barangay) || matches[0]

      if (best) {
        const filled = {
          vendor: best.vendor || '',
          address: best.address || '',
          municipality: best.municipality || '',
          barangay: best.barangay || '',
        }
        setTinMatch(filled)
        if (canAutoFill) {
          setVendor(filled.vendor)
          setAddress(filled.address)
          setMunicipality(filled.municipality)
          setBarangay(filled.barangay)
          autoFilledRef.current = filled
        }
      } else {
        setTinMatch(null)
        // No record for this TIN — wipe any stale auto-fill from a previous match.
        if (canAutoFill && snap) {
          setVendor('')
          setAddress('')
          setMunicipality('')
          setBarangay('')
          autoFilledRef.current = null
        }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [tin, rows, editingId, vendor, address, municipality, barangay])

  // TIN is numbers only — strip anything else, auto-insert dashes, and flash a
  // brief "numbers only" notice if the user typed a disallowed character.
  function onTinChange(e) {
    const raw = e.target.value
    const typedDisallowed = /[^\d-]/.test(raw)
    setTin(formatTin(raw))
    if (typedDisallowed) {
      setTinNotice(true)
      clearTimeout(tinTimer.current)
      tinTimer.current = setTimeout(() => setTinNotice(false), 1600)
    }
  }

  // Attach a receipt photo — held locally, uploaded to the private bucket on save.
  function onReceiptPick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again
    if (!file) return
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  function clearReceipt() {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview)
    setReceiptFile(null)
    setReceiptPreview(null)
  }

  // Remove the receipt already saved on the expense being edited (takes effect on save).
  function removeExistingReceipt() {
    clearReceipt()
    setReceiptRemoved(true)
  }

  // Reset the form back to "add a new expense" mode.
  function resetForm() {
    setEditingId(null)
    setExpenseDate(today())
    setVendor('')
    setTin('')
    setNetAmount('')
    setVatAmount('')
    setTotalAmount('')
    setCategory('')
    setNote('')
    setAddress('')
    setMunicipality('')
    setBarangay('')
    clearReceipt()
    setExistingReceiptPath(null)
    setReceiptRemoved(false)
    setTinMatch(undefined)
    autoFilledRef.current = null
    setFormErr(null)
  }

  // Load an existing expense into the form for editing.
  function startEdit(r) {
    setEditingId(r.id)
    setExpenseDate(r.expense_date || today())
    setVendor(r.vendor || '')
    setTin(r.tin || '')
    setNetAmount(r.net_amount ?? '')
    setVatAmount(r.vat_amount ?? '')
    setTotalAmount(r.total_amount ?? '')
    setCategory(r.category || '')
    setNote(r.note || '')
    setAddress(r.address || '')
    setMunicipality(r.municipality || '')
    setBarangay(r.barangay || '')
    clearReceipt()
    setExistingReceiptPath(r.receipt_path || null)
    setReceiptRemoved(false)
    setConfirmId(null)
    setFormErr(null)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const valid = Boolean(expenseDate) && Number(totalAmount) > 0 && tin.trim().length > 0

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setFormErr(null)
    try {
      // Resolve the receipt path: a newly picked file uploads; otherwise keep the
      // existing one (edit) unless the user removed it, or none (new expense).
      let receiptPath
      if (receiptFile) receiptPath = await uploadReceiptImage(receiptFile)
      else if (editingId) receiptPath = receiptRemoved ? null : existingReceiptPath
      else receiptPath = null

      const fields = {
        expenseDate, vendor, tin, netAmount, vatAmount, totalAmount, category, note,
        address, municipality, barangay, receiptPath,
      }
      if (editingId) await updateExpense(editingId, fields)
      else await createExpense(fields)

      resetForm()
      await load()
    } catch (e) {
      setFormErr(e.message || 'Could not save — check your connection.')
    } finally {
      setBusy(false)
    }
  }

  // Open a receipt image in a new tab via a short-lived signed URL.
  async function viewReceipt(path) {
    try {
      const url = await getReceiptUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setLoadErr(e.message || 'Could not open the receipt.')
    }
  }

  async function remove(id) {
    try {
      await deleteExpense(id)
      setConfirmId(null)
      await load()
    } catch (e) {
      setLoadErr(e.message || 'Could not delete.')
    }
  }

  // Grand totals across everything (VAT is the headline figure).
  const grand = useMemo(
    () => ({
      count: rows.length,
      total: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
      vat: rows.reduce((s, r) => s + Number(r.vat_amount || 0), 0),
    }),
    [rows],
  )

  // Group by month/year, newest first, with each month's spend + VAT subtotal.
  const groups = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const ym = (r.expense_date || '').slice(0, 7)
      if (!map.has(ym)) map.set(ym, { ym, rows: [], total: 0, vat: 0 })
      const g = map.get(ym)
      g.rows.push(r)
      g.total += Number(r.total_amount || 0)
      g.vat += Number(r.vat_amount || 0)
    }
    return [...map.values()].sort((a, b) => b.ym.localeCompare(a.ym))
  }, [rows])

  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })

  // Print a clean, self-contained report in a hidden iframe. This does NOT print
  // the app window (whose height:100% / flex / sticky layout the browser's print
  // engine clips to a blank page) — the iframe has its own minimal document, so
  // the output is reliable regardless of the app's CSS.
  function printReport() {
    const esc = (s) =>
      String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    const groupsHtml = groups
      .map(
        (g) => `
      <section class="grp">
        <div class="grp-head">
          <span>${esc(monthLabel(g.ym))}</span>
          <span>VAT ${esc(pesoExact(g.vat))} &nbsp;·&nbsp; Total ${esc(pesoExact(g.total))}</span>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Vendor</th><th>TIN</th><th>Category</th><th class="r">VAT</th><th class="r">Total</th></tr>
          </thead>
          <tbody>
            ${g.rows
              .map(
                (r) => `<tr>
              <td>${esc(fmtDate(r.expense_date))}</td>
              <td>${esc(r.vendor || '')}</td>
              <td>${esc(r.tin || '')}</td>
              <td>${esc(r.category || '')}</td>
              <td class="r">${esc(pesoExact(r.vat_amount || 0))}</td>
              <td class="r">${esc(pesoExact(r.total_amount))}</td>
            </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </section>`,
      )
      .join('')

    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Expense & VAT Report</title>
    <style>
      * { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #000; box-sizing: border-box; }
      @page { margin: 14mm; }
      body { margin: 0; }
      h1 { font-size: 20px; margin: 0 0 2px; }
      .sub { font-size: 12px; color: #333; margin: 0 0 10px; }
      .total { font-size: 24px; font-weight: 700; margin: 4px 0 20px; }
      .grp { margin-bottom: 20px; }
      .grp-head { display: flex; justify-content: space-between; align-items: baseline;
        font-weight: 700; font-size: 13px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; border-bottom: 1px solid #000; padding: 5px 6px; font-size: 10px;
        text-transform: uppercase; letter-spacing: 0.04em; }
      td { padding: 5px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
      .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      tr { break-inside: avoid; }
    </style></head>
    <body>
      <h1>Expense &amp; VAT Report</h1>
      <p class="sub">${esc(String(grand.count))} expenses · Generated ${esc(generatedAt)}</p>
      <div class="total">Total VAT collected: ${esc(pesoExact(grand.vat))}</div>
      ${groupsHtml}
    </body></html>`

    const iframe = document.createElement('iframe')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
    })
    document.body.appendChild(iframe)
    const idoc = iframe.contentWindow.document
    idoc.open()
    idoc.write(doc)
    idoc.close()
    const cleanup = () => setTimeout(() => iframe.remove(), 1000)
    iframe.contentWindow.onafterprint = cleanup
    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      cleanup()
    }, 300)
  }

  return (
    <div className="expenses">
      {/* Total VAT headline */}
      <section className="exp-summary">
        <div className="exp-sum-icon">
          <Icon name="receipt" size={30} />
        </div>
        <div className="exp-sum-main">
          <span className="exp-sum-label">Total VAT collected — all records</span>
          <span className="exp-sum-total">{pesoExact(grand.vat)}</span>
          <span className="exp-sum-sub">
            from {grand.count} {grand.count === 1 ? 'expense' : 'expenses'} · {pesoExact(grand.total)} total spend
          </span>
        </div>
      </section>

      {/* Add / edit expense */}
      <form className="exp-form" onSubmit={submit} ref={formRef}>
        <h3>
          {editingId ? 'Edit expense' : 'Record an expense'}
          {editingId && <span className="exp-editing-tag">Editing</span>}
        </h3>

        <div className="exp-scan">
          {receiptPreview ? (
            <div className="exp-receipt-preview">
              <img src={receiptPreview} alt="Receipt" />
              <div className="exp-receipt-actions">
                <span className="exp-scan-note ok">Receipt attached — saves with this expense.</span>
                <div>
                  <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()} disabled={busy}>
                    Replace
                  </button>
                  <button type="button" className="btn ghost small" onClick={clearReceipt} disabled={busy}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : editingId && existingReceiptPath && !receiptRemoved ? (
            <div className="exp-receipt-actions">
              <span className="exp-scan-note ok">Receipt attached to this expense.</span>
              <div>
                <button type="button" className="btn ghost small" onClick={() => viewReceipt(existingReceiptPath)} disabled={busy}>
                  View
                </button>
                <button type="button" className="btn ghost small" onClick={() => fileRef.current?.click()} disabled={busy}>
                  Replace
                </button>
                <button type="button" className="btn ghost small" onClick={removeExistingReceipt} disabled={busy}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn exp-scan-btn"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <Icon name="scan" size={16} />
                Add receipt photo
              </button>
              <span className="exp-scan-note">Optional — take or pick a photo of the receipt.</span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onReceiptPick}
          />
        </div>

        <div className="exp-grid">
          <label className="exp-field exp-field-wide">
            <span>TIN *</span>
            <input
              type="text"
              inputMode="numeric"
              value={tin}
              onChange={onTinChange}
              placeholder="000-000-000-00000 — enter first to auto-fill a known vendor"
              maxLength={17}
              autoFocus
              required
              aria-describedby="tin-hint"
            />
            <small id="tin-hint" className={`exp-hint ${tinNotice ? 'warn' : ''}`} aria-live="polite">
              {tinNotice ? 'Numbers only' : 'Digits only — dashes added automatically'}
            </small>
            {!editingId &&
              tinMatch !== undefined &&
              (tinMatch ? (
                <small className="exp-tin-match found" aria-live="polite">
                  <Icon name="search" size={12} /> Found{' '}
                  {tinMatch.vendor ? `“${tinMatch.vendor}”` : 'a previous record'} — vendor details
                  filled in.
                </small>
              ) : (
                <small className="exp-tin-match new" aria-live="polite">
                  New TIN — no earlier record. Fill in the details to add it.
                </small>
              ))}
          </label>
          <label className="exp-field">
            <span>Date *</span>
            <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
          </label>
          <label className="exp-field">
            <span>Category</span>
            <input
              type="text"
              list="expense-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Utilities"
            />
            <datalist id="expense-categories">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="exp-field">
            <span>Vendor / supplier</span>
            <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Business name" />
          </label>
          <label className="exp-field exp-field-wide">
            <span>Address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street / building"
            />
          </label>
          <label className="exp-field">
            <span>Municipality / City</span>
            <input
              type="text"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder="e.g. Quezon City"
            />
          </label>
          <label className="exp-field">
            <span>Barangay</span>
            <input
              type="text"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              placeholder="e.g. Barangay 123"
            />
          </label>
          <label className="exp-field">
            <span>Net (₱)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={netAmount}
              onChange={(e) => setNetAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="exp-field">
            <span>VAT (₱)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={vatAmount}
              onChange={(e) => setVatAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="exp-field">
            <span>Total (₱) *</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>
          <label className="exp-field exp-field-wide">
            <span>Note</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <div className="exp-form-foot">
          {formErr && <p className="exp-error">{formErr}</p>}
          {editingId && (
            <button className="btn ghost" type="button" onClick={resetForm} disabled={busy}>
              Cancel
            </button>
          )}
          <button className="btn primary" type="submit" disabled={busy || !valid}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>

      {/* Printable report region: header + grouped ledger */}
      <div className="exp-report">
        <div className="exp-print-head">
          <h1>Expense &amp; VAT Report</h1>
          <p>
            {grand.count} expenses · Total VAT {pesoExact(grand.vat)} · Total spend {pesoExact(grand.total)}
            <br />
            Generated {generatedAt}
          </p>
        </div>
        <section className="exp-list">
        <div className="exp-list-head">
          <h3>Expenses by month</h3>
          {rows.length > 0 && (
            <button className="btn ghost small exp-print-btn" type="button" onClick={printReport}>
              <Icon name="download" size={15} />
              Print report
            </button>
          )}
        </div>

        {loadErr && <p className="exp-error">{loadErr}</p>}
        {loading ? (
          <p className="exp-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="exp-empty">No expenses recorded yet. Add your first one above.</p>
        ) : (
          groups.map((g) => {
            const isCollapsed = collapsed.has(g.ym)
            return (
            <div className="exp-group" key={g.ym}>
              <button
                className={`exp-group-head ${isCollapsed ? 'collapsed' : ''}`}
                type="button"
                onClick={() => toggleGroup(g.ym)}
                aria-expanded={!isCollapsed}
              >
                <span className="exp-group-left">
                  <Icon name="chevron-down" size={16} className="exp-chevron" />
                  <span className="exp-group-month">{monthLabel(g.ym)}</span>
                  <span className="exp-group-count">{g.rows.length}</span>
                </span>
                <span className="exp-group-totals">
                  <span className="exp-group-vat">{pesoExact(g.vat)} VAT</span>
                  <span className="exp-group-total">{pesoExact(g.total)} total</span>
                </span>
              </button>
              <ul className={`exp-items ${isCollapsed ? 'hidden' : ''}`}>
                {g.rows.map((r) => (
                  <li key={r.id} className="exp-item">
                    <div className="exp-item-main">
                      <div className="exp-item-top">
                        <span className="exp-item-vendor">{r.vendor || 'Expense'}</span>
                        {r.category && <span className="exp-item-cat">{r.category}</span>}
                      </div>
                      <div className="exp-item-meta">
                        {fmtDate(r.expense_date)}
                        {r.tin && <> · TIN {r.tin}</>}
                      </div>
                      {(r.address || r.barangay || r.municipality) && (
                        <div className="exp-item-loc">
                          {[r.address, r.barangay, r.municipality].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {r.note && <div className="exp-item-note">{r.note}</div>}
                      {r.receipt_path && (
                        <button
                          type="button"
                          className="exp-receipt-link"
                          onClick={() => viewReceipt(r.receipt_path)}
                        >
                          <Icon name="receipt" size={13} /> View receipt
                        </button>
                      )}
                    </div>
                    <div className="exp-item-side">
                      <div className="exp-item-amounts">
                        <span className="exp-item-vat">
                          <small>VAT</small> {pesoExact(r.vat_amount || 0)}
                        </span>
                        <span className="exp-item-total">of {pesoExact(r.total_amount)}</span>
                      </div>
                      {confirmId === r.id ? (
                        <div className="exp-confirm">
                          <button className="btn danger small" type="button" onClick={() => remove(r.id)}>
                            Delete
                          </button>
                          <button className="btn ghost small" type="button" onClick={() => setConfirmId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="exp-row-actions">
                          <button
                            className={`exp-edit ${editingId === r.id ? 'on' : ''}`}
                            type="button"
                            onClick={() => startEdit(r)}
                            aria-label="Edit expense"
                            title="Edit"
                          >
                            <Icon name="edit" size={15} />
                          </button>
                          <button
                            className="exp-del"
                            type="button"
                            onClick={() => setConfirmId(r.id)}
                            aria-label="Delete expense"
                            title="Delete"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            )
          })
        )}
        </section>
      </div>
    </div>
  )
}
