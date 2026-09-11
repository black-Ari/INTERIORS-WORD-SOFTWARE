import React, { useState, useEffect, useRef } from 'react'
import FormInput from '../components/FormInput'
import { useToast } from '../components/Toast'
import { STATE_CODES } from '../utils/constants'

const api = window.api

export default function Settings() {
  const toast = useToast()
  const fileInputRef = useRef(null)
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    gstin: '',
    state_code: '',
    state_name: '',
    bank_name: '',
    account_no: '',
    ifsc: '',
    upi_id: '',
    theme_color: '#2563eb',
    logo: '',
    invoice_template: 'professional'
  })

  // Auto-Updater state
  const [appVersion, setAppVersion] = useState('3.4.0')
  const [updateInfo, setUpdateInfo] = useState(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateStatusText, setUpdateStatusText] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadReady, setDownloadReady] = useState(false)

  useEffect(() => {
    loadProfile()
    api?.getVersion?.().then(v => { if (v) setAppVersion(v) }).catch(() => {})

    const unsubs = []
    if (api?.updater) {
      unsubs.push(
        api.updater.onProgress((prog) => {
          setDownloadProgress(prog)
          setIsDownloading(true)
        })
      )
      unsubs.push(
        api.updater.onDownloaded(() => {
          setDownloadReady(true)
          setIsDownloading(false)
          toast.success('Update downloaded! Click restart to apply.')
        })
      )
      unsubs.push(
        api.updater.onAvailable((info) => {
          if (info && info.hasUpdate) {
            setUpdateInfo(info)
          }
        })
      )
    }
    return () => unsubs.forEach(fn => typeof fn === 'function' && fn())
  }, [])

  async function handleCheckUpdate() {
    if (!api?.updater) return
    setIsCheckingUpdate(true)
    setUpdateStatusText('Checking GitHub releases...')
    try {
      const res = await api.updater.check()
      if (res && res.hasUpdate) {
        setUpdateInfo(res)
        setUpdateStatusText(`New version ${res.version} is available!`)
        toast.info(`New version ${res.version} available!`)
      } else {
        setUpdateInfo(null)
        setUpdateStatusText(res?.message || 'You are running the latest version.')
        toast.success('Software is up to date!')
      }
    } catch (err) {
      setUpdateStatusText(`Check failed: ${err.message}`)
      toast.error('Failed to check for updates')
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  async function handleDownloadUpdate() {
    if (!updateInfo?.downloadUrl) {
      toast.warning('No download link available for this release.')
      return
    }
    setIsDownloading(true)
    try {
      await api.updater.download(updateInfo.downloadUrl)
    } catch (err) {
      setIsDownloading(false)
      toast.error(`Download error: ${err.message}`)
    }
  }

  async function handleApplyUpdate() {
    try {
      await api.updater.install()
    } catch (err) {
      toast.error(`Install error: ${err.message}`)
    }
  }

  async function loadProfile() {
    try {
      const data = await api.companyGet()
      if (data) {
        setForm(prev => ({ ...prev, ...data }))
      }
    } catch (e) {
      toast.error('Failed to load company profile')
    } finally {
      setLoading(false)
    }
  }

  function updateForm(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'state_code') {
        next.state_name = STATE_CODES[value] || ''
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.warning('Business Name is required')
      return
    }
    setSaving(true)
    try {
      await api.companySave(form)
      toast.success('Settings saved successfully!')
    } catch (e) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // Keyboard shortcut listener for Ctrl+S
  useEffect(() => {
    const onSave = () => handleSave()
    window.addEventListener('app:save', onSave)
    return () => window.removeEventListener('app:save', onSave)
  }, [form])

  async function handleBackup() {
    if (!api?.backupDatabase) return
    try {
      const result = await api.backupDatabase()
      if (result && !result.canceled) {
        toast.success(`Database backed up to ${result}`)
      }
    } catch (e) {
      toast.error('Failed to backup database')
    }
  }

  async function handleRestore() {
    if (!api?.restoreDatabase) return
    const confirm = window.confirm("Are you sure you want to restore? This will replace your current data and the app will restart immediately.")
    if (!confirm) return
    try {
      const result = await api.restoreDatabase()
      if (result && !result.canceled) {
        // App will restart, so this may not even render, but just in case:
        toast.success('Database restored successfully! Restarting app...')
      }
    } catch (e) {
      toast.error('Failed to restore database')
    }
  }

  function extractDominantColor(dataUrl, callback) {
    if (!dataUrl) return
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.width || 100
        canvas.height = img.height || 100
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data

        let maxScore = -1
        let bestHex = '#2563eb'

        for (let i = 0; i < imageData.length; i += 16) {
          const r = imageData[i]
          const g = imageData[i + 1]
          const b = imageData[i + 2]
          const a = imageData[i + 3]
          if (a < 128) continue

          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const delta = max - min
          if (max > 240 && min > 240) continue
          if (max < 40) continue
          if (delta < 25) continue

          const score = delta * (255 - Math.abs(128 - ((max + min) / 2)))
          if (score > maxScore) {
            maxScore = score
            bestHex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
          }
        }
        callback(bestHex)
      } catch (err) {
        callback('#2563eb')
      }
    }
    img.src = dataUrl
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    // Ensure it's an image
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file')
      return
    }

    // Limit file size to 2MB (base64 string will be large otherwise)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      updateForm('logo', event.target.result)
      extractDominantColor(event.target.result, (color) => {
        updateForm('theme_color', color)
        toast.success(`Logo loaded! Auto-detected brand color: ${color.toUpperCase()}`)
      })
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    updateForm('logo', '')
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>
  }

  return (
    <div className="max-w-4xl space-y-6 animate-page-enter">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Company Profile</h1>
        <p className="text-sm text-slate-500">Manage your business details, logo, and bank information for invoices.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Logo & Save Button */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
            <h3 className="text-sm font-semibold text-slate-700 w-full mb-4">Business Logo</h3>
            
            <div className="w-48 h-48 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden relative group transition-all hover:border-teal-500">
              {form.logo ? (
                <>
                  <img src={form.logo} alt="Company Logo" className="w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-white/90 hover:bg-white rounded-lg text-slate-800 shadow-sm" title="Change Logo">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={handleRemoveLogo} className="p-2 bg-white/90 hover:bg-white rounded-lg text-red-600 shadow-sm" title="Remove Logo">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-slate-400 hover:text-teal-600 transition-colors w-full h-full justify-center">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-medium">Upload Image</span>
                </button>
              )}
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleLogoUpload}
            />
            
            <p className="text-[10px] text-slate-500 mt-3 text-center">
              Recommended: PNG or JPG, clear background. Max 2MB.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          >
            {saving ? (
              <span className="animate-spin text-lg">⏳</span>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            )}
            Save Settings
          </button>
        </div>

        {/* Right Column: Form Fields */}
        <div className="md:col-span-2 space-y-6">
          
          {/* General Details */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Business Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormInput label="Business Name *" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="e.g. INTERIORS WORD" />
              </div>
              <FormInput label="Phone Number" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="10-digit number" />
              <FormInput label="GSTIN" value={form.gstin} onChange={e => updateForm('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
              <div className="md:col-span-2">
                <FormInput label="Full Address" value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="Shop No, Street, City, ZIP" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">State Code</label>
                <select
                  value={form.state_code}
                  onChange={e => updateForm('state_code', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Select State</option>
                  {Object.entries(STATE_CODES).map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Bank Details (Prints on Invoice)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormInput label="Bank Name" value={form.bank_name} onChange={e => updateForm('bank_name', e.target.value)} placeholder="e.g. State Bank of India" />
              </div>
              <FormInput label="Account Number" value={form.account_no} onChange={e => updateForm('account_no', e.target.value)} placeholder="e.g. 000012345678" />
              <FormInput label="IFSC Code" value={form.ifsc} onChange={e => updateForm('ifsc', e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" />
              <div className="md:col-span-2">
                <FormInput label="UPI ID (for QR Code on Invoice)" value={form.upi_id} onChange={e => updateForm('upi_id', e.target.value)} placeholder="e.g. yourname@okaxis or 9876543210@upi" />
              </div>
            </div>
          </div>

          {/* Invoice Preferences */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Invoice Preferences</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Default Invoice Template</label>
                <select
                  value={form.invoice_template || 'professional'}
                  onChange={e => updateForm('invoice_template', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="professional">🏆 Professional Classic (Rule 46 Standard Boxed Grid - Default)</option>
                  <option value="professional_modern">💎 Modern Tech Studio (Floating Cards &amp; Emerald Hero)</option>
                  <option value="professional_corporate">🏢 Corporate Enterprise (Navy Full-Bleed Executive Banner)</option>
                  <option value="professional_tally">📊 TallyPrime ERP Style (Authentic Dual Grid &amp; Ledger Lines)</option>
                  <option value="professional_minimalist">✨ Architectural Minimalist (Monochrome Luxury Fine-Line)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Invoice Theme / Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.theme_color || '#2563eb'}
                    onChange={e => updateForm('theme_color', e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-1 bg-white"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['#2563eb', '#0d9488', '#c41e3a', '#d97706', '#7c3aed', '#334155'].map(hex => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => updateForm('theme_color', hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${form.theme_color === hex ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => {
                        extractDominantColor(form.logo, color => {
                          updateForm('theme_color', color)
                          toast.success(`Detected logo color: ${color.toUpperCase()}`)
                        })
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors border border-slate-300 flex items-center gap-1"
                      title="Auto-Detect from Logo"
                    >
                      🎨 Auto-Detect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Data Management</h3>
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <p className="text-sm text-slate-700 font-medium">Backup Database</p>
                <p className="text-xs text-slate-500">Save a copy of your database locally or to Google Drive.</p>
              </div>
              <button
                onClick={handleBackup}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-300 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Backup Now
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 font-medium">Restore Database</p>
                <p className="text-xs text-slate-500">Replace current data with a backup file. <span className="text-red-500 font-medium">App will restart.</span></p>
              </div>
              <button
                onClick={handleRestore}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors border border-red-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Restore Data
              </button>
            </div>
          </div>

          {/* Software Updates (GitHub Releases Auto-Updater) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Software Updates (Auto-Updater)</h3>
                <p className="text-xs text-slate-500">Official auto-updater connected to GitHub Releases.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold font-mono">
                Current: v{appVersion}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm text-slate-700 font-medium">
                  {updateInfo ? (
                    <span className="text-emerald-600 font-bold">🚀 New Update Available: {updateInfo.version}</span>
                  ) : (
                    <span>Check for Latest Version</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {updateStatusText || 'Automatically checks GitHub in the background for new features and bug fixes.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate || isDownloading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-300 flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                </button>

                {updateInfo && !downloadReady && !isDownloading && (
                  <button
                    type="button"
                    onClick={handleDownloadUpdate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <span>📥</span> Download & Install
                  </button>
                )}

                {downloadReady && (
                  <button
                    type="button"
                    onClick={handleApplyUpdate}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 animate-pulse"
                  >
                    <span>⚡</span> Restart & Apply
                  </button>
                )}
              </div>
            </div>

            {/* Download Progress Bar */}
            {isDownloading && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-emerald-500/30 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-emerald-700">
                  <span>Downloading update in background...</span>
                  <span>{downloadProgress?.percent || 0}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${downloadProgress?.percent || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
