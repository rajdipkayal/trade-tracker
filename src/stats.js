// Helpers to group closed trades into week/month/quarter/year buckets
// and compute win-rate / summary stats.

export function getWeekKey(date) {
  const d = new Date(date)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function getMonthKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getQuarterKey(date) {
  const d = new Date(date)
  const q = Math.floor(d.getMonth() / 3) + 1
  return `${d.getFullYear()}-Q${q}`
}

export function getYearKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}`
}

const KEY_FN = {
  weekly: getWeekKey,
  monthly: getMonthKey,
  quarterly: getQuarterKey,
  yearly: getYearKey,
}

export function groupPnLByPeriod(closedTrades, period = 'monthly') {
  const keyFn = KEY_FN[period]
  const map = new Map()

  for (const t of closedTrades) {
    const key = keyFn(t.exitDate)
    const existing = map.get(key) || { period: key, netPnL: 0, grossPnL: 0, charges: 0, trades: 0 }
    existing.netPnL += t.netPnL
    existing.grossPnL += t.grossPnL
    existing.charges += t.charges.totalCharges
    existing.trades += 1
    map.set(key, existing)
  }

  return Array.from(map.values())
    .sort((a, b) => (a.period > b.period ? 1 : -1))
    .map((r) => ({
      ...r,
      netPnL: Math.round(r.netPnL * 100) / 100,
      grossPnL: Math.round(r.grossPnL * 100) / 100,
      charges: Math.round(r.charges * 100) / 100,
    }))
}

export function computeOverallStats(closedTrades) {
  const total = closedTrades.length
  const wins = closedTrades.filter((t) => t.netPnL > 0).length
  const losses = closedTrades.filter((t) => t.netPnL < 0).length
  const breakeven = total - wins - losses
  const winRate = total > 0 ? (wins / total) * 100 : 0

  const totalNetPnL = closedTrades.reduce((s, t) => s + t.netPnL, 0)
  const totalGrossPnL = closedTrades.reduce((s, t) => s + t.grossPnL, 0)
  const totalCharges = closedTrades.reduce((s, t) => s + t.charges.totalCharges, 0)

  const avgWin =
    wins > 0
      ? closedTrades.filter((t) => t.netPnL > 0).reduce((s, t) => s + t.netPnL, 0) / wins
      : 0
  const avgLoss =
    losses > 0
      ? closedTrades.filter((t) => t.netPnL < 0).reduce((s, t) => s + t.netPnL, 0) / losses
      : 0

  return {
    total,
    wins,
    losses,
    breakeven,
    winRate: Math.round(winRate * 100) / 100,
    totalNetPnL: Math.round(totalNetPnL * 100) / 100,
    totalGrossPnL: Math.round(totalGrossPnL * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
  }
}

export function buildCumulativeSeries(closedTrades) {
  const sorted = [...closedTrades].sort((a, b) => new Date(a.exitDate) - new Date(b.exitDate))
  let running = 0
  return sorted.map((t, i) => {
    running += t.netPnL
    return {
      index: i + 1,
      date: t.exitDate,
      symbol: t.symbol,
      netPnL: Math.round(running * 100) / 100,
    }
  })
}
