import { useEffect } from 'react'
import BarcodeSVG from './BarcodeSVG.jsx'

/**
 * Full-size, scannable view of ONE label. The sheet preview shrinks labels to fit
 * the page mock, which is far too small for a phone to decode off the screen;
 * this renders a single label large (vector, crisp, pure black on white) so it
 * can actually be scan-tested straight from the display. Tap the backdrop or
 * press Esc to close.
 */
export default function LabelZoom({ code, name, price, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="label-zoom" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="label-zoom-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="label-zoom-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {name && <div className="label-zoom-name">{name}</div>}
        <BarcodeSVG code={code} scale={6} className="label-zoom-bc" />
        {price && <div className="label-zoom-price">{price}</div>}
        <p className="label-zoom-hint">
          Scanning off a screen is less reliable than paper — hold the camera
          ~15–20&nbsp;cm away, avoid glare, and raise your brightness. For a
          definitive test, scan the printed label.
        </p>
      </div>
    </div>
  )
}
