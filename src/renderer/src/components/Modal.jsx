import React, { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Reusable modal dialog with portal rendering, perfect screen-centering,
 * glassmorphism, responsive auto-adjust, focus trap, and Escape-to-close.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - title: string
 *  - children: ReactNode
 *  - size: 'sm' | 'md' | 'lg' | 'xl' (default 'md')
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isOpen, onClose])

  // Focus trap
  const trapFocus = useCallback(
    (e) => {
      if (!panelRef.current || e.key !== 'Tab') return
      const focusable = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('keydown', trapFocus)
    // Auto-focus first input
    setTimeout(() => {
      const firstInput = panelRef.current?.querySelector('input, select, textarea, button')
      firstInput?.focus()
    }, 100)
    return () => window.removeEventListener('keydown', trapFocus)
  }, [isOpen, trapFocus])

  // Click outside to close
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto animate-fade-in"
      style={{
        backgroundColor: 'rgba(10, 15, 29, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)'
      }}
    >
      <div
        ref={panelRef}
        className={`
          w-full ${sizeClasses[size] || sizeClasses.md}
          glass-panel p-0 rounded-2xl shadow-2xl
          animate-scale-in
          flex flex-col overflow-hidden
          my-auto
        `}
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          maxHeight: 'min(90vh, 860px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--border-color)'
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b rounded-t-2xl"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}
          >
            <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6 py-5"
          style={{ color: 'var(--text-primary)' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
