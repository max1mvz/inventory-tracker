import Icon from '../ui/Icon.jsx'
import './dashboard.css'

/**
 * KPI tiles. `tiles` = [{ label, value, sub, icon, tone, subTone }].
 * tone: 'default' | 'hero' | 'danger'.  subTone: '' | 'good' | 'danger'.
 */
export default function StatTiles({ tiles }) {
  return (
    <div className="stat-tiles">
      {tiles.map((t) => (
        <div key={t.label} className={`stat-tile ${t.tone || ''}`}>
          <div className="stat-top">
            {t.icon && (
              <span className="stat-icon">
                <Icon name={t.icon} size={18} />
              </span>
            )}
            <span className="stat-label">{t.label}</span>
          </div>
          <div className="stat-value">
            {typeof t.value === 'number' ? t.value.toLocaleString() : t.value}
          </div>
          {t.sub && <div className={`stat-sub ${t.subTone || ''}`}>{t.sub}</div>}
        </div>
      ))}
    </div>
  )
}
