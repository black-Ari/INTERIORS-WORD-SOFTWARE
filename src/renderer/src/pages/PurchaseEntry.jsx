import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import FormInput from '../components/FormInput'
import { calculateInvoiceTax } from '../services/GSTService'
import { formatCurrency, formatDate } from '../utils/formatters'

const api = window.api

const emptyLineItem = {
  item_id: '',
  description: '',
  category: '',
  quantity: 1,
  unit: 'pcs',
  rate: 0,
  discount_percent: 0,
  amount: 0,
  hsn_code: '',
  gst_rate: 0
}

export default function PurchaseEntry() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  
  const [voucher, setVoucher] = useState({
    date: new Date().toISOString().split('T')[0],
    ledger_id: '',
    notes: '',
    discount_amount: 0,
    round_off: 0,
    is_interstate: 0
  })
  
  const [items, setItems] = useState([{ ...emptyLineItem, id: Date.now() }])
  const [ledgers, setLedgers] = useState([])
  const [products, setProducts] = useState([])
  const [voucherNumber, setVoucherNumber] = useState('')
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [companyStateCode, setCompanyStateCode] = useState('')
  
  // Create Vendor Modal
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', state_code: '' })

  const loadInitialData = useCallback(async () => {
    try {
      const [ledgersData, productsData, companyData, nextVoucher] = await Promise.all([
        api.ledgerList(),
        api.itemList(),
        api.companyGet(),
        api.getNextVoucherNumber('purchase')
      ])
      
      const vendorLedgers = (ledgersData || []).filter(l => l.type === 'vendor')
      setLedgers(vendorLedgers)
      setProducts(productsData || [])
      setCompanyStateCode(companyData?.state_code || '')
      
      if (editId) {
        const oldVoucher = await api.voucherGet(Number(editId))
        if (oldVoucher) {
          setVoucher({
            date: oldVoucher.date,
            ledger_id: oldVoucher.ledger_id,
            notes: oldVoucher.notes || '',
            discount_amount: oldVoucher.discount_amount || 0,
            round_off: oldVoucher.round_off || 0,
            is_interstate: oldVoucher.is_interstate || 0
          })
          setVoucherNumber(oldVoucher.voucher_number)
          
          if (oldVoucher.items && oldVoucher.items.length > 0) {
            setItems(oldVoucher.items.map((it, idx) => ({
              ...emptyLineItem,
              ...it,
              id: Date.now() + idx
            })))
          }
          
          const vend = vendorLedgers.find(l => l.id === oldVoucher.ledger_id)
          if (vend) setSelectedVendor(vend)
        }
      } else {
        setVoucherNumber(nextVoucher)
      }
    } catch (e) {
      toast.error('Failed to load initial data')
    }
  }, [toast, editId])

  useEffect(() => {
    loadInitialData()
    
    // Listen for Ctrl+S
    const handleSave = () => handleSaveEntry()
    window.addEventListener('app:save', handleSave)
    return () => window.removeEventListener('app:save', handleSave)
  }, [loadInitialData])

  const { 
    subtotal, 
    taxSummary, 
    totalTax, 
    totalCGST,
    totalSGST,
    totalIGST,
    grandTotal, 
    netAmount,
    itemsWithTax
  } = useMemo(() => {
    let sub = 0
    items.forEach(item => { sub += (item.amount || 0) })
    
    const taxableAmount = Math.max(0, sub - (Number(voucher.discount_amount) || 0))
    const discountRatio = sub > 0 ? taxableAmount / sub : 1
    
    const linesWithTax = items.map(item => ({
      ...item,
      amount: item.amount * discountRatio
    }))
    
    const taxResult = calculateInvoiceTax(linesWithTax, voucher.is_interstate === 1)
    
    // Map tax components to snake_case for the database schema
    const finalItems = taxResult.lineItemsWithTax.map(i => ({
      ...i,
      cgst_amount: i.cgst,
      sgst_amount: i.sgst,
      igst_amount: i.igst
    }))
    
    const grand = taxableAmount + taxResult.totalTax
    const net = Math.round(grand)
    const roundOff = net - grand
    
    return {
      subtotal: sub,
      taxSummary: taxResult.taxSummary,
      totalTax: taxResult.totalTax,
      totalCGST: taxResult.totalCGST,
      totalSGST: taxResult.totalSGST,
      totalIGST: taxResult.totalIGST,
      grandTotal: grand,
      netAmount: net,
      itemsWithTax: finalItems
    }
  }, [items, voucher.discount_amount, voucher.is_interstate])

  function handleVendorSelect(ledgerId) {
    const vendor = ledgers.find(l => l.id === Number(ledgerId))
    setSelectedVendor(vendor)
    
    const isInterstate = (vendor?.state_code && companyStateCode && vendor.state_code !== companyStateCode) ? 1 : 0
    
    setVoucher(prev => ({ 
      ...prev, 
      ledger_id: ledgerId,
      is_interstate: isInterstate
    }))
  }

  function handleItemSelect(index, productId) {
    const product = products.find(p => p.id === Number(productId))
    const newItems = [...items]
    
    if (product) {
      newItems[index] = {
        ...newItems[index],
        item_id: product.id,
        description: product.name,
        category: product.category,
        rate: product.purchase_price || 0,
        hsn_code: product.hsn_code,
        gst_rate: product.gst_rate,
        unit: product.unit
      }
      
      newItems[index].amount = calculateLineAmount(newItems[index])
      setItems(newItems)
    }
  }

  function updateItem(index, field, value) {
    const newItems = [...items]
    newItems[index][field] = value
    newItems[index].amount = calculateLineAmount(newItems[index])
    setItems(newItems)
  }

  function calculateLineAmount(item) {
    const qty = Number(item.quantity) || 0
    const rate = Number(item.rate) || 0
    const disc = Number(item.discount_percent) || 0
    const base = qty * rate
    return base - (base * (disc / 100))
  }

  function addRow() {
    setItems([...items, { ...emptyLineItem, id: Date.now() }])
  }

  function removeRow(index) {
    if (items.length === 1) {
      setItems([{ ...emptyLineItem, id: Date.now() }])
    } else {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  async function handleSaveEntry() {
    if (!voucher.ledger_id) { toast.warning('Please select a vendor'); return }
    if (!items[0].item_id) { toast.warning('Please add at least one item'); return }
    
    try {
      const payload = {
        ...voucher,
        voucher_number: voucherNumber,
        voucher_type: 'purchase',
        subtotal,
        cgst_amount: totalCGST,
        sgst_amount: totalSGST,
        igst_amount: totalIGST,
        total_tax: totalTax,
        grand_total: grandTotal,
        round_off: netAmount - grandTotal,
        net_amount: netAmount
      }
      
      let saved;
      if (editId) {
        saved = await api.voucherUpdate(Number(editId), payload, itemsWithTax)
        toast.success('Purchase entry updated successfully')
      } else {
        saved = await api.voucherCreate(payload, itemsWithTax)
        toast.success('Purchase entry saved successfully')
      }

      // Automatically generate & save PDF in background without opening print dialog
      try {
        const result = await api.generatePDF(saved.id)
        if (result) {
          toast.success('Bill saved as PDF successfully!')
        }
      } catch (pdfErr) {
        console.error('PDF save failed:', pdfErr)
      }

      navigate('/reports')
    } catch (e) {
      toast.error(e.message || 'Failed to save entry')
    }
  }

  async function handleCreateVendor() {
    try {
      const created = await api.ledgerCreate({ ...newVendor, type: 'vendor' })
      toast.success('Vendor created')
      setShowVendorModal(false)
      const freshLedgers = await api.ledgerList()
      setLedgers(freshLedgers || [])
      const newId = created?.id || created
      if (newId) {
        const vendor = (freshLedgers || []).find(l => l.id === Number(newId))
        setSelectedVendor(vendor)
        const isInterstate = (vendor?.state_code && companyStateCode && vendor.state_code !== companyStateCode) ? 1 : 0
        setVoucher(prev => ({
          ...prev,
          ledger_id: Number(newId),
          is_interstate: isInterstate
        }))
      }
    } catch(e) {
      toast.error('Failed to create vendor: ' + (e.message || ''))
    }
  }

  return (
    <div className="max-w-6xl space-y-4 animate-page-enter">
      {/* Top Bar - Notice the blue accents for purchase */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Voucher No.</label>
            <div className="text-blue-600 font-mono font-bold text-lg">{voucherNumber || '...'}</div>
          </div>
          <div className="w-px h-10 bg-slate-200 mx-2" />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input 
              type="date" 
              value={voucher.date}
              onChange={e => setVoucher({...voucher, date: e.target.value})}
              className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleSaveEntry} className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-md shadow-blue-500/20 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            Save Purchase
          </button>
        </div>
      </div>

      {/* Vendor Selection */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex gap-6">
        <div className="flex-1">
          <div className="flex justify-between items-end mb-2">
            <label className="block text-xs font-medium text-slate-500">Supplier / Vendor</label>
            <button onClick={() => setShowVendorModal(true)} className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-red-600">Alt+C</span> Add New
            </button>
          </div>
          <select 
            value={voucher.ledger_id}
            onChange={e => handleVendorSelect(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Select Vendor --</option>
            {ledgers.map(l => (
              <option key={l.id} value={l.id}>{l.name} {l.phone ? `(${l.phone})` : ''}</option>
            ))}
          </select>
        </div>
        
        {selectedVendor && (
          <div className="flex-1 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
            <div>
              <p className="text-slate-500 text-xs">GSTIN</p>
              <p className="font-mono text-slate-800">{selectedVendor.gstin || 'Unregistered'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">State</p>
              <p className="text-slate-800">{selectedVendor.state_name || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Phone</p>
              <p className="text-slate-800">{selectedVendor.phone || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Tax Type</p>
              <p className={voucher.is_interstate ? "text-purple-600" : "text-emerald-600"}>
                {voucher.is_interstate ? 'IGST (Interstate)' : 'CGST/SGST (Intrastate)'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-12">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Item Description</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-24">HSN</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-24">Qty (Add)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-16">Unit</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">Cost Rate (₹)</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-24">Disc %</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-32">Amount (₹)</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-b border-slate-100 group">
                <td className="px-3 py-2 text-slate-500 text-center">{index + 1}</td>
                <td className="px-2 py-1">
                  <select
                    value={item.item_id}
                    onChange={e => handleItemSelect(index, e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 text-slate-800 outline-none"
                  >
                    <option value="">Select Item...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-slate-500 font-mono text-xs">{item.hsn_code}</td>
                <td className="px-2 py-1">
                  <input type="number" min="0" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="w-full text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 text-emerald-600 font-medium outline-none" />
                </td>
                <td className="px-3 py-2 text-slate-500">{item.unit}</td>
                <td className="px-2 py-1">
                  <input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} className="w-full text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 text-slate-800 outline-none" />
                </td>
                <td className="px-2 py-1">
                  <input type="number" min="0" max="100" step="0.1" value={item.discount_percent} onChange={e => updateItem(index, 'discount_percent', e.target.value)} className="w-full text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 text-blue-600 outline-none" />
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">
                  {item.amount.toFixed(2)}
                </td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => removeRow(index)} className="text-red-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                    <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2 border-t border-slate-100 bg-slate-50">
          <button onClick={addRow} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded hover:bg-slate-200 transition-colors">
            + Add Row
          </button>
        </div>
      </div>

      {/* Footer / Totals */}
      <div className="flex gap-6">
        {/* Tax Summary */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">GST Summary</h3>
          {Object.keys(taxSummary).length === 0 ? (
            <p className="text-sm text-slate-500">No taxable items</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-xs text-right">
                  <th className="text-left pb-2 font-medium">Rate</th>
                  <th className="pb-2 font-medium">Taxable</th>
                  {voucher.is_interstate ? (
                    <th className="pb-2 font-medium">IGST</th>
                  ) : (
                    <>
                      <th className="pb-2 font-medium">CGST</th>
                      <th className="pb-2 font-medium">SGST</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {Object.values(taxSummary).map(tax => (
                  <tr key={tax.gstRate} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-blue-600">{tax.gstRate}%</td>
                    <td className="py-2 text-right text-slate-700">{tax.taxableAmount.toFixed(2)}</td>
                    {voucher.is_interstate ? (
                      <td className="py-2 text-right text-slate-700">{tax.igst.toFixed(2)}</td>
                    ) : (
                      <>
                        <td className="py-2 text-right text-slate-700">{tax.cgst.toFixed(2)}</td>
                        <td className="py-2 text-right text-slate-700">{tax.sgst.toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals */}
        <div className="w-80 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Overall Discount</span>
              <input 
                type="number" 
                min="0"
                value={voucher.discount_amount}
                onChange={e => setVoucher({...voucher, discount_amount: e.target.value})}
                className="w-24 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-blue-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Tax</span>
              <span>{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-2">
              <span>Round Off</span>
              <span>{(netAmount - grandTotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-end border-t border-slate-200 pt-3 mt-2">
              <span className="text-base font-semibold text-slate-900">Grand Total</span>
              <span className="text-2xl font-bold text-emerald-600">{formatCurrency(netAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Vendor Modal */}
      <Modal isOpen={showVendorModal} onClose={() => setShowVendorModal(false)} title="Quick Add Vendor">
        <div className="space-y-4 p-2">
          <FormInput label="Vendor Name" value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} />
          <FormInput label="Phone Number" value={newVendor.phone} onChange={e => setNewVendor({...newVendor, phone: e.target.value})} />
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button onClick={handleCreateVendor} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
