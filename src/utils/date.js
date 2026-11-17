// Shared date helpers used by History / Ledger / Reports screens.

export function dayKey(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10) // YYYY-MM-DD
}

export function dayLabel(key) {
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

export function todayKey() {
  return dayKey(new Date().toISOString())
}

// YYYY-MM-DD key for N days ago (inclusive of today when n = 0)
export function daysAgoKey(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dayKey(d.toISOString())
}

export function startOfMonthKey() {
  const d = new Date()
  return dayKey(new Date(d.getFullYear(), d.getMonth(), 1).toISOString())
}

// Returns true if the record's date key falls within [from, to] (inclusive).
// Empty from/to means "no lower/upper bound".
export function inRange(dateStr, from, to) {
  const key = dayKey(dateStr)
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}

export function rangeLabel(from, to) {
  if (!from && !to) return 'All Time'
  if (from && to && from === to) return dayLabel(from)
  if (from && to) return `${dayLabel(from)} — ${dayLabel(to)}`
  if (from) return `From ${dayLabel(from)}`
  return `Up to ${dayLabel(to)}`
}
