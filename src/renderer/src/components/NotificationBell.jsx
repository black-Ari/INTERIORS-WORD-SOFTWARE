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
  const [open, setOpen]                   = useState(false)
  const [invoices, setInvoices]           = useState([])
  const [unread, setUnread]               = useState(0)
  const [updateInfo, setUpdateInfo]       = useState(null)
  const [downloadProgress, setProgress]   = useState(null)
  const [downloadReady, setDownloadReady] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    loadRecent()
    const id = setInterval(loadRecent, 60000)
    return () => clearInterval(id)
  }, [])

  // Auto-updater event listeners
  useEffect(() => {
    const unsubs = []

    if (api?.updater) {
      // Check if update is already known
      api.updater.check().then((res) => {
        if (res && res.hasUpdate) {
          setUpdateInfo(res)
        }
      }).catch(() => {})

      unsubs.push(
        api.updater.onAvailable((info) => {
          if (info && info.hasUpdate) {
            setUpdateInfo(info)
          }
        })
      )

      unsubs.push(
        api.updater.onProgress((prog) => {
          setProgress(prog)
          setIsDownloading(true)
        })
      )

      unsubs.push(
        api.updater.onDownloaded(() => {
          setDownloadReady(true)
          setIsDownloading(false)
        })
      )
    }

    return () => {
      unsubs.forEach((fn) => typeof fn === 'function' && fn())
    }
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
    setOpen((v) => !v)
    if (!open) setUnread(0)
  }

  async function handleStartDownload() {
    if (!updateInfo?.downloadUrl) return
    try {
      setIsDownloading(true)
      await api?.updater?.download(updateInfo.downloadUrl)
    } catch (err) {
      setIsDownloading(false)
      alert(`Download failed: ${err.message}`)
    }
  }

  async function handleInstall() {
    try {
      await api?.updater?.install()
    } catch (err) {
      alert(`Install failed: ${err.message}`)
    }
  }

  const hasAlert = unread > 0 || !!updateInfo

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors group"
        title="Notifications & Updates"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg
          className="w-5 h-5 group-hover:scale-110 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {updateInfo ? (
          <span
            className="absolute -top-1 -right-1 px-1 py-0.2 rounded-full bg-emerald-500 text-white text-[8px] font-extrabold flex items-center justify-center animate-pulse"
            style={{ lineHeight: 1 }}
          >
            UP
          </span>
        ) : unread > 0 ? (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-notif-dot"
            style={{ lineHeight: 1 }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          className="notif-dropdown absolute right-0 mt-2 w-84 sm:w-96 rounded-2xl border shadow-2xl z-[100] overflow-hidden animate-scale-in"
          style={{
            top: '100%',
            background: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--border-color)',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
          >
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Notifications
              </p>
              {updateInfo && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  New Update
                </span>
              )}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400 font-medium border border-teal-500/30">
              Activity
            </span>
          </div>

          {/* Software Update Card (if new version available) */}
          {updateInfo && (
            <div
              className="p-3.5 m-3 rounded-xl border space-y-2.5 transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(13,148,136,0.06))',
                borderColor: 'rgba(16,185,129,0.3)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-400">
                      Update Available: {updateInfo.version}
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      {updateInfo.notes?.slice(0, 70) || 'Performance improvements and new features.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress bar or Action Button */}
              {isDownloading ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] font-semibold text-emerald-400">
                    <span>Downloading update in background...</span>
                    <span>{downloadProgress?.percent || 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${downloadProgress?.percent || 0}%` }}
                    />
                  </div>
                </div>
              ) : downloadReady ? (
                <button
                  onClick={handleInstall}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span>⚡</span> Restart & Apply Update
                </button>
              ) : (
                <button
                  onClick={handleStartDownload}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📥</span> Download & Update Now
                </button>
              )}
            </div>
          )}

          {/* Recent Invoices List */}
          <div className="py-1 max-h-72 overflow-y-auto divide-y divide-white/5">
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Recent Invoices (Last 5)
            </div>

            {invoices.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-2xl mb-1">📄</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No recent invoices recorded
                </p>
              </div>
            ) : (
              invoices.map((inv, i) => (
                <div
                  key={inv.id || i}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors cursor-default"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {inv.ledger_name || 'Unknown Customer'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-teal-400">{inv.voucher_number}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(inv.date)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0">
                    ₹{Number(inv.net_amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2.5 border-t text-center flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
          >
            <button
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
              onClick={() => {
                setOpen(false)
                window.location.hash = '#/reports'
              }}
            >
              View all invoices →
            </button>

            <button
              className="text-[11px] text-slate-400 hover:text-white transition-colors"
              onClick={() => {
                setOpen(false)
                window.location.hash = '#/settings'
              }}
            >
              Settings & Updates
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
