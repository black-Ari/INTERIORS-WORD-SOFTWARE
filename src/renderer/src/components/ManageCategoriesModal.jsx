import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import FormInput from './FormInput'
import DataTable from './DataTable'
import { useToast } from './Toast'
import { GST_RATES, UNITS } from '../utils/constants'

const api = window.api

export default function ManageCategoriesModal({ isOpen, onClose, onCategoriesChange }) {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ value: '', label: '', hsn: '', gstRate: 18, defaultUnit: 'pcs', icon: '🏷️' })
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    if (isOpen) loadCategories()
  }, [isOpen])

  async function loadCategories() {
    setLoading(true)
    try {
      if (api?.categoryList) {
        const data = await api.categoryList()
        setCategories(data || [])
        if (onCategoriesChange) onCategoriesChange(data || [])
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ value: '', label: '', hsn: '', gstRate: 18, defaultUnit: 'pcs', icon: '🏷️' })
    setIsEditing(false)
    setEditId(null)
  }

  async function handleSave() {
    if (!form.label.trim()) { toast.warning('Please enter a category name'); return }
    
    // Auto-generate value from label if not editing
    const payload = { ...form }
    if (!isEditing) {
      payload.value = form.label.toLowerCase().replace(/[^a-z0-9]/g, '_')
    }

    try {
      if (isEditing) {
        await api.categoryUpdate(editId, payload)
        toast.success('Category updated')
      } else {
        await api.categoryCreate(payload)
        toast.success('Category created')
      }
      resetForm()
      loadCategories()
    } catch (e) {
      toast.error(e.message || 'Failed to save category')
    }
  }

  function handleEdit(cat) {
    setForm({ ...cat })
    setIsEditing(true)
    setEditId(cat.id)
  }

  async function handleDelete(id, label) {
    if (!confirm(`Delete category "${label}"?`)) return
    try {
      await api.categoryDelete(id)
      toast.success('Category deleted')
      loadCategories()
    } catch (e) {
      toast.error(e.message || 'Failed to delete category')
    }
  }

  const columns = [
    { key: 'label', label: 'Category', render: (v, row) => <span className="font-medium text-slate-800">{row.icon} {v}</span> },
    { key: 'hsn', label: 'Default HSN' },
    { key: 'gstRate', label: 'Default GST', render: (v) => `${v}%` },
    { key: 'id', label: '', width: '20%', align: 'right', render: (id, row) => (
      <div className="flex justify-end gap-2">
        <button onClick={() => handleEdit(row)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
        <button onClick={() => handleDelete(id, row.label)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
      </div>
    )}
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Categories" size="lg">
      <div className="space-y-6 p-1">
        
        {/* Form */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-teal-700">{isEditing ? 'Edit Category' : 'Add New Category'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Category Name *" value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="e.g. Blinds" />
            <FormInput label="Icon (Emoji)" value={form.icon} onChange={e => setForm({...form, icon: e.target.value})} placeholder="e.g. 🪟" />
            <FormInput label="Default HSN" value={form.hsn} onChange={e => setForm({...form, hsn: e.target.value})} placeholder="HSN Code" />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Default GST %</label>
              <select value={form.gstRate} onChange={e => setForm({...form, gstRate: parseFloat(e.target.value)})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500/50">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Unit</label>
              <select value={form.defaultUnit} onChange={e => setForm({...form, defaultUnit: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500/50">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            {isEditing && <button onClick={resetForm} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800">Cancel</button>}
            <button onClick={handleSave} className="px-4 py-1.5 bg-teal-600 text-white text-xs font-medium rounded hover:bg-teal-700 transition-colors">
              {isEditing ? 'Update Category' : 'Add Category'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <DataTable columns={columns} data={categories} emptyMessage={loading ? 'Loading...' : 'No categories found.'} />
        </div>

      </div>
    </Modal>
  )
}
