// Label-sheet geometry. All values in millimetres.
//
// A full-size EAN-13 symbol (including its quiet zones) is 37.29mm wide — that's
// "100% magnification". The spec allows shrinking to 80%; below that, scanners
// start failing. So the sheet calculator reports magnification and warns rather
// than silently producing labels that won't scan.

export const PAPERS = {
  a4: { id: 'a4', label: 'A4', css: 'A4', w: 210, h: 297 },
  letter: { id: 'letter', label: 'Letter', css: 'letter', w: 216, h: 279 },
}

export const PAGE_MARGIN = 10
// @page can't read CSS variables reliably, so the studio injects a rule with
// the chosen paper size into a <style> element with this id.
export const PAGES_STYLE_ID = 'bc-page-size'
export const GAP_X = 4
export const GAP_Y = 6
export const LABEL_PADDING = 2

// Our SVG is 113 modules wide (95 symbol + 11/7 quiet zones) by 97 units tall.
const SVG_ASPECT = 97 / 113
const NOMINAL_WIDTH_MM = 37.29 // EAN-13 at 100%
const MIN_MAGNIFICATION = 0.8 // below this, scanning gets unreliable

const TEXT_NAME_MM = 3.5
const TEXT_PRICE_MM = 4

/**
 * How many labels fit on one page, and how big the barcode ends up.
 * Returns { perPage, rows, cols, labelW, barcodeW, magnification, scannable }.
 */
export function sheetLayout({
  paper = 'a4',
  perRow = 3,
  showName = true,
  showPrice = true,
} = {}) {
  const p = PAPERS[paper] || PAPERS.a4
  const usableW = p.w - PAGE_MARGIN * 2
  const usableH = p.h - PAGE_MARGIN * 2

  const labelW = (usableW - (perRow - 1) * GAP_X) / perRow
  const barcodeW = labelW - LABEL_PADDING * 2
  const barcodeH = barcodeW * SVG_ASPECT

  const labelH =
    barcodeH +
    LABEL_PADDING * 2 +
    (showName ? TEXT_NAME_MM : 0) +
    (showPrice ? TEXT_PRICE_MM : 0)

  const rows = Math.max(1, Math.floor((usableH + GAP_Y) / (labelH + GAP_Y)))
  const magnification = barcodeW / NOMINAL_WIDTH_MM

  return {
    perPage: rows * perRow,
    rows,
    cols: perRow,
    labelW: round1(labelW),
    labelH: round1(labelH),
    barcodeW: round1(barcodeW),
    magnification,
    magnificationPct: Math.round(magnification * 100),
    scannable: magnification >= MIN_MAGNIFICATION,
  }
}

const round1 = (n) => Math.round(n * 10) / 10

/** Largest labels-per-row that still prints a reliably scannable barcode. */
export function maxScannablePerRow(paper = 'a4') {
  let best = 2
  for (let n = 2; n <= 8; n++) {
    if (sheetLayout({ paper, perRow: n }).scannable) best = n
  }
  return best
}
