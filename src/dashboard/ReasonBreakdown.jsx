import './dashboard.css'

// Movements over the last 30 days split by reason (received / sold / damaged …),
// as a ranked bar list. `reasons` = [{ reason, units, count }] sorted desc.
const META = {
  received: { label: 'Received', cls: 'received' },
  sold: { label: 'Sold', cls: 'sold' },
  returned: { label: 'Returned', cls: 'returned' },
  damaged: { label: 'Damaged', cls: 'damaged' },
  count_adjustment: { label: 'Recount', cls: 'adjust' },
  transfer: { label: 'Transfer', cls: 'transfer' },
}

export default function ReasonBreakdown({ reasons }) {
  const max = Math.max(1, ...reasons.map((r) => r.units))

  return (
    <div className="chart">
      <div className="chart-head">
        <div>
          <h3>By reason</h3>
          <div className="chart-sub">Last 30 days · units moved</div>
        </div>
      </div>

      {reasons.length > 0 ? (
        <ul className="cat-list">
          {reasons.map((r) => {
            const m = META[r.reason] || { label: r.reason, cls: 'adjust' }
            return (
              <li key={r.reason} className="cat-item">
                <div className="cat-item-row">
                  <span className="cat-item-name">
                    <span className={`reason-dot ${m.cls}`} />
                    {m.label}
                  </span>
                  <span className="cat-item-val">
                    {r.units.toLocaleString()}{' '}
                    <small>· {r.count} move{r.count === 1 ? '' : 's'}</small>
                  </span>
                </div>
                <span className="cat-item-track">
                  <span
                    className={`cat-item-fill reason ${m.cls}`}
                    style={{ width: `${(r.units / max) * 100}%` }}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="chart-empty">No movement in the last 30 days.</p>
      )}
    </div>
  )
}
