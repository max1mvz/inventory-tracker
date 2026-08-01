const REASON_LABEL = {
  received: 'Received',
  sold: 'Sold',
  damaged: 'Damaged',
  returned: 'Returned',
  count_adjustment: 'Recount',
  transfer: 'Transfer',
}

export function whenLabel(iso) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * One movement, presentational. `productName` is shown in the global feed;
 * omit it in per-product history. `who` is the person who recorded it (falls
 * back to You/Teammate if the directory hasn't loaded); `whoEmail` is the title.
 */
export default function MovementRow({
  delta,
  reason,
  note,
  created_at,
  productName,
  mine,
  who,
  whoEmail,
}) {
  const positive = delta > 0
  return (
    <li className="mv-row">
      <span className={`mv-delta ${positive ? 'up' : 'down'}`}>
        {positive ? '+' : ''}
        {delta}
      </span>
      <span className="mv-body">
        {productName && <span className="mv-product">{productName}</span>}
        <span className="mv-meta">
          {REASON_LABEL[reason] || reason}
          {note ? ` · ${note}` : ''}
        </span>
      </span>
      <span className="mv-side">
        <time className="mv-time">{whenLabel(created_at)}</time>
        <span className="mv-who" title={whoEmail || undefined}>
          {who || (mine ? 'You' : 'Teammate')}
        </span>
      </span>
    </li>
  )
}
