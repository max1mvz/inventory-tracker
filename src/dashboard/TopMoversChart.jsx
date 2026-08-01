import './dashboard.css'

// Top products by movement volume (Σ|delta|) over the last 30 days, shown as a
// vertical bar chart with a ranked list below (each row has a mini progress bar).
export default function TopMoversChart({ movers }) {
  const max = Math.max(1, ...movers.map((m) => m.total))

  return (
    <div className="chart">
      <div className="chart-head">
        <div>
          <h3>Top Selling Products</h3>
          <div className="chart-sub">Last 30 days · units moved</div>
        </div>
      </div>

      {movers.length > 0 ? (
        <>
          <div className="mover-bars">
            {movers.map((m) => (
              <div
                key={m.barcode}
                className="mover-bar-col"
                title={`${m.name}: ${m.total} units`}
              >
                <span className="mover-bar-val">{m.total}</span>
                <div
                  className="mover-bar"
                  style={{ height: `${Math.max((m.total / max) * 82, 5)}%` }}
                />
              </div>
            ))}
          </div>

          <ul className="mover-list">
            {movers.map((m) => (
              <li key={m.barcode} className="mover-item">
                <div className="mover-item-row">
                  <span className="mover-item-name" title={m.name}>
                    {m.name}
                  </span>
                  <span className="mover-item-val">
                    {m.total} <small>units</small>
                  </span>
                </div>
                <span className="mover-item-track">
                  <span
                    className="mover-item-fill"
                    style={{ width: `${(m.total / max) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="chart-empty">No movement in the last 30 days.</p>
      )}
    </div>
  )
}
