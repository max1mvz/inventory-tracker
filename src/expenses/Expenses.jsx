import { useEffect, useMemo, useState } from 'react'
import {
  listExpenses,
  createExpense,
  deleteExpense,
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

export default function Expenses() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  // Entry form
  const [expenseDate, setExpenseDate] = useState(today())
  const [vendor, setVendor] = useState('')
  const [tin, setTin] = useState('')
  const [netAmount, setNetAmount] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState(null)

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
  }, [])

  const valid = Boolean(expenseDate) && Number(totalAmount) > 0

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setFormErr(null)
    try {
      await createExpense({
        expenseDate,
        vendor,
        tin,
        netAmount,
        vatAmount,
        totalAmount,
        category,
        note,
      })
      // Keep date + category for fast batch entry; clear the rest.
      setVendor('')
      setTin('')
      setNetAmount('')
      setVatAmount('')
      setTotalAmount('')
      setNote('')
      await load()
    } catch (e) {
      setFormErr(e.message || 'Could not save — check your connection.')
    } finally {
      setBusy(false)
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

  // This-month rollup for the summary strip.
  const summary = useMemo(() => {
    const ym = today().slice(0, 7) // local YYYY-MM
    const monthRows = rows.filter((r) => (r.expense_date || '').slice(0, 7) === ym)
    const total = monthRows.reduce((s, r) => s + Number(r.total_amount || 0), 0)
    const vat = monthRows.reduce((s, r) => s + Number(r.vat_amount || 0), 0)
    const byCat = {}
    for (const r of monthRows) {
      const c = r.category || 'Uncategorized'
      byCat[c] = (byCat[c] || 0) + Number(r.total_amount || 0)
    }
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    return { count: monthRows.length, total, vat, cats }
  }, [rows])

  const monthLabel = new Date().toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
  const fmtDate = (d) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <div className="expenses">
      {/* This month summary */}
      <section className="exp-summary">
        <div className="exp-sum-main">
          <span className="exp-sum-label">{monthLabel} · total</span>
          <span className="exp-sum-total">{pesoExact(summary.total)}</span>
          <span className="exp-sum-sub">
            {summary.count} {summary.count === 1 ? 'expense' : 'expenses'}
            {summary.vat > 0 && <> · {pesoExact(summary.vat)} VAT</>}
          </span>
        </div>
        {summary.cats.length > 0 && (
          <ul className="exp-sum-cats">
            {summary.cats.slice(0, 4).map(([c, amt]) => (
              <li key={c}>
                <span className="exp-cat-name">{c}</span>
                <span className="exp-cat-amt">{pesoExact(amt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add expense */}
      <form className="exp-form" onSubmit={submit}>
        <h3>Record an expense</h3>
        <div className="exp-grid">
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
          <label className="exp-field">
            <span>TIN</span>
            <input
              type="text"
              inputMode="numeric"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              placeholder="000-000-000-000"
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
          <button className="btn primary" type="submit" disabled={busy || !valid}>
            {busy ? 'Saving…' : 'Add expense'}
          </button>
        </div>
      </form>

      {/* Ledger */}
      <section className="exp-list">
        <div className="exp-list-head">
          <h3>Recent expenses</h3>
          {rows.length > 0 && <span className="exp-count">{rows.length} total</span>}
        </div>

        {loadErr && <p className="exp-error">{loadErr}</p>}
        {loading ? (
          <p className="exp-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="exp-empty">No expenses recorded yet. Add your first one above.</p>
        ) : (
          <ul className="exp-items">
            {rows.map((r) => (
              <li key={r.id} className="exp-item">
                <div className="exp-item-main">
                  <div className="exp-item-top">
                    <span className="exp-item-vendor">{r.vendor || 'Expense'}</span>
                    {r.category && <span className="exp-item-cat">{r.category}</span>}
                  </div>
                  <div className="exp-item-meta">
                    {fmtDate(r.expense_date)}
                    {r.tin && <> · TIN {r.tin}</>}
                    {Number(r.vat_amount) > 0 && <> · VAT {pesoExact(r.vat_amount)}</>}
                  </div>
                  {r.note && <div className="exp-item-note">{r.note}</div>}
                </div>
                <div className="exp-item-side">
                  <span className="exp-item-amt">{pesoExact(r.total_amount)}</span>
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
                    <button
                      className="exp-del"
                      type="button"
                      onClick={() => setConfirmId(r.id)}
                      aria-label="Delete expense"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
