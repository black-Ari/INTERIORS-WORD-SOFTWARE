import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency, formatDate } from '../utils/formatters'
import MiniChart from '../components/MiniChart'

const api = window.api

/* ── Stat Card ─────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color, bgColor, delayClass, trend }) {
  return (
    <div className={`stat-card p-5 animate-fade-in-up ${delayClass || ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: bgColor }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              color: trend >= 0 ? '#059669' : '#dc2626',
              background: trend >= 0 ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
            }}
          >
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold animate-count-up" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

/* ── Quick Action Card ─────────────────────────────────────────── */
function QuickAction({ icon, label, shortcut, onClick, gradient, delayClass }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-fade-in-up ${delayClass || ''}`}
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm group-hover:scale-110 transition-transform"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
      {shortcut && (
        <span
          className="px-2 py-0.5 text-[10px] font-mono rounded shrink-0"
          style={{
            background: 'rgba(239,68,68,0.06)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.15)',
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  )
}

/* ── Main Dashboard ────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate  = useNavigate()
  const todayStr  = new Date().toISOString().slice(0, 10)

  const [filterType, setFilterType] = useState('today')
  const [dateFrom,   setDateFrom]   = useState(todayStr)
  const [dateTo,     setDateTo]     = useState(todayStr)

  const [stats, setStats] = useState({
    todaySalesTotal:    0,
    todaySalesCount:    0,
    todayPurchaseTotal: 0,
    todayPurchaseCount: 0,
    totalCustomers:     0,
    totalItems:         0,
    recentInvoices:     [],
    monthlyTrend:       [],
  })
  const [loading, setLoading] = useState(true)

  /* ── Date range from filter type ─── */
  useEffect(() => {
    const t = new Date()
    if (filterType === 'today') {
      const d = t.toISOString().slice(0, 10)
      setDateFrom(d); setDateTo(d)
    } else if (filterType === 'this_month') {
      setDateFrom(new Date(t.getFullYear(), t.getMonth(), 1).toISOString().slice(0, 10))
      setDateTo(new Date(t.getFullYear(), t.getMonth() + 1, 0).toISOString().slice(0, 10))
    } else if (filterType === 'this_year') {
      setDateFrom(new Date(t.getFullYear(), 0, 1).toISOString().slice(0, 10))
      setDateTo(new Date(t.getFullYear(), 11, 31).toISOString().slice(0, 10))
    }
  }, [filterType])

  useEffect(() => {
    if (dateFrom && dateTo) loadStats()
  }, [dateFrom, dateTo])

  async function loadStats() {
    try {
      setLoading(true)
      if (api?.dashboardStats) {
        const data = await api.dashboardStats({ date_from: dateFrom, date_to: dateTo })
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  /* ── Build monthly chart data (last 6 months) ─── */
  const chartData = React.useMemo(() => {
    if (stats.monthlyTrend?.length > 0) return stats.monthlyTrend
    // Fallback: generate last 6 months labels with 0 values
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      return { label: months[d.getMonth()], value: 0 }
    })
  }, [stats.monthlyTrend])

  const today    = new Date()
  const hour     = today.getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const greetEmoji = hour < 12 ? '🌤️' : hour < 17 ? '☀️' : '🌙'

  const profit = (stats.todaySalesTotal || 0) - (stats.todayPurchaseTotal || 0)

  return (
    <div className="space-y-6 max-w-7xl animate-page-enter">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {greetEmoji} {greeting}!
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Filter controls */}
        <div
          className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl border shadow-sm"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm rounded-lg py-1.5 pl-3 pr-7"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)' }}
          >
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Date</option>
          </select>

          {filterType === 'custom' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="text-sm rounded-lg py-1.5 px-2 border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
              <input
                type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="text-sm rounded-lg py-1.5 px-2 border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label={filterType === 'today' ? "Today's Sales" : 'Total Sales'}
          value={loading ? '...' : formatCurrency(stats.todaySalesTotal || 0)}
          color="#0d9488"
          bgColor="rgba(13,148,136,0.1)"
          delayClass="stagger-1"
        />
        <StatCard
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>}
          label={filterType === 'today' ? "Today's Purchases" : 'Total Purchases'}
          value={loading ? '...' : formatCurrency(stats.todayPurchaseTotal || 0)}
          color="#2563eb"
          bgColor="rgba(37,99,235,0.1)"
          delayClass="stagger-2"
        />
        <StatCard
          icon={<svg className="w-5 h-5" style={{ color: profit >= 0 ? '#059669' : '#dc2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          label="Profit / Loss"
          value={loading ? '...' : formatCurrency(profit)}
          color={profit >= 0 ? '#059669' : '#dc2626'}
          bgColor={profit >= 0 ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)'}
          delayClass="stagger-3"
        />
        <StatCard
          icon={<svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          label={filterType === 'today' ? 'Sales Invoices' : 'Total Invoices'}
          value={loading ? '...' : (stats.todaySalesCount || 0)}
          color="#7c3aed"
          bgColor="rgba(124,58,237,0.1)"
          delayClass="stagger-4"
        />
      </div>

      {/* ── Chart + Quick Actions ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Monthly Trend Chart */}
        <div
          className="lg:col-span-2 rounded-xl border p-5 animate-fade-in-up stagger-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Monthly Sales Trend</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Last 6 months performance</p>
            </div>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(13,148,136,0.08)', color: '#0d9488' }}
            >
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              Sales
            </div>
          </div>
          <MiniChart data={chartData} height={130} color="#0d9488" />
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Quick Actions</h3>
          <QuickAction
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
            label="New Sales Invoice"
            shortcut="F8"
            onClick={() => navigate('/sales-invoice')}
            gradient="linear-gradient(135deg, #14b8a6, #0d9488)"
            delayClass="stagger-1"
          />
          <QuickAction
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4" /></svg>}
            label="New Purchase Entry"
            shortcut="F9"
            onClick={() => navigate('/purchase-entry')}
            gradient="linear-gradient(135deg, #3b82f6, #2563eb)"
            delayClass="stagger-2"
          />
          <QuickAction
            icon={<svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
            label="Open WB Manager"
            shortcut="F10"
            onClick={() => window.api?.openWBManager?.()}
            gradient="linear-gradient(135deg, #10b981, #059669)"
            delayClass="stagger-3"
          />
          <QuickAction
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
            label="Add Customer"
            onClick={() => navigate('/ledgers')}
            gradient="linear-gradient(135deg, #0ea5e9, #0284c7)"
            delayClass="stagger-4"
          />
          <QuickAction
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
            label="Add Product"
            onClick={() => navigate('/items')}
            gradient="linear-gradient(135deg, #a855f7, #7c3aed)"
            delayClass="stagger-5"
          />
        </div>
      </div>

      {/* ── Recent Invoices ─────────────────────────────────────── */}
      <div className="animate-fade-in-up stagger-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Recent Invoices</h3>
          <button
            onClick={() => navigate('/reports')}
            className="text-xs font-medium transition-colors"
            style={{ color: 'var(--text-accent)' }}
          >
            View all →
          </button>
        </div>

        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border-color)`, background: 'rgba(0,0,0,0.02)' }}>
                {['Date', 'Invoice #', 'Customer', 'Amount'].map((h, i) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)', textAlign: i === 3 ? 'right' : 'left' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                        ))}
                      </div>
                      <span className="text-xs">Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              ) : (stats.recentInvoices || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-3xl mb-2">📄</p>
                    <p className="font-medium">No invoices yet</p>
                    <p className="text-xs mt-1">Create your first sales invoice to get started!</p>
                  </td>
                </tr>
              ) : (
                (stats.recentInvoices || []).map((inv, i) => (
                  <tr
                    key={inv.id || i}
                    className="data-table-row animate-fade-in"
                    style={{
                      borderBottom: `1px solid var(--border-color)`,
                      animationDelay: `${i * 50}ms`,
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/sales-invoice?id=${inv.id}`)}
                  >
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(inv.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-accent)' }}>
                        {inv.voucher_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {inv.ledger_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {formatCurrency(inv.net_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
