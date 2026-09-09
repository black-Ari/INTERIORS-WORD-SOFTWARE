import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable'
import MiniChart from '../components/MiniChart'
import { formatCurrency, formatDate } from '../utils/formatters'
import { useToast } from '../components/Toast'

const api = window.api

export default function Reports() {
  const toast    = useToast()
  const navigate = useNavigate()
  const [tab,         setTab]         = useState('sales')
  const [data,        setData]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showChart,   setShowChart]   = useState(true)
  const [whatsappState, setWhatsappState] = useState({ status: 'disconnected' })

  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate:   new Date().toISOString().split('T')[0]
  })

  /* ── Actions ───────────────────────────────────────────────────── */
  async function handleDelete(id) {
    if (confirm('Delete this bill? Stock will be reversed and this cannot be undone.')) {
      try {
        await api.voucherDelete(id)
        toast.success('Bill deleted successfully')
        loadData()
      } catch (e) {
        toast.error(e.message || 'Failed to delete bill')
      }
    }
  }

  async function handleSendWhatsApp(id, row) {
    try {
      const phone = (row?.ledger_phone || '').replace(/[^0-9]/g, '')
      if (phone) {
        const formattedPhone = phone.length === 10 ? `91${phone}` : phone
        const msg = encodeURIComponent(`Hello, here is your invoice #${row.voucher_number || ''} from Interiors World. Amount: Rs. ${row.net_amount || 0}`)
        window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank')
        toast.success(`Opening WhatsApp for ${row.ledger_name || phone}...`)
      } else {
        toast.info('Opening WB Manager...')
      }
      window.api?.openWBManager?.()
    } catch (e) {
      toast.error(e.message || 'Error opening WhatsApp')
    }
  }

  async function handleConnectWhatsApp() {
    try {
      await api.whatsappConnect()
    } catch (e) {
      toast.error(e.message || 'Could not start WhatsApp')
    }
  }

  async function handleDisconnectWhatsApp() {
    try {
      await api.whatsappDisconnect()
    } catch (e) {
      toast.error(e.message || 'Could not disconnect WhatsApp')
    }
  }

  /* ── Table columns ─────────────────────────────────────────────── */
  const actionBtns = (id, row, editPath) => (
    <div className="flex gap-1.5 justify-end">
      <button
        onClick={() => handleSendWhatsApp(id, row)}
        className="px-2 py-1 rounded text-xs font-medium transition-colors"
        style={{ color: '#16a34a', background: 'rgba(22,163,74,0.08)' }}
        title="Send via WhatsApp / WB Manager"
      >📱 Send</button>
      <button
        onClick={() => navigate(editPath)}
        className="px-2 py-1 rounded text-xs font-medium transition-colors"
        style={{ color: '#0d9488', background: 'rgba(13,148,136,0.08)' }}
      >✏️ Edit</button>
      <button
        onClick={() => handleDelete(id)}
        className="px-2 py-1 rounded text-xs font-medium transition-colors"
        style={{ color: '#dc2626', background: 'rgba(220,38,38,0.08)' }}
      >🗑️ Del</button>
    </div>
  )

  const salesColumns = [
    { key: 'date',           label: 'Date',        width: '12%', render: v => formatDate(v) },
    { key: 'voucher_number', label: 'Invoice No.',  width: '15%', render: v => <span className="font-mono text-xs font-semibold" style={{ color: '#0d9488' }}>{v}</span> },
    { key: 'ledger_name',    label: 'Customer',     width: '28%' },
    { key: 'total_tax',      label: 'Tax',          width: '13%', align: 'right', render: v => <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(v)}</span> },
    { key: 'net_amount',     label: 'Total Amount', width: '17%', align: 'right', render: v => <span className="font-bold text-emerald-600">{formatCurrency(v)}</span> },
    { key: 'id', label: '', width: '15%', align: 'right', render: (id, row) => actionBtns(id, row, `/sales-invoice?id=${id}`) }
  ]

  const purchaseColumns = [
    { key: 'date',           label: 'Date',        width: '12%', render: v => formatDate(v) },
    { key: 'voucher_number', label: 'Voucher No.',  width: '15%', render: v => <span className="font-mono text-xs font-semibold text-blue-600">{v}</span> },
    { key: 'ledger_name',    label: 'Vendor',       width: '28%' },
    { key: 'total_tax',      label: 'Tax',          width: '13%', align: 'right', render: v => <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(v)}</span> },
    { key: 'net_amount',     label: 'Total Amount', width: '17%', align: 'right', render: v => <span className="font-bold text-emerald-600">{formatCurrency(v)}</span> },
    { key: 'id', label: '', width: '15%', align: 'right', render: (id, row) => actionBtns(id, row, `/purchase-entry?id=${id}`) }
  ]

  const allColumns = [
    { key: 'date',         label: 'Date',       width: '12%', render: v => formatDate(v) },
    { key: 'voucher_type', label: 'Type',        width: '10%', render: v => (
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
          style={{
            background: v === 'sales' ? 'rgba(13,148,136,0.1)' : 'rgba(37,99,235,0.1)',
            color: v === 'sales' ? '#0d9488' : '#2563eb'
          }}
        >{v}</span>
    )},
    { key: 'voucher_number', label: 'Voucher No.', width: '15%', render: v => <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'ledger_name',    label: 'Party Name',  width: '23%' },
    { key: 'net_amount',     label: 'Amount',       width: '15%', align: 'right', render: v => <span className="font-bold text-emerald-600">{formatCurrency(v)}</span> },
    {
      key: 'id', label: '', width: '15%', align: 'right',
      render: (id, row) => actionBtns(id, row, row.voucher_type === 'sales' ? `/sales-invoice?id=${id}` : `/purchase-entry?id=${id}`)
    }
  ]

  /* ── Load data ─────────────────────────────────────────────────── */
  useEffect(() => { loadData() }, [tab, filters])

  useEffect(() => {
    let active = true
    api.whatsappStatus?.().then(state => {
      if (active && state) setWhatsappState(state)
    }).catch(() => {})
    const removeListener = api.onWhatsAppStatus?.(state => {
      if (active) setWhatsappState(state)
    })
    return () => {
      active = false
      removeListener?.()
    }
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      if (api?.voucherList) {
        const result = await api.voucherList({
          voucher_type: tab === 'all' ? undefined : tab,
          date_from: filters.startDate,
          date_to:   filters.endDate
        })
        setData(result || [])
      }
    } catch (e) {
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  /* ── Derived values ────────────────────────────────────────────── */
  const filteredData = useMemo(() => {
    if (!searchQuery) return data
    const q = searchQuery.toLowerCase()
    return data.filter(r =>
      (r.voucher_number || '').toLowerCase().includes(q) ||
      (r.ledger_name || '').toLowerCase().includes(q)
    )
  }, [data, searchQuery])

  const totals = useMemo(() =>
    filteredData.reduce((acc, r) => ({
      tax:    acc.tax    + (r.total_tax  || 0),
      amount: acc.amount + (r.net_amount || 0),
    }), { tax: 0, amount: 0 }),
  [filteredData])

  // Build chart data — group by date (day of month)
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return []
    const byDate = {}
    filteredData.forEach(r => {
      const d = (r.date || '').slice(8, 10) || '?'
      byDate[d] = (byDate[d] || 0) + (r.net_amount || 0)
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => Number(a) - Number(b))
      .slice(-12)
      .map(([label, value]) => ({ label, value }))
  }, [filteredData])

  const tabs = [
    { key: 'sales',    label: '🧾 Sales',    color: '#0d9488' },
    { key: 'purchase', label: '🛒 Purchase',  color: '#2563eb' },
    { key: 'all',      label: '📋 All',       color: '#6b7280' },
  ]

  const activeColor = tabs.find(t => t.key === tab)?.color || '#0d9488'

  return (
    <div className="space-y-5 max-w-7xl animate-page-enter">

      {/* ── Top Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Tab switcher */}
        <div
          className="flex items-center p-0.5 rounded-xl border gap-0.5"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: tab === t.key ? t.color : 'transparent',
                color:      tab === t.key ? 'white'  : 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Bills folder btn */}
        <button
          onClick={() => api?.openPDFFolder?.()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-secondary)',
          }}
        >
          📂 Bills Folder
        </button>

        {/* Chart toggle */}
        <button
          onClick={() => setShowChart(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all"
          style={{
            background: showChart ? 'rgba(13,148,136,0.08)' : 'var(--bg-card)',
            borderColor: showChart ? 'rgba(13,148,136,0.3)' : 'var(--border-color)',
            color: showChart ? '#0d9488' : 'var(--text-muted)',
          }}
        >
          📊 Chart
        </button>

        {/* Search + date filters */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border flex-1"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search invoice / customer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none flex-1"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>From</span>
            <input
              type="date" value={filters.startDate}
              onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              className="text-xs px-2 py-1.5 rounded-lg border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>To</span>
            <input
              type="date" value={filters.endDate}
              onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              className="text-xs px-2 py-1.5 rounded-lg border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </div>

      {/* ── WB Manager Quick Card ── */}
      <div
        className="rounded-xl border p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.03) 100%)',
          borderColor: 'rgba(16,185,129,0.25)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 shrink-0">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">WhatsApp Business Manager</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Launch WB Manager in a dedicated popup window to send invoices, manage chats, and broadcast campaigns.</p>
          </div>
        </div>
        <button
          onClick={() => window.api?.openWBManager?.()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all shrink-0 hover:scale-105 active:scale-95"
        >
          <span>Open WB Manager Popup</span>
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-700 text-emerald-100">F10</kbd>
        </button>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: `Total ${tab === 'sales' ? 'Invoices' : tab === 'purchase' ? 'Vouchers' : 'Records'}`,
            value: filteredData.length,
            icon: '📄',
            color: activeColor,
            bg: `${activeColor}15`,
          },
          {
            label: `Tax ${tab === 'purchase' ? 'Paid' : 'Collected'}`,
            value: formatCurrency(totals.tax),
            icon: '⚖️',
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
          },
          {
            label: 'Total Amount',
            value: formatCurrency(totals.amount),
            icon: '💰',
            color: '#059669',
            bg: 'rgba(5,150,105,0.1)',
          },
        ].map((card, i) => (
          <div
            key={card.label}
            className={`rounded-xl border p-4 flex items-center gap-4 animate-fade-in stagger-${i+1}`}
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: card.bg }}
            >
              {card.icon}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
                {card.label}
              </p>
              <p className="text-xl font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart (collapsible) ─────────────────────────────────── */}
      {showChart && chartData.length > 0 && (
        <div
          className="rounded-xl border p-5 animate-slide-down"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {tab === 'sales' ? '📈 Sales Trend' : tab === 'purchase' ? '📉 Purchase Trend' : '📊 Activity Trend'}
              <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-muted)' }}>(Daily breakdown)</span>
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {filters.startDate} — {filters.endDate}
            </p>
          </div>
          <MiniChart data={chartData} height={100} color={activeColor} />
        </div>
      )}

      {/* ── Data Table ──────────────────────────────────────────── */}
      <div
        className="rounded-xl border overflow-hidden animate-fade-in-up stagger-2"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <DataTable
          columns={tab === 'all' ? allColumns : tab === 'sales' ? salesColumns : purchaseColumns}
          data={filteredData}
          emptyMessage={loading ? 'Loading report data...' : `No ${tab} records found for selected date range.`}
        />
      </div>
    </div>
  )
}
