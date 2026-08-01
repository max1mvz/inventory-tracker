import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// Each hook instance needs its OWN channel. Supabase returns the same channel
// for a repeated topic name, and calling `.on()` on an already-subscribed
// channel throws "cannot add postgres_changes callbacks ... after subscribe()".
// A unique name per instance lets multiple components subscribe at once (e.g.
// the dashboard plus an open product drawer).
let channelSeq = 0

/**
 * Subscribes to INSERTs on the movements table over Supabase realtime and calls
 * `onInsert(payload)` for each. Returns the channel status ('SUBSCRIBED', etc.)
 * so the UI can show a live indicator. RLS is respected on realtime, so a user
 * only receives movements they're allowed to read.
 */
export function useRealtimeMovements(onInsert) {
  const cbRef = useRef(onInsert)
  cbRef.current = onInsert
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`movements-${++channelSeq}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'movements' },
        (payload) => cbRef.current?.(payload),
      )
      .subscribe((s) => setStatus(s))

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return status
}
