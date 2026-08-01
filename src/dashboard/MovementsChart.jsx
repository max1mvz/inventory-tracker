import './dashboard.css'

// Received (+) vs removed (−) units per day, last 7 days. Built as flexbox bars
// (not a fixed-size SVG) so the chart grows to fill its panel — which lets it sit
// at equal height beside the Top Selling Products panel. Status colors
// (received = good, removed = danger), each named in the legend.
export default function MovementsChart({ data }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.received, d.removed)))
  const hasData = data.some((d) => d.received || d.removed)

  return (
    <div className="chart mv-chart">
      <div className="chart-head">
        <div>
          <h3>Movements</h3>
          <div className="chart-sub">Last 7 days</div>
        </div>
        <div className="chart-legend">
          <span className="lg-item">
            <span className="lg-swatch received" /> Received
          </span>
          <span className="lg-item">
            <span className="lg-swatch removed" /> Removed
          </span>
        </div>
      </div>

      {hasData ? (
        <div className="mv-plot">
          {data.map((d) => (
            <div className="mv-day" key={d.label}>
              <div className="mv-day-bars">
                <div
                  className="mv-b received"
                  style={{ height: `${(d.received / max) * 100}%` }}
                  title={`${d.label}: +${d.received} received`}
                />
                <div
                  className="mv-b removed"
                  style={{ height: `${(d.removed / max) * 100}%` }}
                  title={`${d.label}: −${d.removed} removed`}
                />
              </div>
              <div className="mv-day-label">{d.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="chart-empty">No movements in the last 7 days.</p>
      )}
    </div>
  )
}
