import { peso } from '../format'

// Calendar helpers for recurring-monthly bills. A bill has a `due_day` (1–31);
// these compute the real dates (clamping 29–31 to a short month's last day) and
// build the two client-side calendar hand-offs: an .ics download (Outlook /
// Apple Calendar) and an "Add to Google Calendar" link. Both create a MONTHLY
// recurring all-day event with a one-day-before reminder, so the user's own
// calendar app fires the notification — no backend or account linking needed.

const pad2 = (n) => String(n).padStart(2, '0')

export const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** The bill's occurrence within a given month, clamped to that month's length. */
export function occurrenceInMonth(dueDay, year, month) {
  return new Date(year, month, Math.min(dueDay, daysInMonth(year, month)))
}

/** This month's occurrence (whether or not it has already passed). */
export function occurrenceThisMonth(dueDay, from = new Date()) {
  const t = startOfDay(from)
  return occurrenceInMonth(dueDay, t.getFullYear(), t.getMonth())
}

/** The next date this bill falls on, at or after today. */
export function nextDueDate(dueDay, from = new Date()) {
  const today = startOfDay(from)
  const thisMonth = occurrenceThisMonth(dueDay, today)
  if (thisMonth >= today) return thisMonth
  const nm = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  return occurrenceInMonth(dueDay, nm.getFullYear(), nm.getMonth())
}

/** Whole days from today to `date` (negative = in the past). */
export function daysUntil(date, from = new Date()) {
  return Math.round((startOfDay(date) - startOfDay(from)) / 86400000)
}

/** "1st", "2nd", "15th", "22nd"… */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const icsDate = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`

// RFC 5545 text escaping for SUMMARY / DESCRIPTION values.
const esc = (s) =>
  String(s ?? '')
    .replace(/([,;\\])/g, '\\$1')
    .replace(/\r?\n/g, '\\n')

function describe(bill) {
  return [
    bill.amount != null ? `Amount: ${peso(bill.amount)}` : null,
    bill.issuer || null,
    bill.account_ref || null,
    bill.note || null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A self-contained .ics for a monthly recurring bill reminder. */
export function buildIcs(bill) {
  const start = nextDueDate(bill.due_day)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  const summary = `${bill.name} bill due`
  const desc = describe(bill)
  const uid = `${bill.id || Math.random().toString(36).slice(2)}@inventory-tracker`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inventory Tracker//Bills//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(end)}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${bill.due_day}`,
    `SUMMARY:${esc(summary)}`,
    desc ? `DESCRIPTION:${esc(desc)}` : null,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(summary + ' tomorrow')}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

/** "Add to Google Calendar" URL — opens a prefilled recurring-event template. */
export function googleCalendarUrl(bill) {
  const start = nextDueDate(bill.due_day)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${bill.name} bill due`,
    dates: `${icsDate(start)}/${icsDate(end)}`,
    recur: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${bill.due_day}`,
    details: describe(bill),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Trigger a browser download of the bill's .ics file. */
export function downloadIcs(bill) {
  const blob = new Blob([buildIcs(bill)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = String(bill.name || 'bill').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '')
  a.download = `${safe || 'bill'}-reminder.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
