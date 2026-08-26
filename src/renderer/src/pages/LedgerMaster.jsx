import React, { useState, useEffect, useCallback } from 'react'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import FormInput from '../components/FormInput'
import { useToast } from '../components/Toast'
import { LEDGER_TYPES, STATE_CODES } from '../utils/constants'

const api = window.api

const emptyForm = {
  name: '', type: 'customer', phone: '', email: '', gstin: '',
  address: '', state_code: '', state_name: '', opening_balance: 0
}

const columns = [
  { key: 'name', label: 'Name', width: '22%' },
  { key: 'type', label: 'Type', width: '10%', render: (v) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${v === 'customer' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
      {v}
    </span>
  )},
  { key: 'phone', label: 'Phone', width: '14%' },
  { key: 'gstin', label: 'GSTIN', width: '20%', render: (v) => <span className="font-mono text-xs text-slate-500">{v || '—'}</span> },
  { key: 'state_name', label: 'State', width: '16%' },
  { key: 'opening_balance', label: 'Balance', width: '12%', align: 'right', render: (v) => (
    <span className={v > 0 ? 'text-teal-600 font-semibold' : 'text-slate-400'}>₹{(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
  )}
]

export default function LedgerMaster() {
  const toast = useToast()
  const [ledgers, setLedgers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [loading, setLoading] = useState(true)

  const loadLedgers = useCallback(async () => {
    try {
      if (api?.ledgerList) {
        const data = await api.ledgerList()
        setLedgers(data || [])
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadLedgers() }, [loadLedgers])

  useEffect(() => {
    let result = ledgers
    if (tab !== 'all') result = result.filter(l => l.type === tab)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.gstin?.toLowerCase().includes(q)
      )
    }
    setFiltered(result)
  }, [ledgers, tab, search])

  function openCreate() {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  function openEdit(row) {
    setEditId(row.id)
    setForm({ ...row })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.warning('Please enter a name'); return }
    try {
      if (editId) {
        await api.ledgerUpdate(editId, form)
        toast.success('Ledger updated successfully')
      } else {
        await api.ledgerCreate(form)
        toast.success('Ledger created successfully')
      }
      setShowModal(false)
      loadLedgers()
    } catch (e) {
      toast.error(e.message || 'Failed to save')
    }
  }

  async function handleDelete(row) {
    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    try {
      await api.ledgerDelete(row.id)
      toast.success('Ledger deleted')
      loadLedgers()
    } catch (e) { toast.error(e.message || 'Failed to delete') }
  }

  function updateForm(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'state_code') next.state_name = STATE_CODES[value] || ''
      return next
    })
  }

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'customer', label: 'Customers' },
    { key: 'vendor', label: 'Vendors' }
  ]

  return (
    <div className="space-y-4 max-w-6xl animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-slate-200 shadow-sm">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === t.key ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name, phone, GSTIN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 px-3 py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md shadow-teal-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Ledger
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        onRowDoubleClick={openEdit}
        emptyMessage={loading ? 'Loading...' : 'No ledgers found. Create your first customer or vendor!'}
      />

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Ledger' : 'Create Ledger'} size="lg">
        <div className="grid grid-cols-2 gap-4 p-1">
          <FormInput label="Party Name *" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Enter name" />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Type *</label>
            <select
              value={form.type}
              onChange={e => updateForm('type', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          <FormInput label="Phone" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="10-digit phone" />
          <FormInput label="Email" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="email@example.com" />
          <FormInput label="GSTIN" value={form.gstin} onChange={e => updateForm('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">State</label>
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
          <div className="col-span-2">
            <FormInput label="Address" value={form.address} onChange={e => updateForm('address', e.target.value)} placeholder="Full address" />
          </div>
          <FormInput label="Opening Balance" type="number" value={form.opening_balance} onChange={e => updateForm('opening_balance', parseFloat(e.target.value) || 0)} prefix="₹" />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          {editId && (
            <button onClick={() => { setShowModal(false); handleDelete(form) }} className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              Delete
            </button>
          )}
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all shadow-md shadow-teal-500/20"
          >
            {editId ? 'Update' : 'Create'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
