// All rates are approximate defaults based on common Indian discount-broker
// structures for NSE equity (as of general market convention). Rates change
// over time and vary by broker/segment — edit them in the Settings panel
// to match your actual broker/contract note.

export const DEFAULT_CHARGE_RATES = {
  // Brokerage
  brokerageMode: 'flat_or_percent', // charges min(flatFee, percent*turnover) per leg, like most discount brokers
  brokerageFlat: 20, // Rs per executed order (per leg)
  brokeragePercent: 0.03, // % of turnover per leg

  // STT - Securities Transaction Tax
  sttDeliveryPercent: 0.1, // % on BOTH buy & sell, delivery equity
  sttIntradayPercent: 0.025, // % on SELL side only, intraday equity

  // Exchange transaction charges (NSE approx)
  exchangeTxnPercent: 0.00297, // % of turnover, both legs

  // SEBI turnover fee
  sebiPercent: 0.0001, // % of turnover, both legs

  // Stamp duty (buy side only)
  stampDutyDeliveryPercent: 0.015,
  stampDutyIntradayPercent: 0.003,

  // GST
  gstPercent: 18, // % on (brokerage + exchange txn charges + SEBI fee)
}

/**
 * Calculate all estimated statutory + broker charges for a single trade.
 * @param {Object} trade
 * @param {number} trade.entryPrice
 * @param {number} trade.exitPrice
 * @param {number} trade.quantity
 * @param {'long'|'short'} trade.positionType
 * @param {'intraday'|'delivery'} trade.tradeType
 * @param {Object} rates - override rates (defaults to DEFAULT_CHARGE_RATES)
 */
export function calculateCharges(trade, rates = DEFAULT_CHARGE_RATES) {
  const { entryPrice, exitPrice, quantity, positionType, tradeType } = trade

  // Buy/Sell turnover depends on long vs short
  // Long: buy at entry, sell at exit
  // Short: sell at entry, buy at exit (cover)
  const buyPrice = positionType === 'long' ? entryPrice : exitPrice
  const sellPrice = positionType === 'long' ? exitPrice : entryPrice

  const buyTurnover = buyPrice * quantity
  const sellTurnover = sellPrice * quantity
  const totalTurnover = buyTurnover + sellTurnover

  // Brokerage - charged per leg (buy leg + sell leg)
  const perLegBrokerage = (legTurnover) => {
    if (rates.brokerageFlat === 0 && rates.brokeragePercent === 0) return 0
    const pctAmount = legTurnover * (rates.brokeragePercent / 100)
    return Math.min(rates.brokerageFlat, pctAmount === 0 ? rates.brokerageFlat : pctAmount)
  }
  const brokerage = perLegBrokerage(buyTurnover) + perLegBrokerage(sellTurnover)

  // STT
  let stt = 0
  if (tradeType === 'delivery') {
    stt = totalTurnover * (rates.sttDeliveryPercent / 100)
  } else {
    stt = sellTurnover * (rates.sttIntradayPercent / 100)
  }

  // Exchange transaction charges
  const exchangeTxnCharges = totalTurnover * (rates.exchangeTxnPercent / 100)

  // SEBI turnover fee
  const sebiFee = totalTurnover * (rates.sebiPercent / 100)

  // Stamp duty - buy side only
  const stampDutyPercent =
    tradeType === 'delivery' ? rates.stampDutyDeliveryPercent : rates.stampDutyIntradayPercent
  const stampDuty = buyTurnover * (stampDutyPercent / 100)

  // GST on brokerage + exchange txn charges + sebi fee
  const gst = (brokerage + exchangeTxnCharges + sebiFee) * (rates.gstPercent / 100)

  const totalCharges = brokerage + stt + exchangeTxnCharges + sebiFee + stampDuty + gst

  return {
    brokerage: round2(brokerage),
    stt: round2(stt),
    exchangeTxnCharges: round2(exchangeTxnCharges),
    sebiFee: round2(sebiFee),
    stampDuty: round2(stampDuty),
    gst: round2(gst),
    totalCharges: round2(totalCharges),
    totalTurnover: round2(totalTurnover),
  }
}

export function calculatePnL(trade, rates = DEFAULT_CHARGE_RATES) {
  const { entryPrice, exitPrice, quantity, positionType } = trade
  const grossPnL =
    positionType === 'long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity

  const charges = calculateCharges(trade, rates)
  const netPnL = grossPnL - charges.totalCharges

  return {
    grossPnL: round2(grossPnL),
    netPnL: round2(netPnL),
    charges,
  }
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
