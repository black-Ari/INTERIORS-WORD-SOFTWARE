import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import FormInput from '../components/FormInput'
import { calculateGST, calculateInvoiceTax } from '../services/GSTService'
import { calculateCurtainFabric, calculateWallpaperRolls, calculatePVCBoxes } from '../services/CalculationService'
import { formatCurrency, formatDate } from '../utils/formatters'
import { CATEGORIES, CALCULATOR_CATEGORIES, FULLNESS_RATIOS } from '../utils/constants'

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
  gst_rate: 0,
  calc_metadata: null
}

export default function SalesInvoice() {
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
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [companyStateCode, setCompanyStateCode] = useState('')
  
  // Calculator Modal State
  const [calcModal, setCalcModal] = useState({ isOpen: false, itemIndex: -1, category: null, data: {} })
  
  // Create Customer Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', state_code: '' })

  const loadInitialData = useCallback(async () => {
    try {
      const [ledgersData, productsData, companyData, nextVoucher] = await Promise.all([
        api.ledgerList(),
        api.itemList(),
        api.companyGet(),
        api.getNextVoucherNumber('sales')
      ])
      
      const customerLedgers = (ledgersData || []).filter(l => l.type === 'customer')
      setLedgers(customerLedgers)
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
              id: Date.now() + idx,
              calc_metadata: it.calc_metadata ? JSON.parse(it.calc_metadata) : null
            })))
          }
          
          const cust = customerLedgers.find(l => l.id === oldVoucher.ledger_id)
          if (cust) setSelectedCustomer(cust)
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
    const handleSave = () => handleSaveInvoice()
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
    // Distribute discount proportionally across lines to calculate exact tax
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

  function handleCustomerSelect(ledgerId) {
    const customer = ledgers.find(l => l.id === Number(ledgerId))
    setSelectedCustomer(customer)
    
    const isInterstate = (customer?.state_code && companyStateCode && customer.state_code !== companyStateCode) ? 1 : 0
    
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
        rate: product.sale_price || 0,
        hsn_code: product.hsn_code,
        gst_rate: product.gst_rate,
        unit: product.unit,
        calc_metadata: null
      }
      
      // Calculate amount based on default qty (1)
      const amount = calculateLineAmount(newItems[index])
      newItems[index].amount = amount
      
      setItems(newItems)
      
      // Auto-open calculator for specific categories
      if (CALCULATOR_CATEGORIES.includes(product.category)) {
        openCalculator(index, product.category)
      }
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

  // --- Calculators ---
  function openCalculator(index, category) {
    const item = items[index]
    let existingMeta = {}
    try {
      existingMeta = typeof item.calc_metadata === 'string'
        ? JSON.parse(item.calc_metadata)
        : (item.calc_metadata || {})
    } catch {
      existingMeta = {}
    }
    
    let defaultData = {}
    if (category === 'curtain') {
      defaultData = { trackWidth: 0, fullnessRatio: 2.0, fabricWidth: 140, finishedDrop: 0, patternRepeat: 0, ...existingMeta }
    } else if (category === 'wallpaper') {
      defaultData = { wallWidth: 0, wallHeight: 0, rollWidth: 53, rollLength: 1000, patternRepeat: 0, wastagePercent: 10, ...existingMeta }
    } else if (category === 'pvc_plank') {
      defaultData = { roomLength: 0, roomWidth: 0, boxCoverageSqFt: 20, wastagePercent: 10, ...existingMeta }
    }
    
    setCalcModal({ isOpen: true, itemIndex: index, category, data: defaultData })
  }

  function applyCalculation() {
    const { itemIndex, category, data } = calcModal
    let qty = 0
    
    if (category === 'curtain') {
      const res = calculateCurtainFabric(data)
      qty = data.unit === 'meter' ? res.totalMeters : res.totalYards
    } else if (category === 'wallpaper') {
      const res = calculateWallpaperRolls(data)
      qty = res.totalRolls
    } else if (category === 'pvc_plank') {
      const res = calculatePVCBoxes(data)
      qty = res.boxes
    }
    
    const newItems = [...items]
    newItems[itemIndex].quantity = qty
    newItems[itemIndex].calc_metadata = JSON.stringify(data)
    newItems[itemIndex].amount = calculateLineAmount(newItems[itemIndex])
    
    setItems(newItems)
    setCalcModal({ isOpen: false, itemIndex: -1, category: null, data: {} })
    toast.success(`Calculated: ${qty} ${newItems[itemIndex].unit}`)
  }

  // --- Save / Print ---
  async function saveInvoiceQuietly() {
    if (!voucher.ledger_id) { toast.warning('Please select a customer'); return null }
    if (!items[0].item_id) { toast.warning('Please add at least one item'); return null }
    
    try {
      const payload = {
        ...voucher,
        voucher_number: voucherNumber,
        voucher_type: 'sales',
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
      } else {
        saved = await api.voucherCreate(payload, itemsWithTax)
      }
      return saved.id;
    } catch (e) {
      toast.error(e.message || 'Failed to save invoice');
      return null;
    }
  }

  async function handleSaveInvoice() {
    const savedId = await saveInvoiceQuietly()
    if (!savedId) return
    toast.success(editId ? 'Invoice updated successfully' : 'Invoice saved successfully')
    
    // Automatically generate & save PDF in background without opening print dialog
    try {
      const result = await api.generatePDF(savedId)
      if (result) {
        toast.success('Bill saved as PDF successfully!')
      }
    } catch (pdfErr) {
      console.error('PDF save failed:', pdfErr)
    }
    navigate('/reports')
  }

  async function handlePrintPdf() {
    try {
      const savedId = await saveInvoiceQuietly()
      if (!savedId) return
      toast.success('Invoice saved! Opening printer...')
      await api.printInvoice(savedId)
    } catch (e) {
      toast.error(e.message || 'Failed to print PDF')
    }
  }

  async function handleWhatsApp() {
    try {
      if (!selectedCustomer?.phone) {
        toast.warning('Customer has no phone number')
        return
      }
      const savedId = await saveInvoiceQuietly()
      if (!savedId) return
      
      const phone = (selectedCustomer.phone || '').replace(/[^0-9]/g, '')
      const msg = `Hello ${selectedCustomer.name || ''}, your invoice #${voucherNumber} from INTERIORS WORD has been generated. Amount: Rs. ${calculations.netAmount}. Thank you!`

      try {
        const waStatus = await window.api?.wa?.getStatus()
        if (waStatus?.status === 'connected') {
          await window.api?.wa?.sendDirect({ to: phone, text: msg })
          toast.success(`Invoice sent directly via WhatsApp to +${phone}!`)
          return
        }
      } catch {}

      if (phone) {
        const formattedPhone = phone.length === 10 ? `91${phone}` : phone
        window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, '_blank')
        toast.success('Opening WhatsApp chat...')
      }
    } catch (e) {
      toast.error(e.message || 'WhatsApp failed')
    }
  }

  async function handleCreateCustomer() {
    try {
      const created = await api.ledgerCreate({ ...newCustomer, type: 'customer' })
      toast.success('Customer created')
      setShowCustomerModal(false)
      const freshLedgers = await api.ledgerList()
      setLedgers(freshLedgers || [])
      const newId = created?.id || created
      if (newId) {
        const customer = (freshLedgers || []).find(l => l.id === Number(newId))
        setSelectedCustomer(customer)
        const isInterstate = (customer?.state_code && companyStateCode && customer.state_code !== companyStateCode) ? 1 : 0
        setVoucher(prev => ({
          ...prev,
          ledger_id: Number(newId),
          is_interstate: isInterstate
        }))
      }
    } catch(e) {
      toast.error('Failed to create customer: ' + (e.message || ''))
    }
  }

  return (
    <div className="max-w-6xl space-y-4 animate-page-enter">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Invoice No.</label>
            <div className="text-teal-600 font-mono font-bold text-lg">{voucherNumber || '...'}</div>
          </div>
          <div className="w-px h-10 bg-slate-200 mx-2" />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input 
              type="date" 
              value={voucher.date}
              onChange={e => setVoucher({...voucher, date: e.target.value})}
              className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={handleSaveInvoice} className="px-6 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium rounded-lg shadow-md shadow-teal-500/20 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            Save Invoice
          </button>
        </div>
      </div>

      {/* Customer Selection */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex gap-6">
        <div className="flex-1">
          <div className="flex justify-between items-end mb-2">
            <label className="block text-xs font-medium text-slate-500">Bill To (Customer)</label>
            <button onClick={() => setShowCustomerModal(true)} className="text-xs text-teal-600 hover:text-teal-500 flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-red-600">Alt+C</span> Add New
            </button>
          </div>
          <select 
            value={voucher.ledger_id}
            onChange={e => handleCustomerSelect(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-500"
          >
            <option value="">-- Select Customer --</option>
            {ledgers.map(l => (
              <option key={l.id} value={l.id}>{l.name} {l.phone ? `(${l.phone})` : ''}</option>
            ))}
          </select>
        </div>
        
        {selectedCustomer && (
          <div className="flex-1 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
            <div>
              <p className="text-slate-500 text-xs">GSTIN</p>
              <p className="font-mono text-slate-800">{selectedCustomer.gstin || 'Unregistered'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">State</p>
              <p className="text-slate-800">{selectedCustomer.state_name || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Phone</p>
              <p className="text-slate-800">{selectedCustomer.phone || '—'}</p>
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
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-24">Qty</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 w-16">Unit</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 w-28">Rate (₹)</th>
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
                  <div className="flex gap-2">
                    <select
                      value={item.item_id}
                      onChange={e => handleItemSelect(index, e.target.value)}
                      className="flex-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-500 rounded px-2 py-1 text-slate-800 outline-none"
                    >
                      <option value="">Select Item...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {CALCULATOR_CATEGORIES.includes(item.category) && (
                      <button 
                        onClick={() => openCalculator(index, item.category)}
                        className={`p-1 rounded bg-slate-100 hover:bg-teal-50 text-slate-500 hover:text-teal-600 transition-colors ${item.calc_metadata ? 'text-teal-600 border border-teal-200 bg-teal-50' : ''}`}
                        title="Open Calculator"
                      >
                        🧮
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-500 font-mono text-xs">{item.hsn_code}</td>
                <td className="px-2 py-1">
                  <input type="number" min="0" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} className="w-full text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-500 rounded px-2 py-1 text-slate-800 outline-none" />
                </td>
                <td className="px-3 py-2 text-slate-500">{item.unit}</td>
                <td className="px-2 py-1">
                  <input type="number" min="0" step="0.01" value={item.rate} onChange={e => updateItem(index, 'rate', e.target.value)} className="w-full text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-500 rounded px-2 py-1 text-slate-800 outline-none" />
                </td>
                <td className="px-2 py-1">
                  <input type="number" min="0" max="100" step="0.1" value={item.discount_percent} onChange={e => updateItem(index, 'discount_percent', e.target.value)} className="w-full text-right bg-transparent border border-transparent hover:border-slate-300 focus:border-teal-500 rounded px-2 py-1 text-teal-600 outline-none" />
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
          <button onClick={addRow} className="text-xs font-medium text-teal-600 hover:text-teal-700 px-3 py-1.5 rounded hover:bg-slate-200 transition-colors">
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
                    <td className="py-2 text-teal-600">{tax.gstRate}%</td>
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
                className="w-24 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-teal-600 focus:outline-none focus:border-teal-500"
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
          
          <div className="mt-6 flex gap-2">
            <button onClick={handlePrintPdf} className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-lg border border-slate-200 shadow-sm transition-colors flex items-center justify-center gap-2">
              📄 Print PDF
            </button>
            <button onClick={handleWhatsApp} className="flex-1 py-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white rounded-lg border border-transparent shadow-sm transition-colors flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Calculator Modal */}
      <Modal isOpen={calcModal.isOpen} onClose={() => setCalcModal({...calcModal, isOpen: false})} title="Measurement Calculator" size="md">
        <div className="space-y-4 p-2">
          {calcModal.category === 'curtain' && (
            <>
              <FormInput label="Track/Rod Width (cm)" type="number" value={calcModal.data.trackWidth} onChange={e => setCalcModal(p => ({...p, data: {...p.data, trackWidth: Number(e.target.value)}}))} />
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Fullness Ratio</label>
                <select value={calcModal.data.fullnessRatio} onChange={e => setCalcModal(p => ({...p, data: {...p.data, fullnessRatio: Number(e.target.value)}}))} className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-sm text-gray-200">
                  {FULLNESS_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <FormInput label="Fabric Width (cm)" type="number" value={calcModal.data.fabricWidth} onChange={e => setCalcModal(p => ({...p, data: {...p.data, fabricWidth: Number(e.target.value)}}))} />
              <FormInput label="Finished Drop (cm)" type="number" value={calcModal.data.finishedDrop} onChange={e => setCalcModal(p => ({...p, data: {...p.data, finishedDrop: Number(e.target.value)}}))} />
              <FormInput label="Pattern Repeat (cm, 0 if plain)" type="number" value={calcModal.data.patternRepeat} onChange={e => setCalcModal(p => ({...p, data: {...p.data, patternRepeat: Number(e.target.value)}}))} />
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Heading Allowance" type="number" value={calcModal.data.headingAllowance} onChange={e => setCalcModal(p => ({...p, data: {...p.data, headingAllowance: Number(e.target.value)}}))} />
                <FormInput label="Hem Allowance" type="number" value={calcModal.data.hemAllowance} onChange={e => setCalcModal(p => ({...p, data: {...p.data, hemAllowance: Number(e.target.value)}}))} />
              </div>
            </>
          )}

          {calcModal.category === 'wallpaper' && (
            <>
              <FormInput label="Total Wall Width (cm)" type="number" value={calcModal.data.wallWidth} onChange={e => setCalcModal(p => ({...p, data: {...p.data, wallWidth: Number(e.target.value)}}))} />
              <FormInput label="Wall Height (cm)" type="number" value={calcModal.data.wallHeight} onChange={e => setCalcModal(p => ({...p, data: {...p.data, wallHeight: Number(e.target.value)}}))} />
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Roll Width (cm)" type="number" value={calcModal.data.rollWidth} onChange={e => setCalcModal(p => ({...p, data: {...p.data, rollWidth: Number(e.target.value)}}))} />
                <FormInput label="Roll Length (cm)" type="number" value={calcModal.data.rollLength} onChange={e => setCalcModal(p => ({...p, data: {...p.data, rollLength: Number(e.target.value)}}))} />
              </div>
              <FormInput label="Pattern Repeat (cm, 0 if plain)" type="number" value={calcModal.data.patternRepeat} onChange={e => setCalcModal(p => ({...p, data: {...p.data, patternRepeat: Number(e.target.value)}}))} />
              <FormInput label="Wastage (%)" type="number" value={calcModal.data.wastagePercent} onChange={e => setCalcModal(p => ({...p, data: {...p.data, wastagePercent: Number(e.target.value)}}))} />
            </>
          )}

          {calcModal.category === 'pvc_plank' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Room Length (ft)" type="number" value={calcModal.data.roomLength} onChange={e => setCalcModal(p => ({...p, data: {...p.data, roomLength: Number(e.target.value)}}))} />
                <FormInput label="Room Width (ft)" type="number" value={calcModal.data.roomWidth} onChange={e => setCalcModal(p => ({...p, data: {...p.data, roomWidth: Number(e.target.value)}}))} />
              </div>
              <FormInput label="Box Coverage (sq ft)" type="number" value={calcModal.data.boxCoverageSqFt} onChange={e => setCalcModal(p => ({...p, data: {...p.data, boxCoverageSqFt: Number(e.target.value)}}))} />
              <FormInput label="Wastage (%)" type="number" value={calcModal.data.wastagePercent} onChange={e => setCalcModal(p => ({...p, data: {...p.data, wastagePercent: Number(e.target.value)}}))} />
            </>
          )}

          <div className="flex justify-end pt-4 mt-2 border-t border-slate-200">
            <button onClick={applyCalculation} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm">Apply & Calculate Qty</button>
          </div>
        </div>
      </Modal>

      {/* Add Customer Modal */}
      <Modal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Quick Add Customer">
        <div className="space-y-4 p-2">
          <FormInput label="Customer Name" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
          <FormInput label="Phone Number" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
          <div className="flex justify-end pt-4 border-t border-slate-200">
            <button onClick={handleCreateCustomer} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
