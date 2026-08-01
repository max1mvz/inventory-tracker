import { encodeEan13 } from './ean13'

// Drawn to the EAN-13 proportions: 95 modules of bars, a quiet zone either side,
// and guard bars that drop below the rest so a scanner can find the edges.
// Pure black on white regardless of theme — that's what scans reliably.
const QUIET_LEFT = 11
const QUIET_RIGHT = 7
const MODULES = 95
const BAR_H = 70
const GUARD_DROP = 9
const TEXT_H = 18

// Module indexes belonging to the start / centre / end guards.
const isGuard = (i) =>
  i < 3 || (i >= 45 && i < 50) || i >= 92

export default function BarcodeSVG({ code, scale = 2, showText = true, className }) {
  let bits
  try {
    bits = encodeEan13(code)
  } catch {
    return null
  }

  const totalW = (QUIET_LEFT + MODULES + QUIET_RIGHT) * scale
  const totalH = BAR_H + GUARD_DROP + (showText ? TEXT_H : 4)
  const baseline = BAR_H + GUARD_DROP

  // Merge runs of consecutive dark modules into single rects — fewer nodes and
  // crisper edges than one rect per module.
  const bars = []
  let run = 0
  for (let i = 0; i <= bits.length; i++) {
    const dark = bits[i] === '1'
    if (dark) {
      if (run === 0) run = 1
      else run++
      continue
    }
    if (run > 0) {
      const start = i - run
      const guard = isGuard(start)
      bars.push({
        x: (QUIET_LEFT + start) * scale,
        w: run * scale,
        h: guard ? BAR_H + GUARD_DROP : BAR_H,
      })
      run = 0
    }
  }

  const d = String(code)
  const digitY = baseline + 13
  // Left digit sits in the quiet zone; the two halves sit under their bars.
  const leftHalfCentre = (QUIET_LEFT + 3 + 21) * scale
  const rightHalfCentre = (QUIET_LEFT + 50 + 21) * scale

  return (
    <svg
      className={className}
      viewBox={`0 0 ${totalW} ${totalH}`}
      width={totalW}
      height={totalH}
      role="img"
      aria-label={`Barcode ${d}`}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width={totalW} height={totalH} fill="#ffffff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height={b.h} fill="#000000" />
      ))}
      {showText && (
        <g fill="#000000" fontFamily="monospace" fontSize={13} textAnchor="middle">
          <text x={4 * scale} y={digitY} textAnchor="start">
            {d[0]}
          </text>
          <text x={leftHalfCentre} y={digitY} letterSpacing={scale}>
            {d.slice(1, 7)}
          </text>
          <text x={rightHalfCentre} y={digitY} letterSpacing={scale}>
            {d.slice(7)}
          </text>
        </g>
      )}
    </svg>
  )
}
