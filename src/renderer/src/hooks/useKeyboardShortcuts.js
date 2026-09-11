import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Universal keyboard shortcuts hook for INTERIORS WORD ERP.
 * 
 * Supports both Indian Accounting Standards (Tally/Busy F-keys) and Modern Desktop shortcuts:
 * - F1 / Ctrl+/ / ?      → Show Keyboard Shortcuts Cheat Sheet
 * - F2 / Ctrl+1 / Alt+1  → Dashboard
 * - F8 / Ctrl+2 / Alt+2  → Sales Invoice
 * - F9 / Ctrl+3 / Alt+3  → Purchase Entry
 * - F4 / Ctrl+4 / Alt+4  → Ledger Master
 * - F5 / Ctrl+5 / Alt+5  → Item Master (overriding browser reload)
 * - F6 / Ctrl+6 / Alt+6  → Reports
 * - F10 / Ctrl+7 / Alt+7 → WhatsApp Business Manager
 * - F12 / Ctrl+8 / Alt+8 / Ctrl+, → Settings
 * - Ctrl+S / Alt+S       → Save Voucher / Entry / Form
 * - Ctrl+P / Alt+P       → Print / PDF Bill
 * - Ctrl+N / Alt+N       → Add New Item / Row / Voucher
 * - Alt+C                → Quick Add Contact / Customer / Vendor
 * - Alt+I                → Quick Add Item
 * - Alt+W                → Send Invoice & Bill PDF via WhatsApp
 * - Alt+O                → Open PDF Bills Folder
 * - Ctrl+K / Ctrl+F      → Focus Global Search
 * - Escape               → Close Modal / Back
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  const handleKeyDown = useCallback(
    (e) => {
      const tag = e.target?.tagName?.toLowerCase() || ''
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable
      const ctrlOrMeta = e.ctrlKey || e.metaKey

      // 1. HELP & SHORTCUTS MODAL: F1 or Ctrl+/
      if (e.key === 'F1' || (ctrlOrMeta && e.key === '/')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:open-shortcuts'))
        return
      }

      // 2. DASHBOARD: F2 or Ctrl+1 or Alt+1
      if (e.key === 'F2' || (ctrlOrMeta && e.key === '1') || (e.altKey && e.key === '1')) {
        e.preventDefault()
        navigate('/')
        return
      }

      // 3. SALES INVOICE: F8 or Ctrl+2 or Alt+2
      if (e.key === 'F8' || (ctrlOrMeta && e.key === '2') || (e.altKey && e.key === '2')) {
        e.preventDefault()
        navigate('/sales-invoice')
        return
      }

      // 4. PURCHASE ENTRY: F9 or Ctrl+3 or Alt+3
      if (e.key === 'F9' || (ctrlOrMeta && e.key === '3') || (e.altKey && e.key === '3')) {
        e.preventDefault()
        navigate('/purchase-entry')
        return
      }

      // 5. LEDGER MASTER: F4 or Ctrl+4 or Alt+4
      if (e.key === 'F4' || (ctrlOrMeta && e.key === '4') || (e.altKey && e.key === '4')) {
        e.preventDefault()
        navigate('/ledgers')
        return
      }

      // 6. ITEM MASTER: F5 or Ctrl+5 or Alt+5
      if (e.key === 'F5' || (ctrlOrMeta && e.key === '5') || (e.altKey && e.key === '5')) {
        e.preventDefault()
        navigate('/items')
        return
      }

      // 7. REPORTS: F6 or Ctrl+6 or Alt+6
      if (e.key === 'F6' || (ctrlOrMeta && e.key === '6') || (e.altKey && e.key === '6')) {
        e.preventDefault()
        navigate('/reports')
        return
      }

      // 8. WHATSAPP MANAGER: F10 or Ctrl+7 or Alt+7
      if (e.key === 'F10' || (ctrlOrMeta && e.key === '7') || (e.altKey && e.key === '7')) {
        e.preventDefault()
        navigate('/whatsapp')
        return
      }

      // 9. SETTINGS: F12 or Ctrl+8 or Alt+8 or Ctrl+,
      if (e.key === 'F12' || (ctrlOrMeta && e.key === '8') || (e.altKey && e.key === '8') || (ctrlOrMeta && e.key === ',')) {
        e.preventDefault()
        navigate('/settings')
        return
      }

      // 10. SAVE / SUBMIT: Ctrl+S or Alt+S
      if ((ctrlOrMeta && (e.key === 's' || e.key === 'S')) || (e.altKey && (e.key === 's' || e.key === 'S'))) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:save'))
        return
      }

      // 11. PRINT / PDF: Ctrl+P or Alt+P
      if ((ctrlOrMeta && (e.key === 'p' || e.key === 'P')) || (e.altKey && (e.key === 'p' || e.key === 'P'))) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:print'))
        return
      }

      // 12. NEW ROW / ENTRY: Ctrl+N or Alt+N or Insert
      if ((ctrlOrMeta && (e.key === 'n' || e.key === 'N')) || (e.altKey && (e.key === 'n' || e.key === 'N')) || e.key === 'Insert') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:new'))
        return
      }

      // 13. QUICK ADD CONTACT / CUSTOMER: Alt+C
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:add-contact'))
        return
      }

      // 14. QUICK ADD ITEM: Alt+I
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:add-item'))
        return
      }

      // 15. SEND WHATSAPP: Alt+W
      if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:whatsapp'))
        return
      }

      // 16. OPEN PDF BILLS FOLDER: Alt+O
      if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:open-folder'))
        return
      }

      // 17. GLOBAL SEARCH: Ctrl+K or Ctrl+F
      if (ctrlOrMeta && (e.key === 'k' || e.key === 'K' || e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:focus-search'))
        return
      }

      // 18. ESCAPE: Go back if not typing inside input
      if (e.key === 'Escape' && !isTyping) {
        e.preventDefault()
        navigate(-1)
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
