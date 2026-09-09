import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'

export default function WhatsAppManager() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // State
  const [activeTab, setActiveTab] = useState('connect')
  const [status, setStatus] = useState({ status: 'disconnected', number: '' })
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [logs, setLogs] = useState([])

  // Bulk Send State
  const [gridData, setGridData] = useState([
    { A: '', B: '', C: '', D: '' },
    { A: '', B: '', C: '', D: '' },
    { A: '', B: '', C: '', D: '' }
  ])
  const [columns, setColumns] = useState(['A', 'B', 'C', 'D'])
  const [messageTemplate, setMessageTemplate] = useState(
    'Namaste {B} ji! INTERIORS WORD me Designer Wallpapers, Premium Curtains aur Wooden Flooring ka naya collection launch hua hai. Free catalog dekhne ke liye reply karein! 🎉'
  )
  const [sendAt, setSendAt] = useState('')
  const [bulkProgress, setBulkProgress] = useState(null)
  const [isSendingBulk, setIsSendingBulk] = useState(false)

  // Auto-Reply State
  const [autoReply, setAutoReply] = useState({
    enabled: false,
    mode: 'simple',
    message: '',
    workingHours: {
      enabled: false,
      startTime: '09:00',
      endTime: '21:00',
      offlineMessage: ''
    },
    ai: {
      apiKey: '',
      model: '',
      persona: '',
      businessInfo: '',
      menuPricing: '',
      historyTurns: 12,
      maxRepliesPerContactPerDay: 100
    }
  })
  const [detectedProvider, setDetectedProvider] = useState({ name: 'No key entered yet' })
  const [previewInput, setPreviewInput] = useState('')
  const [previewReply, setPreviewReply] = useState('')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Orders State
  const [orders, setOrders] = useState([])
  const [orderFilter, setOrderFilter] = useState('all')
  const [alerts, setAlerts] = useState([])

  // Load initial status & settings
  useEffect(() => {
    let unsubs = []

    const init = async () => {
      try {
        if (window.api?.wa) {
          const currentStatus = await window.api.wa.getStatus()
          if (currentStatus) setStatus(currentStatus)

          const ar = await window.api.wa.getAutoReply()
          if (ar) {
            setAutoReply(ar)
            if (ar.ai?.apiKey) {
              const prov = await window.api.wa.detectProvider(ar.ai.apiKey)
              setDetectedProvider(prov)
            }
          }

          const ords = await window.api.wa.getOrders()
          if (ords) setOrders(ords)

          const alrts = await window.api.wa.getAlerts()
          if (alrts) setAlerts(alrts)
        }
      } catch (err) {
        console.error('Failed to load WhatsApp data:', err)
      }
    }
    init()

    if (window.api?.wa) {
      unsubs.push(
        window.api.wa.onQr((url) => {
          setQrCodeUrl(url)
          setStatus((prev) => ({ ...prev, status: 'qr' }))
        })
      )

      unsubs.push(
        window.api.wa.onStatus((payload) => {
          if (typeof payload === 'string') {
            setStatus((prev) => ({ ...prev, status: payload }))
          } else if (payload && payload.status) {
            setStatus(payload)
          }
          if (payload?.status === 'connected') {
            setQrCodeUrl('')
          }
        })
      )

      unsubs.push(
        window.api.wa.onLog((entry) => {
          setLogs((prev) => [entry, ...prev].slice(0, 300))
        })
      )

      unsubs.push(
        window.api.wa.onBulkProgress((prog) => {
          setBulkProgress(prog)
          if (prog.type === 'done') {
            setIsSendingBulk(false)
            showToast?.(`Bulk campaign finished: ${prog.sent} sent, ${prog.failed} failed`, 'success')
          }
        })
      )

      unsubs.push(
        window.api.wa.onOrderSummary((order) => {
          setOrders((prev) => [order, ...prev.filter((o) => o.id !== order.id)])
          showToast?.(`New inquiry/order captured: ${order.summary}`, 'info')
        })
      )

      unsubs.push(
        window.api.wa.onOwnerAlert((alert) => {
          setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)])
          showToast?.(`Owner Alert: ${alert.reason}`, 'warning')
        })
      )
    }

    return () => {
      unsubs.forEach((fn) => typeof fn === 'function' && fn())
    }
  }, [showToast])

  // Handlers
  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      await window.api?.wa?.connect()
      showToast?.('WhatsApp connection started. Please scan the QR code.', 'info')
    } catch (err) {
      showToast?.(`Connection failed: ${err.message}`, 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp? You will need to scan QR code again.')) return
    try {
      await window.api?.wa?.logout()
      setStatus({ status: 'disconnected', number: '' })
      setQrCodeUrl('')
      showToast?.('WhatsApp disconnected.', 'info')
    } catch (err) {
      showToast?.(`Logout failed: ${err.message}`, 'error')
    }
  }

  const handleResetSession = async () => {
    try {
      await window.api?.wa?.resetSession()
      setQrCodeUrl('')
      showToast?.('Resetting session... please wait for a new QR code.', 'info')
    } catch (err) {
      showToast?.(`Reset failed: ${err.message}`, 'error')
    }
  }

  // Import Customers from Billing Database
  const handleImportCustomers = async () => {
    try {
      const customers = await window.api?.wa?.getCustomerContacts()
      if (!customers || customers.length === 0) {
        showToast?.('No customer phone numbers found in ledger.', 'warning')
        return
      }

      const rows = customers.map((c) => ({
        A: c.phone || '',
        B: c.name || '',
        C: '',
        D: c.address || ''
      }))

      setGridData(rows)
      showToast?.(`Imported ${rows.length} customers into broadcast grid!`, 'success')
    } catch (err) {
      showToast?.(`Import failed: ${err.message}`, 'error')
    }
  }

  // Grid editing
  const handleCellChange = (rowIndex, col, value) => {
    const updated = [...gridData]
    updated[rowIndex] = { ...updated[rowIndex], [col]: value }
    setGridData(updated)
  }

  const handleAddRow = () => {
    const emptyRow = {}
    columns.forEach((c) => (emptyRow[c] = ''))
    setGridData([...gridData, emptyRow])
  }

  const handleAddColumn = () => {
    if (columns.length >= 8) return
    const nextCol = String.fromCharCode(65 + columns.length)
    setColumns([...columns, nextCol])
    setGridData(gridData.map((row) => ({ ...row, [nextCol]: '' })))
  }

  const handleClearGrid = () => {
    if (window.confirm('Clear all contacts in the table?')) {
      setGridData([
        { A: '', B: '', C: '', D: '' },
        { A: '', B: '', C: '', D: '' }
      ])
    }
  }

  // Paste from Excel
  const handlePaste = (e, rowIndex, colIndex) => {
    const clipData = e.clipboardData.getData('text')
    if (!clipData.includes('\t') && !clipData.includes('\n')) return // standard single-cell paste

    e.preventDefault()
    const rows = clipData
      .split(/\r?\n/)
      .map((r) => r.split('\t'))
      .filter((r) => r.some((cell) => cell.trim()))

    const newGrid = [...gridData]
    rows.forEach((rowVals, rOffset) => {
      const targetRow = rowIndex + rOffset
      if (!newGrid[targetRow]) {
        newGrid[targetRow] = {}
        columns.forEach((c) => (newGrid[targetRow][c] = ''))
      }
      rowVals.forEach((val, cOffset) => {
        const targetCol = columns[colIndex + cOffset]
        if (targetCol) {
          newGrid[targetRow][targetCol] = val.trim()
        }
      })
    })
    setGridData(newGrid)
    showToast?.(`Pasted ${rows.length} rows from clipboard!`, 'info')
  }

  // Template chips
  const applyTemplate = (text) => {
    setMessageTemplate(text)
    showToast?.('Template applied to message box!', 'info')
  }

  // Bulk send action
  const handleSendBulk = async () => {
    if (status.status !== 'connected') {
      showToast?.('WhatsApp is not connected. Please link your device first.', 'warning')
      setActiveTab('connect')
      return
    }

    const validContacts = gridData
      .filter((r) => r.A && String(r.A).replace(/[^0-9]/g, '').length >= 10)
      .map((r) => ({ phone: r.A, fields: r }))

    if (validContacts.length === 0) {
      showToast?.('Please enter at least one valid 10-digit phone number in Column A.', 'warning')
      return
    }

    if (!messageTemplate.trim()) {
      showToast?.('Please type a message to send.', 'warning')
      return
    }

    if (!window.confirm(`Ready to send messages to ${validContacts.length} contacts with anti-ban delays?`)) return

    try {
      setIsSendingBulk(true)
      setBulkProgress({ type: 'status', text: 'Starting campaign...', sent: 0, total: validContacts.length })
      await window.api?.wa?.sendBulk({
        contacts: validContacts,
        message: messageTemplate,
        sendAt: sendAt || null
      })
    } catch (err) {
      setIsSendingBulk(false)
      showToast?.(`Broadcast failed: ${err.message}`, 'error')
    }
  }

  // API Key Change
  const handleApiKeyChange = async (key) => {
    setAutoReply((prev) => ({
      ...prev,
      ai: { ...prev.ai, apiKey: key }
    }))
    if (key.trim()) {
      const prov = await window.api?.wa?.detectProvider(key)
      setDetectedProvider(prov)
    } else {
      setDetectedProvider({ name: 'No key entered yet' })
    }
  }

  // Save Settings
  const handleSaveAutoReply = async () => {
    try {
      setIsSavingSettings(true)
      const saved = await window.api?.wa?.saveAutoReply(autoReply)
      setAutoReply(saved)
      showToast?.('WhatsApp Auto-Reply settings saved successfully!', 'success')
    } catch (err) {
      showToast?.(`Failed to save settings: ${err.message}`, 'error')
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Test AI Reply
  const handlePreviewAi = async () => {
    if (!autoReply.ai?.apiKey?.trim()) {
      showToast?.('Please enter an AI API key first.', 'warning')
      return
    }
    if (!previewInput.trim()) {
      showToast?.('Please type a customer question to test.', 'warning')
      return
    }

    try {
      setIsPreviewing(true)
      setPreviewReply('Thinking...')
      const res = await window.api?.wa?.previewAiReply({
        apiKey: autoReply.ai.apiKey,
        model: autoReply.ai.model,
        persona: autoReply.ai.persona,
        businessInfo: autoReply.ai.businessInfo,
        menuPricing: autoReply.ai.menuPricing,
        incomingText: previewInput
      })
      setPreviewReply(res.text || 'No response')
    } catch (err) {
      setPreviewReply(`Error: ${err.message}`)
    } finally {
      setIsPreviewing(false)
    }
  }

  // Confirm / Reject Order
  const handleConfirmOrder = async (orderId) => {
    try {
      await window.api?.wa?.confirmOrder(orderId)
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: 'confirmed' } : o)))
      showToast?.('Order confirmed and WhatsApp message sent to customer!', 'success')
    } catch (err) {
      showToast?.(`Confirmation failed: ${err.message}`, 'error')
    }
  }

  const handleRejectOrder = async (orderId) => {
    const reason = window.prompt('Reason for rejection / unavailability (optional):', 'Product currently out of stock')
    if (reason === null) return
    try {
      await window.api?.wa?.rejectOrder(orderId, reason)
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: 'rejected' } : o)))
      showToast?.('Order rejection notification sent to customer.', 'info')
    } catch (err) {
      showToast?.(`Rejection failed: ${err.message}`, 'error')
    }
  }

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Delete this inquiry from list?')) return
    await window.api?.wa?.deleteOrder(orderId)
    setOrders(orders.filter((o) => o.id !== orderId))
  }

  const handleDismissAlert = async (alertId) => {
    await window.api?.wa?.dismissAlert(alertId)
    setAlerts(alerts.filter((a) => a.id !== alertId))
  }

  // Export CSV
  const handleExportOrders = () => {
    if (orders.length === 0) {
      showToast?.('No orders to export.', 'warning')
      return
    }
    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Items / Summary', 'Site Location', 'Status']
    const rows = orders.map((o) => [
      o.id,
      new Date(o.timestamp).toLocaleString(),
      `"${o.customerName || ''}"`,
      o.phone,
      `"${(o.summary || '').replace(/"/g, '""')}"`,
      `"${(o.deliveryLocation || '').replace(/"/g, '""')}"`,
      o.status
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `InteriorsWord_WhatsApp_Orders_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast?.('Exported orders to CSV!', 'success')
  }

  const filteredOrders = orders.filter((o) => (orderFilter === 'all' ? true : o.status === orderFilter))

  return (
    <div className="space-y-6 max-w-7xl animate-page-enter">
      {/* Top Header Card */}
      <div
        className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              WhatsApp Business Manager
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Official multi-device engine for INTERIORS WORD • Broadcasts, Smart Auto-Reply, Inquiries & Invoices
            </p>
          </div>
        </div>

        {/* Live Status Pill & Quick Controls */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold"
            style={{
              background:
                status.status === 'connected'
                  ? 'rgba(16, 185, 129, 0.12)'
                  : status.status === 'qr'
                  ? 'rgba(234, 179, 8, 0.12)'
                  : 'rgba(100, 116, 139, 0.12)',
              borderColor:
                status.status === 'connected'
                  ? 'rgba(16, 185, 129, 0.3)'
                  : status.status === 'qr'
                  ? 'rgba(234, 179, 8, 0.3)'
                  : 'rgba(100, 116, 139, 0.3)',
              color:
                status.status === 'connected'
                  ? '#10b981'
                  : status.status === 'qr'
                  ? '#eab308'
                  : 'var(--text-muted)'
            }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status.status === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : status.status === 'qr'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-slate-400'
              }`}
            />
            <span>
              {status.status === 'connected'
                ? `Connected (+${status.number || 'Active'})`
                : status.status === 'qr'
                ? 'Scan QR Code to Connect'
                : status.status === 'connecting'
                ? 'Connecting engine...'
                : 'Disconnected'}
            </span>
          </div>

          {status.status === 'connected' ? (
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-rose-500/10 text-rose-500 border-rose-500/30"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              {isConnecting ? 'Starting...' : 'Connect WhatsApp'}
            </button>
          )}

          <button
            onClick={() => window.api?.openWBManager?.()}
            title="Open original WB Manager as a standalone window"
            className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-white/10"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            ↗ Popup Window
          </button>
        </div>
      </div>

      {/* Owner Permission Alerts Banner */}
      {alerts.length > 0 && (
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-500 font-bold text-base">⚡</span>
              <h3 className="text-sm font-bold text-amber-500">
                Owner Permission Required ({alerts.length})
              </h3>
            </div>
          </div>
          <div className="space-y-2">
            {alerts.map((al) => (
              <div
                key={al.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg bg-black/20 text-xs"
              >
                <div>
                  <span className="font-semibold text-emerald-400">+{al.phone}</span>
                  {al.customerName && <span className="text-white/70 ml-1">({al.customerName})</span>}:{' '}
                  <span className="text-amber-200 font-medium">"{al.customerMessage || al.reason}"</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const reply = window.prompt(`Reply directly to +${al.phone}:`)
                      if (reply) {
                        window.api?.wa?.replyToAlert({ jid: al.jid, text: reply })
                        handleDismissAlert(al.id)
                        showToast?.('Reply sent to customer!', 'success')
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => handleDismissAlert(al.id)}
                    className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--border-color)' }}>
        {[
          { id: 'connect', label: 'Connect & Status', icon: '🔗' },
          { id: 'bulk', label: 'Bulk Broadcast', icon: '📢' },
          { id: 'autoreply', label: 'Auto-Reply & AI', icon: '🤖' },
          { id: 'orders', label: `Orders & Inquiries (${orders.length})`, icon: '📦' },
          { id: 'logs', label: 'Live Activity', icon: '📊' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md'
                : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: CONNECT */}
      {activeTab === 'connect' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 glass-panel p-6 rounded-2xl border space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Link your WhatsApp Business account
            </h2>
            <ol className="list-decimal list-inside text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <li>Open <strong>WhatsApp</strong> or <strong>WhatsApp Business</strong> on your phone.</li>
              <li>Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong> → <strong>Linked Devices</strong>.</li>
              <li>Tap <strong>Link a Device</strong> and point your camera at the QR code below.</li>
            </ol>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 border rounded-2xl bg-black/10 min-h-[300px]" style={{ borderColor: 'var(--border-color)' }}>
              {status.status === 'connected' ? (
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-3xl font-bold">
                    ✓
                  </div>
                  <h3 className="text-base font-bold text-emerald-400">Device Connected</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Phone Number: <strong className="text-white">+{status.number}</strong>
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Your WhatsApp session is securely active. You can send bulk messages, auto-reply to customers, and share invoices.
                  </p>
                </div>
              ) : qrCodeUrl ? (
                <div className="text-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl shadow-xl inline-block">
                    <img src={qrCodeUrl} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                  </div>
                  <p className="text-xs animate-pulse text-amber-400 font-medium">
                    QR code updates automatically every 20 seconds
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {isConnecting ? 'Generating QR code, please wait...' : 'Click below to start WhatsApp connection'}
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg transition-all"
                  >
                    {isConnecting ? 'Starting...' : 'Show QR Code'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleResetSession}
                className="px-3.5 py-1.5 rounded-lg border text-xs font-medium text-slate-400 hover:text-white border-slate-700 hover:bg-white/5 transition-colors"
              >
                ↻ Reset Connection Session
              </button>
              <span className="text-xs text-slate-500">
                Stuck? Click reset session to clear cache.
              </span>
            </div>
          </div>

          {/* Quick Stats & Features Card */}
          <div className="md:col-span-5 space-y-4">
            <div className="glass-panel p-6 rounded-2xl border space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                Native Features
              </h3>
              <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-base">📢</span>
                  <div>
                    <h4 className="font-semibold text-white">Smart Anti-Ban Delays</h4>
                    <p className="text-slate-400">Broadcast messages are spaced with randomized 4–8 second human pauses to protect your WhatsApp number.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-base">🤖</span>
                  <div>
                    <h4 className="font-semibold text-white">Interior Decor AI Manager</h4>
                    <p className="text-slate-400">Answers inquiries about Curtains, Wallpapers, Blinds & Flooring rates, and books site measurements 24/7.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-base">🧾</span>
                  <div>
                    <h4 className="font-semibold text-white">1-Click Customer Import</h4>
                    <p className="text-slate-400">Pull phone numbers directly from your SQLite ledger database with zero manual copy-pasting.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BULK BROADCAST */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border space-y-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Customer Broadcast & Spreadsheet
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Column <strong>A</strong> is always the phone number. Use <code className="text-emerald-400">{'{A}'}</code>, <code className="text-emerald-400">{'{B}'}</code>, <code className="text-emerald-400">{'{C}'}</code> in your message to personalize.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleImportCustomers}
                  className="px-3 py-1.5 rounded-lg bg-teal-600/20 border border-teal-500/40 text-teal-400 hover:bg-teal-600/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span>📥</span> Import Ledger Customers
                </button>
                <button
                  onClick={handleAddRow}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/10"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  + Row
                </button>
                <button
                  onClick={handleAddColumn}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/10"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  + Column
                </button>
                <button
                  onClick={handleClearGrid}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
                >
                  Clear Table
                </button>
              </div>
            </div>

            {/* Editable Spreadsheet Grid */}
            <div className="border rounded-xl overflow-hidden overflow-x-auto max-h-[340px]" style={{ borderColor: 'var(--border-color)' }}>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border-color)' }}>
                    <th className="w-12 px-3 py-2 text-center text-slate-500 font-mono">#</th>
                    {columns.map((col, idx) => (
                      <th key={col} className="px-3 py-2 font-bold" style={{ color: 'var(--text-primary)' }}>
                        Column {col} <span className="text-slate-500 font-normal">{idx === 0 ? '(Phone)' : idx === 1 ? '(Name)' : idx === 2 ? '(Amount/Balance)' : '(Note)'}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridData.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="px-3 py-2 text-center text-slate-500 font-mono select-none">{rIdx + 1}</td>
                      {columns.map((col, cIdx) => (
                        <td key={col} className="p-0 border-r" style={{ borderColor: 'var(--border-color)' }}>
                          <input
                            type="text"
                            value={row[col] || ''}
                            onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                            onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                            placeholder={cIdx === 0 ? '9876543210' : cIdx === 1 ? 'Customer Name' : ''}
                            className="w-full px-3 py-2 bg-transparent focus:outline-none focus:bg-emerald-500/10 text-xs"
                            style={{ color: 'var(--text-primary)' }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Templates Chips */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1-Click Interior Furnishing Templates
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    applyTemplate(
                      'Namaste {B} ji! INTERIORS WORD se aapka invoice #{C} ready hai. Bill PDF attach kar di gayi hai. Kisi bhi sawal ke liye reply karein. Dhanyawad! 🙏'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg border text-xs text-slate-300 hover:text-white hover:bg-white/10"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  🧾 Invoice Delivery
                </button>
                <button
                  onClick={() =>
                    applyTemplate(
                      'Namaste {B} ji! INTERIORS WORD me Designer Wallpapers, Premium Curtains aur Wooden Flooring ka naya collection launch hua hai. Free catalog dekhne ke liye reply karein! 🎉'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg border text-xs text-slate-300 hover:text-white hover:bg-white/10"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  🎨 New Collection
                </button>
                <button
                  onClick={() =>
                    applyTemplate(
                      'Hello {B} ji, aapke interior project (Curtains & Blinds) ke free site measurement visit ke liye humari team kab visit kare? Kripya confirm karein. - INTERIORS WORD'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg border text-xs text-slate-300 hover:text-white hover:bg-white/10"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  📏 Measurement Booking
                </button>
                <button
                  onClick={() =>
                    applyTemplate(
                      'Dear {B} ji, gentle reminder regarding your pending balance of {C} at INTERIORS WORD. You can pay via UPI or Net Banking. Thank you!'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg border text-xs text-slate-300 hover:text-white hover:bg-white/10"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  💰 Payment Reminder
                </button>
              </div>
            </div>

            {/* Message Template Textarea */}
            <div className="space-y-2">
              <label className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                Message Content
              </label>
              <textarea
                rows={4}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full p-3 rounded-xl border bg-black/10 focus:outline-none focus:border-emerald-500 text-sm font-sans"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                placeholder="Type your message here... Use {A}, {B}, {C} for columns"
              />
            </div>

            {/* Broadcast Options & Send */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400">Send At (Optional):</label>
                <input
                  type="datetime-local"
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border bg-black/20 text-xs focus:outline-none focus:border-emerald-500"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <button
                onClick={handleSendBulk}
                disabled={isSendingBulk}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>{isSendingBulk ? 'Sending Campaign...' : '🚀 Start Broadcast'}</span>
              </button>
            </div>

            {/* Live Progress Bar */}
            {bulkProgress && (
              <div className="p-4 rounded-xl bg-black/20 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-emerald-400">{bulkProgress.text || `Sending: ${bulkProgress.current || 0} / ${bulkProgress.total || 0}`}</span>
                  <span className="text-slate-400">
                    Sent: {bulkProgress.sent || 0} • Failed: {bulkProgress.failed || 0} • Skipped: {bulkProgress.skipped || 0}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${bulkProgress.total ? ((bulkProgress.current || bulkProgress.sent || 0) / bulkProgress.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUTO-REPLY & AI */}
      {activeTab === 'autoreply' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border space-y-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Automatic Replies & AI Virtual Manager
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Replies only to 1-on-1 chats (WhatsApp groups are always ignored).
                </p>
              </div>

              {/* Master Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {autoReply.enabled ? 'Auto-Reply Enabled' : 'Auto-Reply Disabled'}
                </span>
                <input
                  type="checkbox"
                  checked={autoReply.enabled}
                  onChange={(e) => setAutoReply({ ...autoReply, enabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${autoReply.enabled ? 'bg-emerald-600' : 'bg-slate-700'} relative p-0.5`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${autoReply.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </label>
            </div>

            {/* Mode Select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setAutoReply({ ...autoReply, mode: 'simple' })}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  autoReply.mode === 'simple'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700/60 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input type="radio" checked={autoReply.mode === 'simple'} onChange={() => {}} className="accent-emerald-500" />
                  <span>Simple Fixed Message</span>
                </div>
                <p className="text-xs mt-1 text-slate-400">
                  Sends one standard welcome reply (at most once per contact per hour).
                </p>
              </div>

              <div
                onClick={() => setAutoReply({ ...autoReply, mode: 'ai' })}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  autoReply.mode === 'ai'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700/60 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input type="radio" checked={autoReply.mode === 'ai'} onChange={() => {}} className="accent-emerald-500" />
                  <span>AI Smart Chat (Gemini / Claude / GPT)</span>
                </div>
                <p className="text-xs mt-1 text-slate-400">
                  Natural conversation in Hindi/English, quotes prices from your rate card, books measurements.
                </p>
              </div>
            </div>

            {/* Simple Mode Inputs */}
            {autoReply.mode === 'simple' && (
              <div className="space-y-2">
                <label className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  Fixed Reply Message
                </label>
                <textarea
                  rows={4}
                  value={autoReply.message}
                  onChange={(e) => setAutoReply({ ...autoReply, message: e.target.value })}
                  className="w-full p-3 rounded-xl border bg-black/10 text-sm focus:outline-none focus:border-emerald-500"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="Type simple reply message..."
                />
              </div>
            )}

            {/* AI Mode Inputs */}
            {autoReply.mode === 'ai' && (
              <div className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      AI Provider API Key
                    </label>
                    <span className="text-xs font-semibold text-emerald-400">
                      Detected: {detectedProvider?.name || 'None'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={autoReply.ai?.apiKey || ''}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="sk-ant-... / AIza... or AQ.... / sk-..."
                    className="w-full p-3 rounded-xl border bg-black/10 text-sm font-mono focus:outline-none focus:border-emerald-500"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <p className="text-xs text-slate-500">
                    Supports Google Gemini (free/low-cost), Anthropic Claude, or OpenAI. The app automatically detects which provider you paste.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      Store Persona / Tone
                    </label>
                    <textarea
                      rows={4}
                      value={autoReply.ai?.persona || ''}
                      onChange={(e) =>
                        setAutoReply({ ...autoReply, ai: { ...autoReply.ai, persona: e.target.value } })
                      }
                      className="w-full p-3 rounded-xl border bg-black/10 text-xs focus:outline-none focus:border-emerald-500"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      Interior Rate Card (AI Quotes exact prices from here)
                    </label>
                    <textarea
                      rows={4}
                      value={autoReply.ai?.menuPricing || ''}
                      onChange={(e) =>
                        setAutoReply({ ...autoReply, ai: { ...autoReply.ai, menuPricing: e.target.value } })
                      }
                      className="w-full p-3 rounded-xl border bg-black/10 text-xs font-mono focus:outline-none focus:border-emerald-500"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {/* AI Preview Tester */}
                <div className="p-4 rounded-xl bg-black/20 border border-slate-700/60 space-y-3">
                  <label className="text-xs font-bold text-slate-300">
                    Try it: Test an AI reply live
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={previewInput}
                      onChange={(e) => setPreviewInput(e.target.value)}
                      placeholder="e.g. Wallpaper ka per roll kya rate hai?"
                      className="flex-1 px-3 py-2 rounded-lg border bg-black/20 text-xs focus:outline-none focus:border-emerald-500"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={handlePreviewAi}
                      disabled={isPreviewing}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      {isPreviewing ? 'Testing...' : 'Test Reply'}
                    </button>
                  </div>
                  {previewReply && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                      <strong>AI Reply:</strong> {previewReply}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Working Hours Schedule */}
            <div className="p-4 rounded-xl border border-slate-700/60 bg-black/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Working Hours & Night Sleep (Anti-Ban Guard)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Outside store hours, AI will pause replies and send a single polite offline notice.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoReply.workingHours?.enabled || false}
                  onChange={(e) =>
                    setAutoReply({
                      ...autoReply,
                      workingHours: { ...autoReply.workingHours, enabled: e.target.checked }
                    })
                  }
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {autoReply.workingHours?.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-400">Opening Time</label>
                    <input
                      type="time"
                      value={autoReply.workingHours?.startTime || '09:00'}
                      onChange={(e) =>
                        setAutoReply({
                          ...autoReply,
                          workingHours: { ...autoReply.workingHours, startTime: e.target.value }
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border bg-black/20 text-xs"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Closing Time</label>
                    <input
                      type="time"
                      value={autoReply.workingHours?.endTime || '21:00'}
                      onChange={(e) =>
                        setAutoReply({
                          ...autoReply,
                          workingHours: { ...autoReply.workingHours, endTime: e.target.value }
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border bg-black/20 text-xs"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs text-slate-400">Offline Message</label>
                    <input
                      type="text"
                      value={autoReply.workingHours?.offlineMessage || ''}
                      onChange={(e) =>
                        setAutoReply({
                          ...autoReply,
                          workingHours: { ...autoReply.workingHours, offlineMessage: e.target.value }
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border bg-black/20 text-xs"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveAutoReply}
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition-all"
              >
                {isSavingSettings ? 'Saving...' : '💾 Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ORDERS & INQUIRIES */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {['all', 'new', 'confirmed', 'rejected'].map((f) => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${
                    orderFilter === f ? 'bg-emerald-600 text-white' : 'border hover:bg-white/5 text-slate-400'
                  }`}
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportOrders}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-white/10 text-emerald-400 border-emerald-500/40"
            >
              📥 Export Excel (CSV)
            </button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border text-slate-400 text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
              No orders or inquiries detected yet. When customers ask for quotations or place orders on WhatsApp, they will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="glass-panel p-5 rounded-2xl border space-y-3 relative"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {ord.customerName || `Customer (+${ord.phone})`}
                      </span>
                      <p className="text-xs text-slate-500">{new Date(ord.timestamp).toLocaleString()}</p>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        ord.status === 'confirmed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : ord.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/20 text-xs space-y-1">
                    <p className="font-medium text-slate-200">
                      <strong>Summary:</strong> {ord.summary}
                    </p>
                    {ord.deliveryLocation && (
                      <p className="text-slate-400">
                        <strong>📍 Site/Address:</strong> {ord.deliveryLocation}
                      </p>
                    )}
                    {ord.specialInstructions && (
                      <p className="text-slate-400">
                        <strong>Notes:</strong> {ord.specialInstructions}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                      {ord.status === 'new' && (
                        <>
                          <button
                            onClick={() => handleConfirmOrder(ord.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                          >
                            ✓ Confirm
                          </button>
                          <button
                            onClick={() => handleRejectOrder(ord.id)}
                            className="px-3 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => navigate('/sales-invoice')}
                        className="px-3 py-1 rounded-lg border text-xs font-semibold hover:bg-white/10"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        Create Invoice
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteOrder(ord.id)}
                      className="text-xs text-slate-500 hover:text-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: LIVE ACTIVITY LOG */}
      {activeTab === 'logs' && (
        <div className="glass-panel p-6 rounded-2xl border space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Live WhatsApp Activity Stream
            </h2>
            <button
              onClick={() => setLogs([])}
              className="px-2.5 py-1 rounded-lg border text-xs text-slate-400 hover:text-white"
              style={{ borderColor: 'var(--border-color)' }}
            >
              Clear Logs
            </button>
          </div>

          <div className="p-4 rounded-xl bg-black/30 border border-slate-800 font-mono text-xs space-y-2 max-h-[440px] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-slate-500 italic">No activity recorded yet in this session.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-slate-500 select-none">
                    {new Date(log.time).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-semibold ${
                      log.type === 'success'
                        ? 'text-emerald-400'
                        : log.type === 'incoming'
                        ? 'text-sky-400'
                        : log.type === 'warning'
                        ? 'text-amber-400'
                        : log.type === 'error'
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    [{log.type.toUpperCase()}]
                  </span>
                  <span className="text-slate-200">{log.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
