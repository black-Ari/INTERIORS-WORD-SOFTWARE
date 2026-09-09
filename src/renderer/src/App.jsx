import React, { Suspense, useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { ThemeProvider } from './context/ThemeContext'
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal'

const Dashboard     = React.lazy(() => import('./pages/Dashboard'))
const SalesInvoice  = React.lazy(() => import('./pages/SalesInvoice'))
const PurchaseEntry = React.lazy(() => import('./pages/PurchaseEntry'))
const LedgerMaster  = React.lazy(() => import('./pages/LedgerMaster'))
const ItemMaster    = React.lazy(() => import('./pages/ItemMaster'))
const Reports       = React.lazy(() => import('./pages/Reports'))
const Settings      = React.lazy(() => import('./pages/Settings'))
const WhatsAppManager = React.lazy(() => import('./pages/WhatsAppManager'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center animate-pulse"
          style={{ boxShadow: '0 0 20px rgba(13,148,136,0.4)' }}
        >
          <span className="text-white font-bold text-sm">IW</span>
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function AppShell({ onOpenShortcuts }) {
  useKeyboardShortcuts()
  return (
    <Layout onOpenShortcuts={onOpenShortcuts}>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                element={<Dashboard />} />
            <Route path="/sales-invoice"   element={<SalesInvoice />} />
            <Route path="/purchase-entry"  element={<PurchaseEntry />} />
            <Route path="/ledgers"         element={<LedgerMaster />} />
            <Route path="/items"           element={<ItemMaster />} />
            <Route path="/reports"         element={<Reports />} />
            <Route path="/settings"        element={<Settings />} />
            <Route path="/whatsapp"        element={<WhatsAppManager />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  )
}

export default function App() {
  const [showShortcuts, setShowShortcuts] = useState(false)

  // F1 or ? key opens shortcuts modal
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'F1') { e.preventDefault(); setShowShortcuts(true) }
    if (e.key === '?' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
      setShowShortcuts(true)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <ThemeProvider>
      <ToastProvider>
        <HashRouter>
          <AppShell onOpenShortcuts={() => setShowShortcuts(true)} />
          <KeyboardShortcutsModal
            isOpen={showShortcuts}
            onClose={() => setShowShortcuts(false)}
          />
        </HashRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
