import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const ToastContext = createContext(null)

/* ── Icons ─────────────────────────────────────────────────────── */
const icons = {
  success: (
    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.88A1 1 0 002.56 20h18.88a1 1 0 00.87-1.26l-8.6-14.88a1 1 0 00-1.72 0z" />
    </svg>
  )
}

const bgColors = {
  success: 'border-emerald-200 bg-emerald-50',
  error: 'border-red-200 bg-red-50',
  info: 'border-blue-200 bg-blue-50',
  warning: 'border-amber-200 bg-amber-50'
}

/* ── Single Toast ──────────────────────────────────────────────── */
function ToastItem({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 200)
    }, toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border
        shadow-sm min-w-[320px] max-w-[420px]
        ${bgColors[toast.type] || bgColors.info}
        ${isExiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}
        transition-all duration-200 ease-out
      `}
      style={{ animation: isExiting ? 'none' : 'slideInRight 0.3s ease-out' }}
    >
      <div className="shrink-0 mt-0.5">{icons[toast.type] || icons.info}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-slate-800 mb-0.5">{toast.title}</p>
        )}
        <p className="text-sm text-slate-600 leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={() => {
          setIsExiting(true)
          setTimeout(() => onDismiss(toast.id), 200)
        }}
        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

/* ── Provider ──────────────────────────────────────────────────── */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const addToast = useCallback(({ type = 'info', title, message, duration = 3000 }) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, type, title, message, duration }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    {
      success: (message, title) => addToast({ type: 'success', message, title }),
      error: (message, title) => addToast({ type: 'error', message, title }),
      info: (message, title) => addToast({ type: 'info', message, title }),
      warning: (message, title) => addToast({ type: 'warning', message, title })
    },
    [addToast]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container — fixed top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ── Hook ──────────────────────────────────────────────────────── */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
