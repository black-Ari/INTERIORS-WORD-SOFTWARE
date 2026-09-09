import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

const shortcuts = [
  { group: 'Navigation', items: [
    { keys: ['F8'],        label: 'New Sales Invoice' },
    { keys: ['F9'],        label: 'New Purchase Entry' },
    { keys: ['Ctrl','K'],  label: 'Global Search' },
    { keys: ['F1','?'],    label: 'Show Shortcuts Help' },
  ]},
  { group: 'Invoice Actions', items: [
    { keys: ['Ctrl','S'],  label: 'Save / Submit' },
    { keys: ['Ctrl','P'],  label: 'Print Invoice (PDF)' },
    { keys: ['Enter'],     label: 'Move to next field' },
    { keys: ['Tab'],       label: 'Next input in form' },
  ]},
  { group: 'Tables & Lists', items: [
    { keys: ['↑','↓'],     label: 'Navigate rows' },
    { keys: ['Delete'],    label: 'Remove selected row' },
    { keys: ['Ctrl','Z'],  label: 'Undo last action' },
  ]},
  { group: 'App', items: [
    { keys: ['F11'],       label: 'Toggle Fullscreen' },
    { keys: ['Ctrl','\\'], label: 'Collapse / Expand Sidebar' },
    { keys: ['Ctrl','D'],  label: 'Toggle Dark Mode' },
    { keys: ['Escape'],    label: 'Close modal / dialog' },
  ]},
]

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
      style={{ background: 'rgba(10, 15, 29, 0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl animate-scale-in my-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Keyboard Shortcuts
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Press any shortcut key anywhere in the app
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

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {shortcuts.map((group) => (
            <div key={group.group} className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-accent)' }}>
                {group.group}
              </p>
              {group.items.map((item) => (
                <div key={item.label} className="shortcut-row">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {item.keys.map((k, i) => (
                      <React.Fragment key={k}>
                        <kbd
                          className="kbd-badge"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            padding: '2px 6px',
                            height: '22px',
                            color: '#ef4444',
                            background: 'rgba(239,68,68,0.06)',
                            border: '1px solid rgba(239,68,68,0.18)',
                            borderRadius: '5px',
                          }}
                        >{k}</kbd>
                        {i < item.keys.length - 1 && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div
          className="px-6 py-3 border-t text-center text-xs"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          Press <kbd style={{ color: '#ef4444', fontWeight: 700 }}>Escape</kbd> or click outside to close
        </div>
      </div>
    </div>,
    document.body
  )
}
