import React, { useState, useEffect, useRef } from 'react'

const api = window.api

function timeAgo(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen]           = useState(false)
  const [invoices, setInvoices]   = useState([])
  const [unread, setUnread]       = useState(0)
  const dropRef = useRef(null)

  useEffect(() => {
    loadRecent()
    const id = setInterval(loadRecent, 60000) // refresh every minute
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function loadRecent() {
    try {
      const data = await api?.voucherList?.({ type: 'sales', limit: 5 })
      if (Array.isArray(data)) {
        setInvoices(data.slice(0, 5))
        setUnread(data.slice(0, 5).length)
      }
    } catch (_) {}
  }

  function handleOpen() {
    setOpen(v => !v)
    if (!open) setUnread(0)
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors group"
        title="Recent Activity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-notif-dot"
            style={{ lineHeight: 1 }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notif-dropdown absolute right-0 mt-2 w-80 z-50"
          style={{ top: '100%' }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recent Invoices
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">
              Last 5
            </span>
          </div>

          {/* List */}
          <div className="py-1 max-h-72 overflow-y-auto">
            {invoices.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-2xl mb-2">📄</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No recent invoices</p>
              </div>
            ) : invoices.map((inv, i) => (
              <div
                key={inv.id || i}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-default animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {inv.ledger_name || 'Unknown Customer'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-teal-600">{inv.voucher_number}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(inv.date)}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 shrink-0">
                  ₹{Number(inv.net_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2.5 border-t text-center"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <button
              className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
              onClick={() => { setOpen(false); window.location.hash = '#/reports' }}
            >
              View all invoices →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
