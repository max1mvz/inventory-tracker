import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { onOutboxChange, flushOutbox } from './sync'
import { outboxCount } from './db'

const OfflineContext = createContext({
  online: true,
  pending: 0,
  flush: async () => {},
})

export function OfflineProvider({ children }) {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [pending, setPending] = useState(0)

  const flush = useCallback(async () => {
    const r = await flushOutbox()
    setPending(await outboxCount())
    return r
  }, [])

  useEffect(() => {
    outboxCount().then(setPending)
    const unsub = onOutboxChange(setPending)

    const goOnline = () => {
      setOnline(true)
      flush()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    // Retry periodically in case an 'online' event was missed.
    const iv = setInterval(() => {
      if (navigator.onLine) flush()
    }, 20000)

    if (navigator.onLine) flush() // drain anything left from a previous session

    return () => {
      unsub()
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(iv)
    }
  }, [flush])

  return (
    <OfflineContext.Provider value={{ online, pending, flush }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  return useContext(OfflineContext)
}
