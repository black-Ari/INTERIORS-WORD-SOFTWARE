import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import FormInput from '../components/FormInput'
import ManageCategoriesModal from '../components/ManageCategoriesModal'
import { useToast } from '../components/Toast'
import { GST_RATES, UNITS } from '../utils/constants'
import { formatCurrency } from '../utils/formatters'

const api = window.api

const emptyForm = {
  name: '', category: '', hsn_code: '', gst_rate: 18,
  unit: 'pcs', sale_price: 0, purchase_price: 0, stock_qty: 0, brand: '', specifications: ''
}

export default function ItemMaster() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [loading, setLoading] = useState(true)

  const loadItems = useCallback(async () => {
    try {
      if (api?.itemList) {
        const data = await api.itemList()
        setItems(data || [])
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      if (api?.categoryList) {
        const data = await api.categoryList()
        setCategories(data || [])
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    loadItems()
    loadCategories()
  }, [loadItems, loadCategories])

  useEffect(() => {
    let result = items
    if (tab !== 'all') result = result.filter(i => i.category === tab)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.name?.toLowerCase().includes(q) || i.brand?.toLowerCase().includes(q) || i.hsn_code?.includes(q)
      )
    }
    setFiltered(result)
  }, [items, tab, search])

  const categoryMap = useMemo(() => {
    const map = {}
    categories.forEach(c => map[c.value] = c)
    return map
  }, [categories])

  const columns = [
    { key: 'name', label: 'Product Name', width: '22%' },
    {
      key: 'category', label: 'Category', width: '12%', render: (v) => {
        const cat = categoryMap[v]
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/5 text-gray-300">
            {cat?.icon} {cat?.label || v}
          </span>
        )
      }
    },
    { key: 'hsn_code', label: 'HSN', width: '8%', render: (v) => <span className="font-mono text-xs text-gray-400">{v}</span> },
    { key: 'gst_rate', label: 'GST%', width: '7%', align: 'center', render: (v) => <span className="text-amber-400">{v}%</span> },
    { key: 'unit', label: 'Unit', width: '7%', align: 'center' },
    { key: 'sale_price', label: 'Sale Price', width: '12%', align: 'right', render: (v) => formatCurrency(v) },
    { key: 'purchase_price', label: 'Cost Price', width: '12%', align: 'right', render: (v) => <span className="text-gray-400">{formatCurrency(v)}</span> },
    {
      key: 'stock_qty', label: 'Stock', width: '10%', align: 'right', render: (v, row) => (
        <span className={v <= 0 ? 'text-red-400' : v < 5 ? 'text-amber-400' : 'text-emerald-400'}>
          {v} {row.unit}
        </span>
      )
    }
  ]

  function openCreate() {
    setEditId(null)
    const initialCat = categories.length > 0 ? categories[0] : null
    setForm({
      ...emptyForm,
      category: initialCat?.value || '',
      hsn_code: initialCat?.hsn || '',
      gst_rate: initialCat?.gstRate || 18,
      unit: initialCat?.defaultUnit || 'pcs'
    })
    setShowModal(true)
  }

  function openEdit(row) {
    setEditId(row.id)
    setForm({ ...row })
    setShowModal(true)
  }

  function updateForm(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'category' && categoryMap[value]) {
        next.hsn_code = categoryMap[value].hsn || ''
        next.gst_rate = categoryMap[value].gstRate || 0
        next.unit = categoryMap[value].defaultUnit || 'pcs'
      }
      return next
    })
  }

  // Keyboard Shortcuts Listeners
  useEffect(() => {
    const onNew = () => openCreate()
    const onSave = () => {
      if (showModal) handleSave()
    }
    window.addEventListener('app:new', onNew)
    window.addEventListener('app:save', onSave)
    return () => {
      window.removeEventListener('app:new', onNew)
      window.removeEventListener('app:save', onSave)
    }
  }, [showModal, form, editId])

  async function handleSave() {
    if (!form.name.trim()) { toast.warning('Please enter a product name'); return }
    try {
      if (editId) {
        await api.itemUpdate(editId, form)
        toast.success('Item updated successfully')
      } else {
        await api.itemCreate(form)
        toast.success('Item created successfully')
      }
      setShowModal(false)
      loadItems()
    } catch (e) {
      toast.error(e.message || 'Failed to save')
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return
    try {
      await api.itemDelete(editId)
      toast.success('Item deleted')
      setShowModal(false)
      loadItems()
    } catch (e) { toast.error(e.message || 'Failed to delete') }
  }

  const tabs = [
    { key: 'all', label: 'All' },
    ...categories.map(c => ({ key: c.value, label: `${c.icon} ${c.label}` }))
  ]

  return (
    <div className="space-y-4 max-w-6xl animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/5 flex-wrap max-w-2xl">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${tab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-gray-200'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name, brand, HSN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 px-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/30"
          />
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy-800 border border-white/10 text-gray-300 text-sm font-medium rounded-lg hover:bg-white/5 transition-all"
          >
            Manage Categories
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        onRowDoubleClick={openEdit}
        emptyMessage={loading ? 'Loading...' : 'No products found. Add your first product!'}
      />

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Product' : 'Add Product'} size="lg">
        <div className="grid grid-cols-2 gap-4 p-1">
          <FormInput label="Product Name *" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Enter product name" />
          <FormInput label="Brand" value={form.brand} onChange={e => updateForm('brand', e.target.value)} placeholder="Brand name" />
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Category *</label>
            <select
              value={form.category}
              onChange={e => updateForm('category', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:shadow-[0_0_0_2px_rgba(13,148,136,0.2)] transition-all duration-150"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Unit</label>
            <input
              list="unit-options"
              value={form.unit}
              onChange={e => updateForm('unit', e.target.value.toLowerCase())}
              placeholder="e.g. pcs, box, kg..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:shadow-[0_0_0_2px_rgba(13,148,136,0.2)] transition-all duration-150"
            />
            <datalist id="unit-options">
              {UNITS.map(u => <option key={u} value={u} />)}
            </datalist>
          </div>
          <FormInput label="HSN Code" value={form.hsn_code} onChange={e => updateForm('hsn_code', e.target.value)} placeholder="4-6 digit HSN" />
          <div>
            <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">GST Rate %</label>
            <select
              value={form.gst_rate}
              onChange={e => updateForm('gst_rate', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-500 focus:shadow-[0_0_0_2px_rgba(13,148,136,0.2)] transition-all duration-150"
            >
              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
          <FormInput label="Sale Price" type="number" value={form.sale_price} onChange={e => updateForm('sale_price', parseFloat(e.target.value) || 0)} prefix="₹" />
          <FormInput label="Purchase Price" type="number" value={form.purchase_price} onChange={e => updateForm('purchase_price', parseFloat(e.target.value) || 0)} prefix="₹" />
          <FormInput label="Opening Stock" type="number" value={form.stock_qty} onChange={e => updateForm('stock_qty', parseFloat(e.target.value) || 0)} suffix={form.unit} />
        </div>

        {/* Auto-fill info */}
        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs text-amber-400/80">
          💡 HSN Code and GST Rate are auto-filled based on category. You can override them if needed.
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
          {editId && (
            <button onClick={handleDelete} className="px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              Delete
            </button>
          )}
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all"
          >
            {editId ? 'Update' : 'Create'}
          </button>
        </div>
      </Modal>

      <ManageCategoriesModal
        isOpen={showCategoriesModal}
        onClose={() => setShowCategoriesModal(false)}
        onCategoriesChange={setCategories}
      />
    </div>
  )
}
