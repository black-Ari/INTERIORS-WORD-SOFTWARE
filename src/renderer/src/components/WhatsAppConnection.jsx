import React from 'react'

const statusLabels = {
  disconnected: 'Not connected',
  connecting: 'Starting WhatsApp Web',
  qr: 'Scan the QR code',
  authenticated: 'Verifying account',
  ready: 'Connected',
  error: 'Connection error'
}

export default function WhatsAppConnection({ state, onConnect, onDisconnect }) {
  const status = state?.status || 'disconnected'
  const isBusy = ['connecting', 'authenticated'].includes(status)
  const isReady = status === 'ready'

  return (
    <div
      className="rounded-xl border p-4 flex flex-wrap items-center gap-4"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(22,163,74,0.1)' }}>
        <span aria-hidden="true">💬</span>
      </div>
      <div className="min-w-[180px] flex-1">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>WhatsApp billing</p>
        <p className="text-xs" style={{ color: isReady ? '#16a34a' : 'var(--text-muted)' }}>
          {statusLabels[status] || status}
        </p>
      </div>
      {status === 'qr' && state.qr && (
        <div className="flex items-center gap-3 w-full md:w-auto">
          <img src={state.qr} alt="WhatsApp login QR code" className="w-28 h-28 border rounded-lg" />
          <p className="text-xs max-w-[190px]" style={{ color: 'var(--text-muted)' }}>
            Open WhatsApp on your phone, choose Linked devices, then scan this code.
          </p>
        </div>
      )}
      {state?.error && <p className="text-xs text-red-600 max-w-xs">{state.error}</p>}
      {isReady ? (
        <button
          onClick={onDisconnect}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ color: '#dc2626', borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)' }}
        >
          Disconnect
        </button>
      ) : (
        <button
          onClick={onConnect}
          disabled={isBusy || status === 'qr'}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: '#16a34a' }}
        >
          {status === 'qr' ? 'Waiting for scan' : isBusy ? 'Connecting...' : 'Connect WhatsApp'}
        </button>
      )}
    </div>
  )
}
