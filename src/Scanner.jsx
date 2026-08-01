import { useCallback, useRef, useState } from 'react'
import CameraScanner from './scan/CameraScanner.jsx'
import ProductCard from './scan/ProductCard.jsx'
import CreateProduct from './scan/CreateProduct.jsx'
import { lookupProduct, createProduct, recordMovement } from './data/inventory'
import './Scanner.css'

// Workflow phases after the camera decodes a barcode:
//   scanning → lookup → (found | notfound) → back to scanning on "Scan next"
export default function Scanner() {
  const cameraRef = useRef(null)

  const [phase, setPhase] = useState('scanning')
  const [barcode, setBarcode] = useState(null)
  const [product, setProduct] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(null)
  const [justCreated, setJustCreated] = useState(false)
  const [manual, setManual] = useState('')

  const showingResult = phase === 'found' || phase === 'notfound' || phase === 'error'

  const onDecode = useCallback(async (raw) => {
    const code = String(raw).trim() // normalize — stray whitespace breaks the barcode FK
    cameraRef.current?.pause()
    setBarcode(code)
    setError(null)
    setFlash(null)
    setJustCreated(false)
    setPhase('lookup')
    if (navigator.vibrate) navigator.vibrate(40)
    try {
      const found = await lookupProduct(code)
      if (found) {
        setProduct(found)
        setPhase('found')
      } else {
        setProduct(null)
        setPhase('notfound')
      }
    } catch (e) {
      setError(e.message || 'Lookup failed.')
      setPhase('error')
    }
  }, [])

  const scanNext = useCallback(() => {
    setPhase('scanning')
    setBarcode(null)
    setProduct(null)
    setError(null)
    setFlash(null)
    setJustCreated(false)
    cameraRef.current?.resume()
  }, [])

  const onMovement = useCallback(
    async (delta, reason, note) => {
      setBusy(true)
      setError(null)
      try {
        const res = await recordMovement({ barcode, delta, reason, note, product })
        if (res.queued) {
          setProduct((p) =>
            p
              ? {
                  ...p,
                  qty: (p.qty || 0) + delta,
                  needs_reorder: (p.qty || 0) + delta <= p.reorder_point,
                }
              : p,
          )
          setFlash(`Saved offline (${delta > 0 ? '+' : ''}${delta}) — will sync`)
        } else {
          setProduct(await lookupProduct(barcode))
          setFlash(`Recorded ${delta > 0 ? '+' : ''}${delta} · ${reason.replace('_', ' ')}`)
        }
        if (navigator.vibrate) navigator.vibrate(30)
      } catch (e) {
        setError(e.message || 'Could not save that movement.')
      } finally {
        setBusy(false)
      }
    },
    [barcode, product],
  )

  const onCreate = useCallback(async (fields) => {
    setBusy(true)
    setError(null)
    try {
      const res = await createProduct(fields)
      const row = res.product ?? (await lookupProduct(fields.barcode))
      setProduct(row)
      setJustCreated(true)
      setPhase('found')
      if (res.queued) setFlash('Saved offline — will sync when back online')
    } catch (e) {
      setError(e.message || 'Could not create the product.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <div className="scanner">
      <div className={showingResult ? 'camera-host hidden' : 'camera-host'}>
        <CameraScanner ref={cameraRef} onDecode={onDecode} />
        {phase === 'scanning' && (
          <p className="scan-hint">Hold a barcode steady in the frame.</p>
        )}
      </div>

      {phase === 'scanning' && (
        <form
          className="manual"
          onSubmit={(e) => {
            e.preventDefault()
            const code = manual.trim()
            if (code) {
              onDecode(code)
              setManual('')
            }
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Or type a barcode number"
          />
          <button className="btn" type="submit" disabled={!manual.trim()}>
            Look up
          </button>
        </form>
      )}

      {phase === 'lookup' && (
        <div className="looking">
          <span className="spinner" /> Looking up <code>{barcode}</code>…
        </div>
      )}

      {phase === 'found' && product && (
        <>
          {error && <p className="create-error">{error}</p>}
          <ProductCard
            product={product}
            onMovement={onMovement}
            onScanNext={scanNext}
            busy={busy}
            justCreated={justCreated}
            flash={flash}
          />
        </>
      )}

      {phase === 'error' && (
        <div className="scan-error-card">
          <p className="create-error">{error}</p>
          <button className="btn" onClick={scanNext}>
            Try another scan
          </button>
        </div>
      )}

      {phase === 'notfound' && (
        <CreateProduct
          barcode={barcode}
          onCreate={onCreate}
          onScanNext={scanNext}
          busy={busy}
          error={error}
        />
      )}
    </div>
  )
}
