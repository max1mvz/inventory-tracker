import { useState } from 'react'
import { MOVEMENT_REASONS } from '../data/inventory'
import MovementHistory from '../history/MovementHistory.jsx'
import Icon from '../ui/Icon.jsx'
import './ProductCard.css'

/**
 * Presentational product view + quick actions. All stock changes go out through
 * onMovement(delta, reason, note); the parent records the movement and hands
 * back a refreshed `product`. No quantity is ever mutated here directly.
 */
export default function ProductCard({
  product,
  onMovement,
  onScanNext,
  onEdit,
  busy,
  justCreated,
  flash,
  doneLabel = 'Scan next',
}) {
  const [mode, setMode] = useState('quick') // quick | custom | recount
  const [showHistory, setShowHistory] = useState(false)

  const qty = product.qty ?? 0
  const lowStock = product.needs_reorder

  return (
    <section className="card">
      {justCreated && (
        <div className="card-banner good">New product added — set its stock below.</div>
      )}
      {flash && <div className="card-banner">{flash}</div>}

      <header className="card-head">
        {product.image_url && (
          <img className="card-photo" src={product.image_url} alt="" loading="lazy" />
        )}
        <div className="card-title">
          <h2>{product.name}</h2>
          <div className="card-meta">
            <code>{product.barcode}</code>
            {product.category && <span className="dot">·</span>}
            {product.category && <span>{product.category}</span>}
            {product.sku && <span className="dot">·</span>}
            {product.sku && <span>SKU {product.sku}</span>}
          </div>
        </div>
        {onEdit && (
          <button className="btn ghost small card-edit" onClick={onEdit} disabled={busy}>
            <Icon name="edit" size={15} />
            Edit
          </button>
        )}
      </header>

      <div className={`qty ${lowStock ? 'low' : ''}`}>
        <div className="qty-value">
          {qty}
          <span className="qty-unit">{product.unit || 'pcs'}</span>
        </div>
        <div className="qty-side">
          {lowStock ? (
            <span className="badge danger">Low · reorder at {product.reorder_point}</span>
          ) : (
            <span className="badge muted">reorder at {product.reorder_point}</span>
          )}
        </div>
      </div>

      {mode === 'quick' && (
        <>
          <div className="quick-grid">
            <button
              className="btn big"
              disabled={busy}
              onClick={() => onMovement(-1, 'sold')}
            >
              −1
            </button>
            <button
              className="btn big primary"
              disabled={busy}
              onClick={() => onMovement(1, 'received')}
            >
              +1
            </button>
          </div>
          <div className="quick-grid">
            <button className="btn" disabled={busy} onClick={() => setMode('custom')}>
              Custom amount
            </button>
            <button className="btn" disabled={busy} onClick={() => setMode('recount')}>
              Full recount
            </button>
          </div>
        </>
      )}

      {mode === 'custom' && (
        <CustomPanel
          busy={busy}
          onCancel={() => setMode('quick')}
          onApply={(delta, reason, note) => onMovement(delta, reason, note)}
        />
      )}

      {mode === 'recount' && (
        <RecountPanel
          currentQty={qty}
          unit={product.unit || 'pcs'}
          busy={busy}
          onCancel={() => setMode('quick')}
          onApply={(delta, note) => onMovement(delta, 'count_adjustment', note)}
        />
      )}

      <button
        className="btn ghost small history-toggle"
        onClick={() => setShowHistory((s) => !s)}
      >
        {showHistory ? 'Hide history' : 'View history'}
      </button>
      {showHistory && <MovementHistory barcode={product.barcode} />}

      <button className="btn ghost scan-next" onClick={onScanNext} disabled={busy}>
        {doneLabel}
      </button>
    </section>
  )
}

function CustomPanel({ onApply, onCancel, busy }) {
  const [direction, setDirection] = useState('add') // add | remove
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('received')
  const [note, setNote] = useState('')

  const n = parseInt(amount, 10)
  const valid = Number.isFinite(n) && n > 0
  const delta = direction === 'remove' ? -n : n

  return (
    <div className="panel">
      <div className="seg">
        <button
          className={`seg-btn ${direction === 'add' ? 'on' : ''}`}
          onClick={() => setDirection('add')}
          type="button"
        >
          Add
        </button>
        <button
          className={`seg-btn ${direction === 'remove' ? 'on' : ''}`}
          onClick={() => setDirection('remove')}
          type="button"
        >
          Remove
        </button>
      </div>

      <label className="field">
        <span>Amount</span>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Reason</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {MOVEMENT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. delivery #1423"
        />
      </label>

      <div className="panel-actions">
        <button className="btn ghost" onClick={onCancel} disabled={busy} type="button">
          Cancel
        </button>
        <button
          className="btn primary grow"
          disabled={busy || !valid}
          onClick={() => onApply(delta, reason, note)}
          type="button"
        >
          {busy ? 'Saving…' : `Apply ${delta > 0 ? '+' : ''}${valid ? delta : ''}`}
        </button>
      </div>
    </div>
  )
}

function RecountPanel({ currentQty, unit, onApply, onCancel, busy }) {
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')

  const n = parseInt(counted, 10)
  const valid = Number.isFinite(n) && n >= 0
  const delta = valid ? n - currentQty : 0

  return (
    <div className="panel">
      <p className="panel-hint">
        Enter the number you physically counted. This records a{' '}
        <strong>count adjustment</strong> — it never overwrites history.
      </p>

      <label className="field">
        <span>Counted ({unit})</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          placeholder={String(currentQty)}
          autoFocus
        />
      </label>

      {valid && (
        <p className="recount-delta">
          {delta === 0 ? (
            <>Count already matches — nothing to record.</>
          ) : (
            <>
              Adjustment: <strong>{delta > 0 ? '+' : ''}{delta}</strong> (was{' '}
              {currentQty}, now {n})
            </>
          )}
        </p>
      )}

      <label className="field">
        <span>Note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. quarterly count"
        />
      </label>

      <div className="panel-actions">
        <button className="btn ghost" onClick={onCancel} disabled={busy} type="button">
          Cancel
        </button>
        <button
          className="btn primary grow"
          disabled={busy || !valid || delta === 0}
          onClick={() => onApply(delta, note)}
          type="button"
        >
          {busy ? 'Saving…' : 'Apply recount'}
        </button>
      </div>
    </div>
  )
}
