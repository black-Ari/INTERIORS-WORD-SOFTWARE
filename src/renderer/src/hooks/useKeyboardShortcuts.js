import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Global keyboard shortcut hook.
 * F8 → Sales, F9 → Purchase, Alt+C → Add Customer/Vendor,
 * Ctrl+K → Focus search, Ctrl+S → Save, Escape → go back.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  const handleKeyDown = useCallback(
    (e) => {
      const tag = e.target.tagName.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select'

      if (e.key === 'F8') {
        e.preventDefault()
        navigate('/sales-invoice')
        return
      }

      if (e.key === 'F9') {
        e.preventDefault()
        navigate('/purchase-entry')
        return
      }

      if (e.key === 'F10') {
        e.preventDefault()
        window.api?.openWBManager?.()
        return
      }

      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:add-contact'))
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:focus-search'))
        return
      }

      if (e.key === 'Escape' && !isTyping) {
        e.preventDefault()
        navigate(-1)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:save'))
        return
      }
    },
    [navigate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
