// A short "scan success" beep via the Web Audio API — no audio file, so it works
// offline and adds nothing to the bundle. Browsers block audio until a user
// gesture, so call primeBeep() from a tap (e.g. "Start scanning") first.

let ctx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Create/resume the audio context from within a user gesture. Never throws —
 *  audio is a nice-to-have and must not break the scan flow. */
export function primeBeep() {
  try {
    const c = getCtx()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  } catch {
    /* audio unavailable — ignore */
  }
}

/** Play a brief confirmation tone. Safe to call often; silently no-ops if the
 *  Web Audio API is unavailable or throws (e.g. locked-down mobile browsers). */
export function beep({ frequency = 1046, duration = 130, volume = 0.18 } = {}) {
  try {
    const c = getCtx()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})

    const t = c.currentTime
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, t)

    // Quick attack, smooth decay — a clean "blip", not a click.
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration / 1000)

    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + duration / 1000)
  } catch {
    /* never let a beep failure break scanning */
  }
}
