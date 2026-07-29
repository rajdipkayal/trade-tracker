import React, { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { calculatePnL, DEFAULT_CHARGE_RATES } from './utils/charges.js'
import { groupPnLByPeriod, computeOverallStats, buildCumulativeSeries } from './utils/stats.js'

const LS_TRADES = 'trade-tracker:trades'
const LS_RATES = 'trade-tracker:rates'

function loadTrades() {
  try {
    const raw = localStorage.getItem(LS_TRADES)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadRates() {
  try {
    const raw = localStorage.getItem(LS_RATES)
    return raw ? { ...DEFAULT_CHARGE_RATES, ...JSON.parse(raw) } : DEFAULT_CHARGE_RATES
  } catch {
    return DEFAULT_CHARGE_RATES
  }
}

const fmtRs = (n) =>
  `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`

export default function App() {
  const [trades, setTrades] = useState(loadTrades)
  const [rates, setRates] = useState(loadRates)
  const [tab, setTab] = useState('dashboard') // dashboard | trades | add | settings
  const [period, setPeriod] = useState('monthly')
  const [selectedTradeId, setSelectedTradeId] = useState(null)

  useEffect(() => {
    localStorage.setItem(LS_TRADES, JSON.stringify(trades))
  }, [trades])

  useEffect(() => {
    localStorage.setItem(LS_RATES, JSON.stringify(rates))
  }, [rates])

  const closedTrades = useMemo(() => trades.filter((t) => t.status === 'closed'), [trades])
  const openTrades = useMemo(() => trades.filter((t) => t.status === 'open'), [trades])

  const stats = useMemo(() => computeOverallStats(closedTrades), [closedTrades])
  const periodData = useMemo(() => groupPnLByPeriod(closedTrades, period), [closedTrades, period])
  const cumulativeSeries = useMemo(() => buildCumulativeSeries(closedTrades), [closedTrades])

  function addTrade(form) {
    const base = {
      id: uuidv4(),
      symbol: form.symbol.toUpperCase(),
      positionType: form.positionType,
      tradeType: form.tradeType,
      quantity: Number(form.quantity),
      entryPrice: Number(form.entryPrice),
      entryDate: form.entryDate,
      exitPrice: form.exitPrice ? Number(form.exitPrice) : null,
      exitDate: form.exitDate || null,
      status: form.exitPrice ? 'closed' : 'open',
      journal: form.journal || '',
      images: [],
    }

    if (base.status === 'closed') {
      const { grossPnL, netPnL, charges } = calculatePnL(base, rates)
      base.grossPnL = grossPnL
      base.netPnL = netPnL
      base.charges = charges
    }

    setTrades((prev) => [base, ...prev])
    setTab('trades')
  }

  function closeTrade(id, exitPrice, exitDate) {
    setTrades((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const updated = { ...t, exitPrice: Number(exitPrice), exitDate, status: 'closed' }
        const { grossPnL, netPnL, charges } = calculatePnL(updated, rates)
        return { ...updated, grossPnL, netPnL, charges }
      })
    )
  }

  function deleteTrade(id) {
    setTrades((prev) => prev.filter((t) => t.id !== id))
  }

  function updateJournal(id, journal, images) {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, journal, images } : t)))
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">📈</span>
          <span>Trade Tracker</span>
        </div>
        <nav className="tabs">
          {[
            ['dashboard', 'Dashboard'],
            ['trades', 'Trades'],
            ['add', 'Add Trade'],
            ['settings', 'Settings'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`tab-btn ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {tab === 'dashboard' && (
          <Dashboard
            stats={stats}
            periodData={periodData}
            period={period}
            setPeriod={setPeriod}
            cumulativeSeries={cumulativeSeries}
            openTrades={openTrades}
          />
        )}

        {tab === 'add' && <AddTradeForm onAdd={addTrade} />}

        {tab === 'trades' && (
          <TradesList
            trades={trades}
            onClose={closeTrade}
            onDelete={deleteTrade}
            onSelect={setSelectedTradeId}
          />
        )}

        {tab === 'settings' && <SettingsPanel rates={rates} setRates={setRates} />}
      </main>

      {selectedTradeId && (
        <JournalModal
          trade={trades.find((t) => t.id === selectedTradeId)}
          onClose={() => setSelectedTradeId(null)}
          onSave={updateJournal}
        />
      )}

      <style>{styles}</style>
    </div>
  )
}

// ---------------- Dashboard ----------------
function Dashboard({ stats, periodData, period, setPeriod, cumulativeSeries, openTrades }) {
  return (
    <div className="dashboard">
      <div className="stat-grid">
        <StatCard
          label="Net P&L (all time)"
          value={fmtRs(stats.totalNetPnL)}
          positive={stats.totalNetPnL >= 0}
          icon={stats.totalNetPnL >= 0 ? '📈' : '📉'}
        />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.wins}W / ${stats.losses}L / ${stats.breakeven}BE`} />
        <StatCard label="Total Charges Paid" value={fmtRs(stats.totalCharges)} muted />
        <StatCard label="Open Positions" value={openTrades.length} muted />
      </div>

      <div className="card">
        <h3>Cumulative Net P&L</h3>
        {cumulativeSeries.length === 0 ? (
          <EmptyState text="Close some trades to see your equity curve here." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cumulativeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
              <XAxis dataKey="index" stroke="#8a92a3" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8a92a3" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: '#1a1e27', border: '1px solid #2a2f3a' }}
                formatter={(v) => [fmtRs(v), 'Cumulative Net P&L']}
                labelFormatter={(i) => `Trade #${i}`}
              />
              <Line type="monotone" dataKey="netPnL" stroke="#4fd1c5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <div className="card-header-row">
          <h3>P&L by Period</h3>
          <div className="period-switch">
            {['weekly', 'monthly', 'quarterly', 'yearly'].map((p) => (
              <button
                key={p}
                className={`chip ${period === p ? 'chip-active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {periodData.length === 0 ? (
          <EmptyState text="No closed trades yet for this view." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={periodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
              <XAxis dataKey="period" stroke="#8a92a3" tick={{ fontSize: 11 }} />
              <YAxis stroke="#8a92a3" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: '#1a1e27', border: '1px solid #2a2f3a' }}
                formatter={(v) => [fmtRs(v), 'Net P&L']}
              />
              <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
                {periodData.map((d, i) => (
                  <Cell key={i} fill={d.netPnL >= 0 ? '#48bb78' : '#f56565'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <table className="mini-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Trades</th>
              <th>Gross P&L</th>
              <th>Charges</th>
              <th>Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {periodData.map((d) => (
              <tr key={d.period}>
                <td>{d.period}</td>
                <td>{d.trades}</td>
                <td>{fmtRs(d.grossPnL)}</td>
                <td>{fmtRs(d.charges)}</td>
                <td className={d.netPnL >= 0 ? 'positive' : 'negative'}>{fmtRs(d.netPnL)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, positive, muted, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
        {label}
      </div>
      <div
        className={`stat-value ${
          muted ? '' : positive === true ? 'positive' : positive === false ? 'negative' : ''
        }`}
      >
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>
}

// ---------------- Add Trade Form ----------------
function AddTradeForm({ onAdd }) {
  const [form, setForm] = useState({
    symbol: '',
    positionType: 'long',
    tradeType: 'delivery',
    quantity: '',
    entryPrice: '',
    entryDate: new Date().toISOString().slice(0, 10),
    exitPrice: '',
    exitDate: '',
    journal: '',
  })

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function submit(e) {
    e.preventDefault()
    if (!form.symbol || !form.quantity || !form.entryPrice || !form.entryDate) return
    onAdd(form)
    setForm({
      symbol: '',
      positionType: 'long',
      tradeType: 'delivery',
      quantity: '',
      entryPrice: '',
      entryDate: new Date().toISOString().slice(0, 10),
      exitPrice: '',
      exitDate: '',
      journal: '',
    })
  }

  return (
    <div className="card form-card">
      <h3>Add Trade</h3>
      <form onSubmit={submit} className="form-grid">
        <label>
          Symbol
          <input value={form.symbol} onChange={(e) => set('symbol', e.target.value)} placeholder="RELIANCE" required />
        </label>

        <label>
          Position
          <select value={form.positionType} onChange={(e) => set('positionType', e.target.value)}>
            <option value="long">Long (Buy first)</option>
            <option value="short">Short (Sell first)</option>
          </select>
        </label>

        <label>
          Trade Type
          <select value={form.tradeType} onChange={(e) => set('tradeType', e.target.value)}>
            <option value="delivery">Delivery</option>
            <option value="intraday">Intraday</option>
          </select>
        </label>

        <label>
          Quantity
          <input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
        </label>

        <label>
          Entry Price (₹)
          <input type="number" step="0.01" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} required />
        </label>

        <label>
          Entry Date
          <input type="date" value={form.entryDate} onChange={(e) => set('entryDate', e.target.value)} required />
        </label>

        <label>
          Exit Price (₹) <span className="optional">optional — leave blank for open position</span>
          <input type="number" step="0.01" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} />
        </label>

        <label>
          Exit Date
          <input type="date" value={form.exitDate} onChange={(e) => set('exitDate', e.target.value)} />
        </label>

        <label className="full-width">
          Journal Note
          <textarea
            rows={3}
            value={form.journal}
            onChange={(e) => set('journal', e.target.value)}
            placeholder="Why did you take this trade? Setup, mistake, learning..."
          />
        </label>

        <button type="submit" className="primary-btn full-width">
          Save Trade
        </button>
      </form>
    </div>
  )
}

// ---------------- Trades List ----------------
function TradesList({ trades, onClose, onDelete, onSelect }) {
  const [closingId, setClosingId] = useState(null)
  const [exitPrice, setExitPrice] = useState('')
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10))

  if (trades.length === 0) {
    return (
      <div className="card">
        <EmptyState text="No trades yet. Go to 'Add Trade' to log your first one." />
      </div>
    )
  }

  return (
    <div className="card">
      <h3>All Trades ({trades.length})</h3>
      <div className="table-wrap">
        <table className="trades-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Charges</th>
              <th>Net P&L</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id}>
                <td className="symbol-cell" onClick={() => onSelect(t.id)}>
                  {t.symbol} {t.journal || t.images?.length ? '📝' : ''}
                </td>
                <td>
                  <span className={`badge ${t.positionType}`}>{t.positionType}</span>
                </td>
                <td>{t.tradeType}</td>
                <td>{t.quantity}</td>
                <td>₹{t.entryPrice}</td>
                <td>{t.exitPrice ? `₹${t.exitPrice}` : '—'}</td>
                <td>{t.charges ? fmtRs(t.charges.totalCharges) : '—'}</td>
                <td className={t.netPnL >= 0 ? 'positive' : t.netPnL < 0 ? 'negative' : ''}>
                  {t.netPnL !== undefined ? fmtRs(t.netPnL) : '—'}
                </td>
                <td>
                  <span className={`status ${t.status}`}>{t.status}</span>
                </td>
                <td className="row-actions">
                  {t.status === 'open' &&
                    (closingId === t.id ? (
                      <span className="close-inline">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Exit price"
                          value={exitPrice}
                          onChange={(e) => setExitPrice(e.target.value)}
                        />
                        <input type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
                        <button
                          className="small-btn"
                          onClick={() => {
                            if (!exitPrice) return
                            onClose(t.id, exitPrice, exitDate)
                            setClosingId(null)
                            setExitPrice('')
                          }}
                        >
                          ✓
                        </button>
                      </span>
                    ) : (
                      <button className="small-btn" onClick={() => setClosingId(t.id)}>
                        Close
                      </button>
                    ))}
                  <button className="small-btn danger" onClick={() => onDelete(t.id)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------- Journal Modal ----------------
function JournalModal({ trade, onClose, onSave }) {
  const [journal, setJournal] = useState(trade?.journal || '')
  const [images, setImages] = useState(trade?.images || [])

  if (!trade) return null

  function handleFiles(files) {
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setImages((prev) => [...prev, reader.result])
      reader.readAsDataURL(file)
    })
  }

  function save() {
    onSave(trade.id, journal, images)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {trade.symbol} — {trade.positionType} · {trade.tradeType}
          </h3>
          <button className="small-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {trade.netPnL !== undefined && (
          <div className={`modal-pnl ${trade.netPnL >= 0 ? 'positive' : 'negative'}`}>
            Net P&L: {fmtRs(trade.netPnL)} (Gross {fmtRs(trade.grossPnL)}, Charges{' '}
            {fmtRs(trade.charges.totalCharges)})
          </div>
        )}

        {trade.charges && (
          <div className="charges-breakdown">
            <div>Brokerage: {fmtRs(trade.charges.brokerage)}</div>
            <div>STT: {fmtRs(trade.charges.stt)}</div>
            <div>Exchange charges: {fmtRs(trade.charges.exchangeTxnCharges)}</div>
            <div>SEBI fee: {fmtRs(trade.charges.sebiFee)}</div>
            <div>Stamp duty: {fmtRs(trade.charges.stampDuty)}</div>
            <div>GST: {fmtRs(trade.charges.gst)}</div>
          </div>
        )}

        <label>
          Journal
          <textarea rows={5} value={journal} onChange={(e) => setJournal(e.target.value)} />
        </label>

        <label>
          Attach chart screenshots
          <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
        </label>

        {images.length > 0 && (
          <div className="image-grid">
            {images.map((src, i) => (
              <div key={i} className="image-thumb-wrap">
                <img src={src} alt={`journal-${i}`} className="image-thumb" />
                <button className="thumb-remove" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="primary-btn full-width" onClick={save}>
          Save Journal
        </button>
      </div>
    </div>
  )
}

// ---------------- Settings ----------------
function SettingsPanel({ rates, setRates }) {
  function set(field, value) {
    setRates((r) => ({ ...r, [field]: Number(value) }))
  }

  const fields = [
    ['brokerageFlat', 'Brokerage flat fee per order (₹)'],
    ['brokeragePercent', 'Brokerage % of turnover per order'],
    ['sttDeliveryPercent', 'STT % — Delivery (both legs)'],
    ['sttIntradayPercent', 'STT % — Intraday (sell leg only)'],
    ['exchangeTxnPercent', 'Exchange transaction charge %'],
    ['sebiPercent', 'SEBI turnover fee %'],
    ['stampDutyDeliveryPercent', 'Stamp duty % — Delivery (buy leg)'],
    ['stampDutyIntradayPercent', 'Stamp duty % — Intraday (buy leg)'],
    ['gstPercent', 'GST % on (brokerage + exchange + SEBI)'],
  ]

  return (
    <div className="card form-card">
      <h3>Charge Rate Settings</h3>
      <p className="hint">
        These defaults are approximate. Check your broker's contract note and edit these to match exactly.
      </p>
      <div className="form-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input type="number" step="0.001" value={rates[key]} onChange={(e) => set(key, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  )
}

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .app {
    min-height: 100vh;
    background: #0f1117;
    color: #e6e8ee;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #151822;
    border-bottom: 1px solid #232838;
    flex-wrap: wrap;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .brand { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn {
    background: transparent; border: 1px solid #2a2f3a; color: #b7bdc9;
    padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 14px;
  }
  .tab-btn.active { background: #4fd1c5; color: #08201d; border-color: #4fd1c5; font-weight: 600; }
  .main { max-width: 1100px; margin: 0 auto; padding: 20px; }
  .dashboard { display: flex; flex-direction: column; gap: 20px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
  .stat-card { background: #151822; border: 1px solid #232838; border-radius: 12px; padding: 16px; }
  .stat-label { font-size: 13px; color: #8a92a3; margin-bottom: 6px; }
  .stat-value { font-size: 24px; font-weight: 700; }
  .stat-sub { font-size: 12px; color: #8a92a3; margin-top: 4px; }
  .positive { color: #48bb78; }
  .negative { color: #f56565; }
  .card { background: #151822; border: 1px solid #232838; border-radius: 12px; padding: 18px; }
  .card h3 { margin-top: 0; }
  .card-header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  .period-switch { display: flex; gap: 6px; }
  .chip { background: #1c2130; border: 1px solid #2a2f3a; color: #b7bdc9; padding: 6px 12px; border-radius: 999px; cursor: pointer; font-size: 13px; }
  .chip-active { background: #4fd1c5; color: #08201d; border-color: #4fd1c5; font-weight: 600; }
  .empty-state { text-align: center; padding: 40px 0; color: #6b7385; }
  .mini-table, .trades-table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
  .mini-table th, .mini-table td, .trades-table th, .trades-table td {
    padding: 8px 10px; text-align: left; border-bottom: 1px solid #232838;
  }
  .table-wrap { overflow-x: auto; }
  .symbol-cell { cursor: pointer; font-weight: 600; }
  .symbol-cell:hover { text-decoration: underline; }
  .badge { padding: 2px 8px; border-radius: 6px; font-size: 12px; text-transform: capitalize; }
  .badge.long { background: rgba(72,187,120,0.15); color: #48bb78; }
  .badge.short { background: rgba(245,101,101,0.15); color: #f56565; }
  .status { font-size: 12px; text-transform: capitalize; color: #8a92a3; }
  .status.open { color: #f6ad55; }
  .status.closed { color: #48bb78; }
  .row-actions { display: flex; gap: 6px; align-items: center; white-space: nowrap; }
  .small-btn { background: #1c2130; border: 1px solid #2a2f3a; color: #e6e8ee; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; }
  .small-btn.danger { border-color: #f56565; color: #f56565; }
  .close-inline { display: flex; gap: 4px; }
  .close-inline input { width: 90px; padding: 4px 6px; background: #0f1117; border: 1px solid #2a2f3a; color: #e6e8ee; border-radius: 6px; font-size: 12px; }
  .form-card { max-width: 700px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-grid label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #b7bdc9; }
  .form-grid .full-width { grid-column: 1 / -1; }
  .form-grid input, .form-grid select, .form-grid textarea {
    background: #0f1117; border: 1px solid #2a2f3a; color: #e6e8ee; padding: 10px; border-radius: 8px; font-size: 14px;
  }
  .optional { font-size: 11px; color: #6b7385; font-weight: 400; }
  .primary-btn { background: #4fd1c5; color: #08201d; border: none; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; margin-top: 6px; }
  .hint { color: #8a92a3; font-size: 13px; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
  .modal { background: #151822; border: 1px solid #232838; border-radius: 12px; padding: 20px; max-width: 560px; width: 100%; max-height: 85vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; }
  .modal-pnl { font-weight: 700; font-size: 15px; }
  .charges-breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 13px; color: #b7bdc9; background: #0f1117; padding: 10px; border-radius: 8px; }
  .modal label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #b7bdc9; }
  .modal textarea, .modal input { background: #0f1117; border: 1px solid #2a2f3a; color: #e6e8ee; padding: 10px; border-radius: 8px; font-size: 14px; }
  .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; }
  .image-thumb-wrap { position: relative; }
  .image-thumb { width: 100%; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #2a2f3a; }
  .thumb-remove { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 11px; }
  @media (max-width: 640px) {
    .form-grid { grid-template-columns: 1fr; }
    .charges-breakdown { grid-template-columns: 1fr; }
  }
`
