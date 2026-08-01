import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { beep, primeBeep } from './beep'
import './CameraScanner.css'

// Ignore a repeat of the SAME barcode within this window — stops one physical
// barcode from being counted twice (pause race, or the code lingering in frame
// after "Scan next"). A different barcode always fires immediately.
const SAME_CODE_COOLDOWN_MS = 2500

// Narrowing the format list measurably improves decode speed (per project brief).
const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.CODE_128,
]

const READER_ID = 'reader'

function formatName(formatId) {
  const entry = Object.entries(Html5QrcodeSupportedFormats).find(
    ([, v]) => v === formatId,
  )
  return entry ? entry[0] : String(formatId)
}

/**
 * Owns the html5-qrcode engine. Calls onDecode(barcode, format) for each read.
 * The workflow pauses the camera the instant a code is decoded (via the exposed
 * ref) and resumes it when the user is ready for the next scan — so a lingering
 * barcode can't double-fire, and there's no need for a time-based debounce.
 */
const CameraScanner = forwardRef(function CameraScanner({ onDecode }, ref) {
  const scannerRef = useRef(null)
  const handlingRef = useRef(false)
  const lastCodeRef = useRef({ text: null, at: 0 })

  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  const handleDecode = useCallback(
    (decodedText, result) => {
      // Guard the race between a decode firing and the camera actually pausing.
      if (handlingRef.current) return
      // Suppress a rapid repeat of the same barcode so it can't count twice.
      const now = Date.now()
      const last = lastCodeRef.current
      if (last.text === decodedText && now - last.at < SAME_CODE_COOLDOWN_MS) return

      handlingRef.current = true
      lastCodeRef.current = { text: decodedText, at: now }
      const formatId = result?.result?.format?.format
      // Hand off to the workflow FIRST — audio must never delay or block a scan.
      onDecode(decodedText, formatId != null ? formatName(formatId) : 'unknown')
      beep() // audible "got it" — pairs with the workflow's haptic buzz
    },
    [onDecode],
  )

  useImperativeHandle(
    ref,
    () => ({
      pause: () => {
        try {
          scannerRef.current?.pause(true)
        } catch {
          /* not running */
        }
      },
      resume: () => {
        try {
          scannerRef.current?.resume()
        } catch {
          /* not running */
        }
        handlingRef.current = false
      },
      isRunning: () => running,
    }),
    [running],
  )

  const detectTorch = useCallback((scanner) => {
    try {
      const caps = scanner.getRunningTrackCapabilities?.()
      setTorchSupported(Boolean(caps && 'torch' in caps))
    } catch {
      setTorchSupported(false)
    }
  }, [])

  const start = useCallback(async () => {
    if (busy || running) return
    primeBeep() // unlock audio within this tap so the beep can play later
    setBusy(true)
    setError(null)
    try {
      const scanner = new Html5Qrcode(READER_ID, {
        formatsToSupport: FORMATS,
        verbose: false,
      })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (vw, vh) => {
            const width = Math.min(vw * 0.8, 320)
            return { width, height: Math.max(width * 0.45, 120) }
          },
          aspectRatio: 1.7778,
        },
        handleDecode,
        () => {}, // per-frame decode failures are normal; ignore
      )
      handlingRef.current = false
      lastCodeRef.current = { text: null, at: 0 }
      setRunning(true)
      detectTorch(scanner)
    } catch (e) {
      setError(describeError(e))
      scannerRef.current = null
    } finally {
      setBusy(false)
    }
  }, [busy, running, handleDecode, detectTorch])

  const stop = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    setBusy(true)
    try {
      await scanner.stop()
      await scanner.clear()
    } catch {
      /* already stopped */
    } finally {
      scannerRef.current = null
      setRunning(false)
      setTorchOn(false)
      setTorchSupported(false)
      handlingRef.current = false
      lastCodeRef.current = { text: null, at: 0 }
      setBusy(false)
    }
  }, [])

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    const next = !torchOn
    try {
      await scanner.applyVideoConstraints({ advanced: [{ torch: next }] })
      setTorchOn(next)
    } catch {
      setError('Torch not available on this device/browser.')
    }
  }, [torchOn])

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  return (
    <div className="camera">
      <div className="viewport">
        <div id={READER_ID} className="reader" />
        {!running && !busy && (
          <div className="viewport-overlay">
            <p>Camera is off</p>
          </div>
        )}
      </div>

      <div className="controls">
        {!running ? (
          <button className="btn primary grow" onClick={start} disabled={busy}>
            {busy ? 'Starting…' : 'Start scanning'}
          </button>
        ) : (
          <button className="btn grow" onClick={stop} disabled={busy}>
            Stop camera
          </button>
        )}
        {running && torchSupported && (
          <button
            className={`btn ${torchOn ? 'active' : ''}`}
            onClick={toggleTorch}
          >
            {torchOn ? 'Torch on' : 'Torch off'}
          </button>
        )}
      </div>

      {error && <p className="camera-error">{error}</p>}
    </div>
  )
})

function describeError(e) {
  const name = e?.name || ''
  if (name === 'NotAllowedError')
    return 'Camera permission denied. Allow camera access and try again.'
  if (name === 'NotFoundError') return 'No camera found on this device.'
  if (name === 'NotReadableError') return 'Camera is in use by another app.'
  if (typeof e === 'string') return e
  return e?.message || 'Could not start the camera.'
}

export default CameraScanner
