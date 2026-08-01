import { useEffect, useState } from 'react'
import { listProfiles } from './inventory'

/**
 * Loads the team directory (userId → { email, role }) and returns a helper that
 * turns an actor id into a display label. Falls back gracefully: an unknown id
 * reads as "Unknown user", and a null actor (a change made outside the app, e.g.
 * in the SQL editor) reads as "System".
 */
export function useTeamDirectory(currentUserId) {
  const [people, setPeople] = useState({})

  useEffect(() => {
    let active = true
    listProfiles()
      .then((map) => active && setPeople(map))
      .catch(() => {}) // naming is a nicety; never break the feed over it
    return () => {
      active = false
    }
  }, [])

  const nameFor = (userId) => {
    if (!userId) return 'System'
    const email = people[userId]?.email
    if (!email) return userId === currentUserId ? 'You' : 'Unknown user'
    // The part before @ is the readable handle; the full email is the tooltip.
    const handle = email.split('@')[0]
    return userId === currentUserId ? `${handle} (you)` : handle
  }

  const emailFor = (userId) => (userId ? people[userId]?.email || '' : '')

  return { people, nameFor, emailFor }
}
