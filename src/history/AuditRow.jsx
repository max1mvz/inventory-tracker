import { whenLabel } from './MovementRow.jsx'
import './history.css'

const ACTION = {
  insert: { label: 'Created', cls: 'up' },
  update: { label: 'Edited', cls: 'edit' },
  delete: { label: 'Deleted', cls: 'down' },
}

// Human labels for the columns we audit; anything else falls back to the raw key.
const FIELD = {
  name: 'name',
  sku: 'SKU',
  category: 'category',
  unit: 'unit',
  reorder_point: 'reorder point',
  cost: 'cost',
  price: 'price',
  image_url: 'photo',
  barcode: 'barcode',
}

const show = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  const s = String(v)
  if (/^https?:\/\//.test(s)) return 'image' // URLs are noise in a feed
  return s.length > 24 ? `${s.slice(0, 24)}…` : s
}

function summarize(action, changed) {
  if (!changed) return null
  if (action === 'update') {
    const parts = Object.entries(changed).map(
      ([k, v]) => `${FIELD[k] || k}: ${show(v?.from)} → ${show(v?.to)}`,
    )
    return parts.join(' · ')
  }
  return changed.name ? String(changed.name) : null
}

/** One catalog change (product created / edited / deleted) in the audit feed. */
export default function AuditRow({ action, record_id, changed, created_at, who, whoEmail }) {
  const meta = ACTION[action] || { label: action, cls: 'edit' }
  const detail = summarize(action, changed)

  return (
    <li className="mv-row">
      <span className={`mv-delta act ${meta.cls}`}>{meta.label}</span>
      <span className="mv-body">
        <span className="mv-product">
          {(action === 'update' ? changed?.name?.to : changed?.name) || record_id}
        </span>
        <span className="mv-meta">{detail || `Product ${record_id}`}</span>
      </span>
      <span className="mv-side">
        <time className="mv-time">{whenLabel(created_at)}</time>
        <span className="mv-who" title={whoEmail || undefined}>
          {who}
        </span>
      </span>
    </li>
  )
}
