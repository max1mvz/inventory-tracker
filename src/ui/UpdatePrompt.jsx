import { useRegisterSW } from 'virtual:pwa-register/react'
import './UpdatePrompt.css'

const UPDATE_CHECK_MS = 60 * 60 * 1000 // hourly

/**
 * Registers the service worker and surfaces a new build as a dismissible badge
 * instead of swapping it in silently. The user stays in control of when the app
 * reloads — and always knows a change actually landed.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Poll periodically, and whenever the app is brought back to the
      // foreground — the usual way a phone user returns to an installed app.
      setInterval(() => registration.update(), UPDATE_CHECK_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
  })

  if (needRefresh) {
    return (
      <div className="app-toast update" role="alert">
        <div className="app-toast-text">
          <strong>Update available</strong>
          <span>A newer version of the app is ready.</span>
        </div>
        <div className="app-toast-actions">
          <button className="btn ghost small" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
          <button className="btn primary small" onClick={() => updateServiceWorker(true)}>
            Update
          </button>
        </div>
      </div>
    )
  }

  if (offlineReady) {
    return (
      <div className="app-toast" role="status">
        <div className="app-toast-text">
          <strong>Ready to work offline</strong>
          <span>The app is installed and available without a connection.</span>
        </div>
        <div className="app-toast-actions">
          <button className="btn ghost small" onClick={() => setOfflineReady(false)}>
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  return null
}
