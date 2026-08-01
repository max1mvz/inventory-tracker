import { useEffect, useState } from 'react'
import { movementHistory } from '../data/inventory'
import { useAuth } from '../auth/AuthContext.jsx'
import { useRealtimeMovements } from '../data/useRealtimeMovements'
import { useTeamDirectory } from '../data/useTeamDirectory'
import MovementRow from './MovementRow.jsx'
import './history.css'

export default function MovementHistory({ barcode }) {
  const { user } = useAuth()
  const { nameFor, emailFor } = useTeamDirectory(user?.id)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    movementHistory(barcode)
      .then((data) => active && setRows(data))
      .catch((e) => active && setError(e.message || 'History unavailable.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [barcode])

  // Prepend movements for this product as they happen (own actions + teammates').
  useRealtimeMovements((payload) => {
    const m = payload?.new
    if (m?.barcode === barcode) {
      setRows((prev) => (prev.some((r) => r.id === m.id) ? prev : [m, ...prev]))
    }
  })

  if (loading) {
    return (
      <div className="looking">
        <span className="spinner" /> Loading history…
      </div>
    )
  }
  if (error) return <p className="mv-empty">{error}</p>
  if (rows.length === 0) return <p className="mv-empty">No movements yet.</p>

  return (
    <ul className="mv-list history-panel">
      {rows.map((m) => (
        <MovementRow
          key={m.id}
          delta={m.delta}
          reason={m.reason}
          note={m.note}
          created_at={m.created_at}
          mine={m.user_id === user?.id}
          who={nameFor(m.user_id)}
          whoEmail={emailFor(m.user_id)}
        />
      ))}
    </ul>
  )
}
