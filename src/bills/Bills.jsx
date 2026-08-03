import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listBills,
  createBill,
  updateBill,
  deleteBill,
  setBillActive,
  CARD_THEMES,
  BILL_ISSUERS,
} from '../data/bills'
import {
  nextDueDate,
  occurrenceThisMonth,
  daysUntil,
  ordinal,
  downloadIcs,
  googleCalendarUrl,
} from './calendar'
import { peso } from '../format'
import Icon from '../ui/Icon.jsx'
import './bills.css'

const fmtDate = (d) =>
  d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })

const monthName = (d = new Date()) =>
  d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

// A friendly "when is it due" chip for a bill's next occurrence.
function dueStatus(dueDay) {
  const next = nextDueDate(dueDay)
  const n = daysUntil(next)
  const label = n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : `Due in ${n} days`
  return { next, days: n, label, soon: n <= 5 }
}

const emptyForm = {
  id: null,
  name: '',
  issuer: '',
  accountRef: '',
  amount: '',
  dueDay: '15',
  theme: 'slate',
  note: '',
  active: true,
}

export default function Bills() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)

  const [form, setForm] = useState(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [calFor, setCalFor] = useState(null) // bill id whose calendar menu is open
  const formRef = useRef(null)

  async function load() {
    setLoading(true)
    setLoadErr(null)
    try {
      setRows(await listBills())
    } catch (e) {
      setLoadErr(e.message || 'Could not load bills.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function startNew() {
    setForm(emptyForm)
    setFormOpen(true)
    setFormErr(null)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function startEdit(b) {
    setForm({
      id: b.id,
      name: b.name || '',
      issuer: b.issuer || '',
      accountRef: b.account_ref || '',
      amount: b.amount ?? '',
      dueDay: String(b.due_day || 15),
      theme: b.theme || 'slate',
      note: b.note || '',
      active: b.active !== false,
    })
    setFormOpen(true)
    setFormErr(null)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormErr('Give the bill a name.')
      return
    }
    setBusy(true)
    setFormErr(null)
    try {
      if (form.id) await updateBill(form.id, form)
      else await createBill(form)
      await load()
      setForm(emptyForm)
      setFormOpen(false)
    } catch (e) {
      setFormErr(e.message || 'Could not save the bill.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await deleteBill(id)
      setConfirmId(null)
      await load()
    } catch (e) {
      setLoadErr(e.message || 'Could not delete the bill.')
    }
  }

  async function togglePause(b) {
    try {
      await setBillActive(b.id, !b.active)
      await load()
    } catch (e) {
      setLoadErr(e.message || 'Could not update the bill.')
    }
  }

  // Monthly summary: every active bill recurs monthly, so all are "due this
  // month". Split into still-upcoming vs already-passed for a useful counter.
  const summary = useMemo(() => {
    const active = rows.filter((b) => b.active !== false)
    const today = new Date()
    let upcoming = 0
    let total = 0
    for (const b of active) {
      total += Number(b.amount) || 0
      if (daysUntil(occurrenceThisMonth(b.due_day, today), today) >= 0) upcoming += 1
    }
    return { count: active.length, total, upcoming, passed: active.length - upcoming }
  }, [rows])

  // Show soonest-due first (active bills before paused ones).
  const ordered = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aActive = a.active !== false
      const bActive = b.active !== false
      if (aActive !== bActive) return aActive ? -1 : 1
      return nextDueDate(a.due_day) - nextDueDate(b.due_day)
    })
  }, [rows])

  return (
    <section className="bills">
      {/* ---------- monthly due counter ---------- */}
      <div className="bills-summary">
        <div className="bills-summary-main">
          <span className="bills-summary-month">
            <Icon name="calendar" size={16} /> {monthName()}
          </span>
          <span className="bills-summary-count">
            <strong>{summary.count}</strong> {summary.count === 1 ? 'bill' : 'bills'} due
          </span>
          {summary.total > 0 && (
            <span className="bills-summary-total">{peso(summary.total)} total</span>
          )}
        </div>
        <div className="bills-summary-sub">
          {summary.count === 0
            ? 'No bills yet — add your first reminder.'
            : `${summary.upcoming} still upcoming · ${summary.passed} already passed this month`}
        </div>
      </div>

      <div className="bills-head">
        <h3>
          <Icon name="bell" size={18} /> Billing reminders
        </h3>
        <button className="btn primary small" onClick={startNew}>
          <Icon name="plus" size={16} /> Add bill
        </button>
      </div>

      {/* ---------- add / edit form ---------- */}
      {formOpen && (
        <form className="bill-form panel" onSubmit={submit} ref={formRef}>
          <div className="bill-form-head">
            <span className="create-tag">{form.id ? 'Edit bill' : 'New bill'}</span>
          </div>

          <div className="bill-form-grid">
            <label className="field">
              <span>Name *</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. BPI Credit Card"
                autoFocus
                required
              />
            </label>

            <label className="field">
              <span>Type / issuer</span>
              <input
                type="text"
                list="bill-issuers"
                value={form.issuer}
                onChange={(e) => setField('issuer', e.target.value)}
                placeholder="e.g. Credit Card"
              />
              <datalist id="bill-issuers">
                {BILL_ISSUERS.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span>Account ref (optional)</span>
              <input
                type="text"
                value={form.accountRef}
                onChange={(e) => setField('accountRef', e.target.value)}
                placeholder="•••• 1234"
              />
            </label>

            <label className="field">
              <span>Amount due (optional)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                placeholder="0"
              />
            </label>

            <label className="field">
              <span>Due day of month *</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(e) => setField('dueDay', e.target.value)}
                required
              />
              <small className="field-hint">Repeats every month. 29–31 lands on a short month's last day.</small>
            </label>

            <label className="field">
              <span>Card colour</span>
              <div className="bill-themes">
                {CARD_THEMES.map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    className={`bill-swatch bill-theme-${t.key} ${form.theme === t.key ? 'on' : ''}`}
                    onClick={() => setField('theme', t.key)}
                    title={t.label}
                    aria-label={t.label}
                  />
                ))}
              </div>
            </label>
          </div>

          <label className="field">
            <span>Note (optional)</span>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
              placeholder="e.g. auto-debit from savings"
            />
          </label>

          {formErr && <p className="create-error">{formErr}</p>}

          <div className="bill-form-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setFormOpen(false)
                setForm(emptyForm)
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={busy || !form.name.trim()}>
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Add bill'}
            </button>
          </div>
        </form>
      )}

      {/* ---------- cards ---------- */}
      {loadErr && <p className="create-error">{loadErr}</p>}
      {loading ? (
        <p className="chart-empty">Loading bills…</p>
      ) : ordered.length === 0 ? (
        <p className="chart-empty">No bills yet. Add one to start getting due reminders.</p>
      ) : (
        <div className="bills-grid">
          {ordered.map((b) => {
            const st = dueStatus(b.due_day)
            const paused = b.active === false
            return (
              <div
                key={b.id}
                className={`bill-card bill-theme-${b.theme || 'slate'} ${paused ? 'paused' : ''} ${
                  st.soon && !paused ? 'due-soon' : ''
                }`}
              >
                <div className="bill-card-top">
                  <span className="bill-card-issuer">{b.issuer || 'Bill'}</span>
                  <Icon name="card" size={22} className="bill-card-chip" />
                </div>

                <div className="bill-card-name">{b.name}</div>
                {b.account_ref && <div className="bill-card-ref">{b.account_ref}</div>}

                <div className="bill-card-mid">
                  {b.amount != null && <span className="bill-card-amount">{peso(b.amount)}</span>}
                  <span className={`bill-card-due ${st.soon && !paused ? 'soon' : ''}`}>
                    {paused ? 'Paused' : st.label}
                  </span>
                </div>

                <div className="bill-card-foot">
                  <span className="bill-card-when">
                    Due the {ordinal(b.due_day)} · next {fmtDate(st.next)}
                  </span>
                </div>

                <div className="bill-card-actions">
                  <div className="bill-cal">
                    <button
                      className="bill-mini"
                      onClick={() => setCalFor(calFor === b.id ? null : b.id)}
                      title="Add to calendar"
                    >
                      <Icon name="calendar" size={15} /> Calendar
                    </button>
                    {calFor === b.id && (
                      <div className="bill-cal-menu" role="menu">
                        <button
                          role="menuitem"
                          onClick={() => {
                            downloadIcs(b)
                            setCalFor(null)
                          }}
                        >
                          <Icon name="download" size={14} /> Download .ics
                        </button>
                        <a
                          role="menuitem"
                          href={googleCalendarUrl(b)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setCalFor(null)}
                        >
                          <Icon name="calendar" size={14} /> Add to Google Calendar
                        </a>
                      </div>
                    )}
                  </div>

                  <button className="bill-mini" onClick={() => togglePause(b)} title={paused ? 'Resume' : 'Pause'}>
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button className="bill-mini" onClick={() => startEdit(b)} title="Edit">
                    <Icon name="edit" size={15} />
                  </button>
                  {confirmId === b.id ? (
                    <span className="bill-confirm">
                      <button className="bill-mini danger" onClick={() => remove(b.id)}>
                        Delete
                      </button>
                      <button className="bill-mini" onClick={() => setConfirmId(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      className="bill-mini"
                      onClick={() => setConfirmId(b.id)}
                      title="Delete"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="bills-note field-hint">
        Reminders fire from your own calendar app after you add a bill via{' '}
        <strong>Calendar → Download .ics</strong> (Outlook / Apple Calendar) or{' '}
        <strong>Add to Google Calendar</strong>. Each adds a monthly recurring event with a
        one-day-before alert — no account linking needed.
      </p>
    </section>
  )
}
