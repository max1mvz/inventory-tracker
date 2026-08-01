// Formatting helpers shared across the UI.

const pesoFmt = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

// Format a number as Philippine pesos, e.g. 12375 → "₱12,375". Whole pesos only
// (dashboard figures read cleaner without centavos).
export const peso = (n) => pesoFmt.format(Number(n) || 0)
