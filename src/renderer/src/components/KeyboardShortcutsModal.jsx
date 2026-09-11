import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'

const shortcutGroups = [
  {
    group: '🧭 Navigation (Global)',
    items: [
      { keys: ['F2', 'Ctrl+1'],  label: 'Go to Dashboard' },
      { keys: ['F8', 'Ctrl+2'],  label: 'Go to Sales Invoice' },
      { keys: ['F9', 'Ctrl+3'],  label: 'Go to Purchase Entry' },
      { keys: ['F4', 'Ctrl+4'],  label: 'Go to Ledger Master' },
      { keys: ['F5', 'Ctrl+5'],  label: 'Go to Item Master' },
      { keys: ['F6', 'Ctrl+6'],  label: 'Go to Reports' },
      { keys: ['F10', 'Ctrl+7'], label: 'Go to WhatsApp Manager' },
      { keys: ['F12', 'Ctrl+8'], label: 'Go to Settings' },
    ]
  },
  {
    group: '🧾 Invoices & Billing Actions',
    items: [
      { keys: ['Ctrl+S'],        label: 'Save / Submit Voucher' },
      { keys: ['Ctrl+P'],        label: 'Print Invoice / Save PDF' },
      { keys: ['Alt+N', 'Ins'],  label: 'Add New Line Item Row' },
      { keys: ['Alt+Delete'],    label: 'Remove Selected / Last Item Row' },
      { keys: ['Alt+C'],         label: 'Quick Add Customer / Vendor' },
      { keys: ['Alt+I'],         label: 'Quick Add Product / Item' },
      { keys: ['Alt+W'],         label: 'Send Invoice via WhatsApp' },
    ]
  },
  {
    group: '👥 Master Management',
    items: [
      { keys: ['Alt+N', 'Ctrl+N'], label: 'Create New Ledger / Item' },
      { keys: ['Ctrl+S'],          label: 'Save Modal Form' },
      { keys: ['Ctrl+F', 'Ctrl+K'],label: 'Focus Search Filter' },
      { keys: ['Escape'],          label: 'Close Active Modal / Dialog' },
    ]
  },
  {
    group: '📊 Reports & WhatsApp',
    items: [
      { keys: ['Alt+O'],         label: 'Open Bills PDF Folder' },
      { keys: ['Ctrl+Enter'],    label: 'Send WhatsApp Message' },
      { keys: ['Ctrl+F'],        label: 'Focus Reports Filter' },
    ]
  },
  {
    group: '⚙️ App & View Controls',
    items: [
      { keys: ['Ctrl+K'],        label: 'Global Quick Search' },
      { keys: ['Ctrl+\\'],       label: 'Collapse / Expand Sidebar' },
      { keys: ['Ctrl+D'],        label: 'Toggle Dark / Light Theme' },
      { keys: ['F11'],           label: 'Toggle Fullscreen Window' },
      { keys: ['F1', 'Ctrl+/'],  label: 'Show This Shortcuts Guide' },
      { keys: ['Escape'],        label: 'Go Back / Close Popup' },
    ]
  }
]

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return shortcutGroups
    const q = search.toLowerCase().trim()
    return shortcutGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.label.toLowerCase().includes(q) ||
          item.keys.some(k => k.toLowerCase().includes(q))
        )
      }))
      .filter(group => group.items.length > 0)
  }, [search])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
      style={{ background: 'rgba(10, 15, 29, 0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl animate-scale-in my-auto overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <span className="text-xl">⌨️</span>
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                Keyboard Shortcuts Guide
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  v3.4.0
                </span>
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Full Tally / Busy function keys + Modern desktop shortcuts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shortcuts (e.g., 'save', 'print', 'F8', 'customer')..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-teal-500"
              style={{
                background: 'var(--bg-body)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Shortcuts Grid */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No shortcuts found matching "{search}"
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.group} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-accent)' }}>
                  <span>{group.group}</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-2 rounded-lg border transition-colors"
                      style={{
                        background: 'var(--bg-body)',
                        borderColor: 'var(--border-color)'
                      }}
                    >
                      <span className="text-xs font-medium pr-2 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, i) => (
                          <React.Fragment key={k}>
                            <kbd
                              className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded shadow-sm"
                              style={{
                                color: '#ef4444',
                                background: 'rgba(239,68,68,0.08)',
                                border: '1px solid rgba(239,68,68,0.22)',
                              }}
                            >
                              {k}
                            </kbd>
                            {i < item.keys.length - 1 && (
                              <span className="text-[10px] text-slate-400">/</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer tip */}
        <div
          className="px-6 py-3 border-t text-center text-xs flex items-center justify-between shrink-0"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          <span>💡 Tip: Press <kbd className="font-mono font-bold text-red-500">F1</kbd> anytime to open this guide</span>
          <span>Press <kbd className="font-mono font-bold text-red-500">Escape</kbd> to close</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
