import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    shortcut: 'F2',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
      </svg>
    )
  },
  {
    to: '/sales-invoice',
    label: 'Sales Invoice',
    shortcut: 'F8',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    to: '/purchase-entry',
    label: 'Purchase Entry',
    shortcut: 'F9',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
      </svg>
    )
  },
  {
    to: '/ledgers',
    label: 'Ledger Master',
    shortcut: 'F4',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    to: '/items',
    label: 'Item Master',
    shortcut: 'F5',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  {
    to: '/reports',
    label: 'Reports',
    shortcut: 'F6',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    to: '/whatsapp',
    label: 'WhatsApp Manager',
    shortcut: 'F10',
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    )
  },
  {
    to: '/settings',
    label: 'Settings',
    shortcut: 'F12',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
]

export default function Sidebar({ onCollapse }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('iw-sidebar') === 'collapsed' } catch { return false }
  })

  function toggle() {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem('iw-sidebar', next ? 'collapsed' : 'expanded')
      onCollapse?.(next)
      return next
    })
  }

  // Ctrl+\ shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === '\\') { e.preventDefault(); toggle() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <aside
      className="h-screen flex flex-col border-r shrink-0"
      style={{
        width: collapsed ? '64px' : '220px',
        background: 'var(--bg-sidebar)',
        borderColor: 'var(--border-color)',
        transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* ── Logo + Toggle ── */}
      <div
        className="flex items-center border-b shrink-0"
        style={{
          height: 56,
          padding: collapsed ? '0 12px' : '0 16px',
          borderColor: 'var(--border-color)',
          justifyContent: collapsed ? 'center' : 'space-between',
          transition: 'padding 0.3s ease',
        }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25 shrink-0">
              <span className="text-white font-bold text-xs">IW</span>
            </div>
            <div className="overflow-hidden">
              <h1 className="text-[13px] font-bold tracking-wide leading-none" style={{ color: 'var(--text-primary)' }}>INTERIORS</h1>
              <p className="text-[9px] font-semibold tracking-[0.22em] text-teal-500 mt-0.5">WORD</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25 animate-fade-in">
            <span className="text-white font-bold text-xs">IW</span>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={toggle}
            title="Collapse sidebar (Ctrl+\\)"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors ml-1"
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}

        {collapsed && (
          <button
            onClick={toggle}
            title="Expand sidebar (Ctrl+\\)"
            className="absolute bottom-3 left-0 right-0 mx-auto w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: '16px',
              color: 'var(--text-muted)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav
        className="flex-1 py-2 overflow-y-auto space-y-0.5"
        style={{ padding: collapsed ? '8px 8px 60px' : '8px 8px 8px' }}
      >
        {navItems.map((item, idx) => (
          item.isAction ? (
            <button
              key={item.label}
              type="button"
              onClick={() => window.api?.openWBManager?.()}
              title={collapsed ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}` : 'Open WhatsApp Business Manager (F10)'}
              className={`w-full group flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 relative overflow-hidden animate-fade-in stagger-${idx + 1}
              ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'}
              hover:bg-emerald-50 text-slate-600 hover:text-emerald-700`}
            >
              <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                {item.icon}
              </span>
              {!collapsed && (
                <span className="flex-1 text-left truncate font-semibold text-emerald-700">{item.label}</span>
              )}
              {!collapsed && item.shortcut && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
                  {item.shortcut}
                </span>
              )}
            </button>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}` : ''}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 relative overflow-hidden animate-fade-in stagger-${idx + 1}
                ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'}
                ${isActive
                  ? 'bg-teal-50 text-teal-700'
                  : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? '#0f766e' : 'var(--text-secondary)',
                background: isActive ? 'rgba(13,148,136,0.08)' : undefined,
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && !collapsed && (
                    <span className="nav-active-indicator" />
                  )}
                  {isActive && collapsed && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-teal-500"
                    />
                  )}
                  <span className={`shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                  {!collapsed && item.shortcut && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-red-500 border border-slate-200 shrink-0">
                      {item.shortcut}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          )
        ))}
      </nav>

      {/* ── Footer ── */}
      {!collapsed && (
        <div
          className="px-4 py-3 border-t shrink-0 animate-fade-in"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Database Connected</span>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="py-3 flex justify-center shrink-0 pb-16">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Database Connected" />
        </div>
      )}
    </aside>
  )
}
