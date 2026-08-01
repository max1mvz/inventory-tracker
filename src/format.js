// Formatting helpers shared across the UI.

const pesoFmt = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

// Format a number as Philippine pesos, e.g. 12375 → "₱12,375". Whole pesos only
// (dashboard figures read cleaner without centavos).
export const peso = (n) => pesoFmt.format(Number(n) || 0)

const pesoExactFmt = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Pesos with centavos, e.g. 1340.5 → "₱1,340.50". Used where exact amounts
// matter (expenses / VAT records), unlike the whole-peso dashboard figures.
export const pesoExact = (n) => pesoExactFmt.format(Number(n) || 0)
