import { peso } from '../format'
import './dashboard.css'

const daysSince = (iso) => {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

const idleLabel = (iso) => {
  const d = daysSince(iso)
  if (d === null) return 'never moved'
  if (d === 0) return 'moved today'
  return `${d}d since last move`
}

/**
 * The two ends of the last 30 days: what's selling through, and what's sitting
 * still. Dead stock is ranked by the money tied up in it, so the most expensive
 * problem is at the top.
 */
export default function MovementRanking({ moving, idle, onPick }) {
  const maxMoved = Math.max(1, ...moving.map((m) => m.moved))

  return (
    <div className="rank-grid">
      <section className="rank-col">
        <div className="chart-head">
          <div>
            <h3>Top 10 moving</h3>
            <div className="chart-sub">Last 30 days · units in + out</div>
          </div>
        </div>
        {moving.length === 0 ? (
          <p className="chart-empty">No movement in the last 30 days.</p>
        ) : (
          <ol className="rank-list">
            {moving.map((m, i) => (
              <li key={m.barcode}>
                <button className="rank-row" onClick={() => onPick(m.barcode)}>
                  <span className="rank-num">{i + 1}</span>
                  <span className="rank-main">
                    <span className="rank-name" title={m.name}>
                      {m.name}
                    </span>
                    <span className="rank-track">
                      <span
                        className="rank-fill"
                        style={{ width: `${(m.moved / maxMoved) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className="rank-val">
                    {m.moved.toLocaleString()}
                    <small>units</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rank-col">
        <div className="chart-head">
          <div>
            <h3>Top 10 not moving</h3>
            <div className="chart-sub">Last 30 days · capital sitting still</div>
          </div>
        </div>
        {idle.length === 0 ? (
          <p className="chart-empty">Everything moved this month. 🎉</p>
        ) : (
          <ol className="rank-list">
            {idle.map((m, i) => (
              <li key={m.barcode}>
                <button className="rank-row" onClick={() => onPick(m.barcode)}>
                  <span className="rank-num idle">{i + 1}</span>
                  <span className="rank-main">
                    <span className="rank-name" title={m.name}>
                      {m.name}
                    </span>
                    <span className="rank-sub">
                      {m.moved > 0 ? `only ${m.moved} moved · ` : ''}
                      {idleLabel(m.last)}
                    </span>
                  </span>
                  <span className="rank-val idle">
                    {m.value > 0 ? peso(m.value) : m.qty.toLocaleString()}
                    <small>{m.value > 0 ? 'on hand' : 'units'}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
