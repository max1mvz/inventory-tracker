import { peso } from '../format'
import './dashboard.css'

// Inventory split by category: stock value (₱ at cost), units, SKU count, and
// low-stock flags per category, drawn as a ranked list with proportional bars.
export default function CategoryBreakdown({ categories }) {
  const max = Math.max(1, ...categories.map((c) => c.value))

  return (
    <div className="chart">
      <div className="chart-head">
        <div>
          <h3>By category</h3>
          <div className="chart-sub">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · value in stock
          </div>
        </div>
      </div>

      {categories.length > 0 ? (
        <ul className="cat-list">
          {categories.map((c) => (
            <li key={c.name} className="cat-item">
              <div className="cat-item-row">
                <span className="cat-item-name" title={c.name}>
                  {c.name}
                  {c.low > 0 && <span className="cat-low-pill">{c.low} low</span>}
                </span>
                <span className="cat-item-val">
                  {peso(c.value)}{' '}
                  <small>· {c.units.toLocaleString()} units · {c.count} SKU{c.count === 1 ? '' : 's'}</small>
                </span>
              </div>
              <span className="cat-item-track">
                <span
                  className="cat-item-fill"
                  style={{ width: `${(c.value / max) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="chart-empty">No products yet.</p>
      )}
    </div>
  )
}
