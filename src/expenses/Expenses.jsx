import { useEffect, useMemo, useRef, useState } from 'react'
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

// Strip to digits (max 12 = 9-digit TIN + 3-digit branch) and group with dashes:
// "1234567890" → "123-456-789-0".
const formatTin = (raw) =>
  String(raw)
    .replace(/\D/g, '')
    .slice(0, 12)
    .replace(/(\d{3})(?=\d)/g, '$1-')

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
  const [netAmount, setNetAmount] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState(null)
  const tinTimer = useRef(null)

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

  const valid = Boolean(expenseDate) && Number(totalAmount) > 0

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setFormErr(null)
    try {
      await createExpense({ expenseDate, vendor, tin, netAmount, vatAmount, totalAmount, category, note })
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

  return (
    <div className="expenses">
      {/* Print-only report header */}
      <div className="exp-print-head">
        <h1>Expense &amp; VAT Report</h1>
        <p>
          {grand.count} expenses · Total VAT {pesoExact(grand.vat)} · Total spend {pesoExact(grand.total)}
          <br />
          Generated {generatedAt}
        </p>
      </div>

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
              onChange={onTinChange}
              placeholder="000-000-000-000"
              maxLength={15}
              aria-describedby="tin-hint"
            />
            <small id="tin-hint" className={`exp-hint ${tinNotice ? 'warn' : ''}`} aria-live="polite">
              {tinNotice ? 'Numbers only' : 'Digits only — dashes added automatically'}
            </small>
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

      {/* Ledger grouped by month */}
      <section className="exp-list">
        <div className="exp-list-head">
          <h3>Expenses by month</h3>
          {rows.length > 0 && (
            <button className="btn ghost small exp-print-btn" type="button" onClick={() => window.print()}>
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
                      {r.note && <div className="exp-item-note">{r.note}</div>}
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
            </div>
            )
          })
        )}
      </section>
    </div>
  )
}
