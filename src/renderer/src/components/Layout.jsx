import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import { useTheme } from '../context/ThemeContext'

const api = window.api

const pageTitles = {
  '/':                'Dashboard',
  '/sales-invoice':   'Sales Invoice',
  '/purchase-entry':  'Purchase Entry',
  '/ledgers':         'Ledger Master',
  '/items':           'Item Master',
  '/reports':         'Reports',
  '/settings':        'Settings',
  '/whatsapp':        'WhatsApp Business Manager',
}

const pageIcons = {
  '/':                '🏠',
  '/sales-invoice':   '🧾',
  '/purchase-entry':  '🛒',
  '/ledgers':         '👥',
  '/items':           '📦',
  '/reports':         '📊',
  '/settings':        '⚙️',
  '/whatsapp':        '💬',
}

function getCurrentFY() {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const start = month >= 3 ? year : year - 1
  return `FY ${start}-${(start + 1).toString().slice(-2)}`
}

function Clock() {
  const [time, setTime] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex flex-col items-end">
      <span className="text-xs font-mono tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
        {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      </span>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
      </span>
    </div>
  )
}

function DarkModeToggle() {
  const { dark, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to Light Mode (Ctrl+D)' : 'Switch to Dark Mode (Ctrl+D)'}
      className="relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
      style={{ background: dark ? '#0d9488' : '#cbd5e1' }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center transition-all duration-300"
        style={{ left: dark ? '26px' : '2px' }}
      >
        {dark
          ? <span className="text-[10px]">🌙</span>
          : <span className="text-[10px]">☀️</span>
        }
      </span>
    </button>
  )
}

export default function Layout({ children, onOpenShortcuts }) {
  const location   = useLocation()
  const navigate   = useNavigate()
  const { dark }   = useTheme()
  const title      = pageTitles[location.pathname] || 'INTERIORS WORD'
  const pageIcon   = pageIcons[location.pathname] || '📋'
  const [appVersion, setAppVersion] = useState('3.3.0')
  const [company, setCompany]       = useState(null)

  useEffect(() => {
    window.api?.getVersion?.().then(v => { if (v) setAppVersion(v) }).catch(() => {})
    window.api?.companyGet?.().then(d => { if (d) setCompany(d) }).catch(() => {})
  }, [])

  // Ctrl+D toggles dark mode
  const { toggle } = useTheme()
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); toggle() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  const initials = company?.name
    ? company.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'IW'

  return (
    <div
      className="flex h-screen overflow-hidden transition-theme"
      style={{ background: 'var(--bg-body)' }}
    >
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ─── Header ─────────────────────────────────────────── */}
        <header
          className="shrink-0 flex items-center justify-between px-5 border-b relative z-40"
          style={{
            height: 56,
            background: 'var(--bg-header)',
            borderColor: 'var(--border-color)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* Page title */}
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{pageIcon}</span>
            <div>
              <h2 className="text-sm font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{getCurrentFY()}</p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <GlobalSearch />

            {/* Quick WB Manager Launch Button */}
            <button
              onClick={() => navigate('/whatsapp')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 shadow-sm transition-all hover:scale-105 active:scale-95"
              title="Open WhatsApp Business Manager (F10)"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="hidden sm:inline font-semibold">WhatsApp</span>
              <kbd className="hidden md:inline px-1 py-0.2 rounded text-[9px] font-mono bg-emerald-200/60 text-emerald-800">F10</kbd>
            </button>

            {/* Shortcut hints — hidden on small screens */}
            <div
              className="hidden lg:flex items-center gap-1.5 text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              {[
                { key: 'F2', label: 'Home' },
                { key: 'F8', label: 'Sales' },
                { key: 'F9', label: 'Purchase' },
                { key: 'Ctrl+K', label: 'Search' },
              ].map((sc, i, arr) => (
                <React.Fragment key={sc.key}>
                  <kbd
                    className="px-1.5 py-0.5 rounded font-mono"
                    style={{
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.18)',
                      color: '#ef4444',
                      fontSize: '9px',
                    }}
                  >{sc.key}</kbd>
                  <span>{sc.label}</span>
                  {i < arr.length - 1 && <span style={{ color: 'var(--border-color)' }}>·</span>}
                </React.Fragment>
              ))}

              <button
                onClick={onOpenShortcuts}
                className="ml-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors flex items-center gap-1 hover:bg-teal-50"
                style={{
                  background: 'rgba(13,148,136,0.08)',
                  color: 'var(--text-accent)',
                  border: '1px solid rgba(13,148,136,0.2)',
                }}
                title="Show all keyboard shortcuts (F1 or Ctrl+/)"
              >
                <span>⌨️</span>
                <span>Shortcuts</span>
                <kbd className="font-mono text-[9px] text-red-500 font-bold">F1</kbd>
              </button>
            </div>

            <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-color)' }} />

            <DarkModeToggle />

            <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-color)' }} />

            <NotificationBell />

            <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-color)' }} />

            <Clock />

            <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-color)' }} />

            {/* User avatar */}
            <button
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs border transition-all hover:scale-110 shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
                color: 'white',
                border: '2px solid rgba(13,148,136,0.3)',
                boxShadow: '0 2px 8px rgba(13,148,136,0.3)',
              }}
              title={company?.name || 'INTERIORS WORD'}
            >
              {initials}
            </button>
          </div>
        </header>

        {/* ─── Main Content ────────────────────────────────────── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ padding: '20px', background: 'var(--bg-body)' }}
        >
          {children}
        </main>

        {/* ─── Status Bar ─────────────────────────────────────── */}
        <footer
          className="shrink-0 flex items-center justify-between px-5 border-t"
          style={{
            height: 28,
            background: dark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
            borderColor: 'var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="font-medium">{getCurrentFY()}</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>INTERIORS WORD v{appVersion}</span>
            {company?.name && (
              <>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <span className="font-medium" style={{ color: 'var(--text-accent)' }}>{company.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Ready</span>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <span>{dark ? '🌙 Dark' : '☀️ Light'}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
