// EAN-13 encoding, implemented from the spec so the app gains a barcode
// generator without pulling in a library.
//
// Layout (95 modules): start guard 101 · 6 left digits (7 modules each,
// L/G parity chosen by the first digit) · centre guard 01010 · 6 right digits
// (R) · end guard 101.

const L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
]
const G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
]
const R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
]

// Which of the six left-hand digits use G instead of L, per the first digit.
const PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
]

export const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '')

/**
 * EAN-13 check digit for the first 12 digits: positions alternate ×1 / ×3 from
 * the left, then the digit that rounds the total up to a multiple of ten.
 */
export function checkDigit(first12) {
  const d = onlyDigits(first12).slice(0, 12)
  if (d.length !== 12) return null
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

/** True when a full 13-digit code carries the correct check digit. */
export function isValidEan13(code) {
  const d = onlyDigits(code)
  if (d.length !== 13) return false
  return checkDigit(d.slice(0, 12)) === Number(d[12])
}

/**
 * Normalize input into a valid 13-digit EAN. 12 digits → the check digit is
 * appended; 13 digits → the check digit is corrected if wrong. Returns
 * { code, corrected, error }.
 */
export function normalizeEan13(input) {
  const d = onlyDigits(input)
  if (d.length === 0) return { code: null, error: 'Enter a barcode number.' }
  if (d.length < 12) return { code: null, error: `Needs 12 or 13 digits — that's ${d.length}.` }
  if (d.length > 13) return { code: null, error: `Too long — ${d.length} digits (max 13).` }

  const body = d.slice(0, 12)
  const cd = checkDigit(body)
  const code = body + cd
  const corrected = d.length === 13 && d[12] !== String(cd)
  return { code, corrected, error: null }
}

/**
 * The 95-module bar pattern for a code, as a string of '0'/'1'.
 * Throws if the code isn't a valid 13-digit EAN.
 */
export function encodeEan13(code) {
  const d = onlyDigits(code)
  if (d.length !== 13) throw new Error('EAN-13 needs exactly 13 digits.')

  const parity = PARITY[Number(d[0])]
  let bits = '101' // start guard
  for (let i = 1; i <= 6; i++) {
    const digit = Number(d[i])
    bits += parity[i - 1] === 'L' ? L[digit] : G[digit]
  }
  bits += '01010' // centre guard
  for (let i = 7; i <= 12; i++) {
    bits += R[Number(d[i])]
  }
  bits += '101' // end guard
  return bits
}

/** Generate a random, valid 13-digit EAN under a numbering prefix. */
export function randomEan13(prefix = '200') {
  const p = onlyDigits(prefix).slice(0, 11) || '200'
  let body = p
  while (body.length < 12) body += Math.floor(Math.random() * 10)
  return body + checkDigit(body)
}
