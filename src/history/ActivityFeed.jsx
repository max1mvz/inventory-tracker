import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { recentMovements, recentAudit } from '../data/inventory'
import { useAuth } from '../auth/AuthContext.jsx'
import { useRealtimeMovements } from '../data/useRealtimeMovements'
import { useTeamDirectory } from '../data/useTeamDirectory'
import MovementRow from './MovementRow.jsx'
import AuditRow from './AuditRow.jsx'
import './history.css'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'stock', label: 'Stock' },
  { id: 'catalog', label: 'Catalog' },
]

/**
 * The audit trail: every stock movement and every catalog change, newest first,
 * each attributed to the person who made it.
 */
export default function ActivityFeed() {
  const { user } = useAuth()
  const { nameFor, emailFor } = useTeamDirectory(user?.id)
  const [moves, setMoves] = useState([])
  const [audit, setAudit] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [m, a] = await Promise.all([recentMovements(), recentAudit()])
      setMoves(m)
      setAudit(a)
    } catch (e) {
      setError(e.message || 'Could not load activity.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // A new movement's payload lacks the product name, so refetch (debounced) to
  // resolve it rather than prepend a nameless row.
  useRealtimeMovements(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 400)
  })
  useEffect(() => () => clearTimeout(timer.current), [])

  // One timeline, newest first, from two sources.
  const entries = useMemo(() => {
    const m = moves.map((x) => ({ kind: 'move', at: x.created_at, data: x }))
    const a = audit.map((x) => ({ kind: 'audit', at: x.created_at, data: x }))
    const merged = filter === 'stock' ? m : filter === 'catalog' ? a : [...m, ...a]
    return merged.sort((p, q) => new Date(q.at) - new Date(p.at))
  }, [moves, audit, filter])

  return (
    <section className="activity">
      <div className="stock-head">
        <div className="stock-summary">Audit trail</div>
        <div className="seg">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`seg-btn ${filter === f.id ? 'on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="looking">
          <span className="spinner" /> Loading activity…
        </div>
      )}
      {error && <p className="mv-empty">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="mv-empty">Nothing recorded yet.</p>
      )}

      {entries.length > 0 && (
        <ul className="mv-list">
          {entries.map((e) =>
            e.kind === 'move' ? (
              <MovementRow
                key={`m${e.data.id}`}
                delta={e.data.delta}
                reason={e.data.reason}
                note={e.data.note}
                created_at={e.data.created_at}
                productName={e.data.products?.name || e.data.barcode}
                mine={e.data.user_id === user?.id}
                who={nameFor(e.data.user_id)}
                whoEmail={emailFor(e.data.user_id)}
              />
            ) : (
              <AuditRow
                key={`a${e.data.id}`}
                action={e.data.action}
                record_id={e.data.record_id}
                changed={e.data.changed}
                created_at={e.data.created_at}
                who={nameFor(e.data.actor_id)}
                whoEmail={emailFor(e.data.actor_id)}
              />
            ),
          )}
        </ul>
      )}
    </section>
  )
}
