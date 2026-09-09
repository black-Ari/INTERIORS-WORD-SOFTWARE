/**
 * GSTService — GST calculation for invoices
 * Supports intrastate (CGST+SGST) and interstate (IGST) scenarios.
 */

/**
 * Calculate GST breakdown for a single amount.
 *
 * @param {Object} params
 * @param {number} params.amount       - Taxable amount
 * @param {number} params.gstRate      - GST rate percentage (e.g. 5, 12, 18, 28)
 * @param {boolean} params.isInterstate - true → IGST, false → CGST+SGST
 * @returns {{ cgst: number, sgst: number, igst: number, total: number, cgstRate: number, sgstRate: number, igstRate: number }}
 */
export function calculateGST({ amount, gstRate, isInterstate }) {
  const taxableAmount = Number(amount) || 0
  const rate = Number(gstRate) || 0
  const taxAmount = Math.round((taxableAmount * rate / 100) * 100) / 100

  if (isInterstate) {
    return {
      cgst: 0,
      sgst: 0,
      igst: taxAmount,
      total: taxAmount,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: rate
    }
  }

  // Intrastate: split evenly between CGST and SGST
  const halfRate = rate / 2
  const cgst = Math.round((taxableAmount * halfRate / 100) * 100) / 100
  const sgst = Math.round((taxableAmount * halfRate / 100) * 100) / 100
  // Handle rounding: if cgst + sgst !== taxAmount, adjust sgst
  const adjustedSgst = Math.round((taxAmount - cgst) * 100) / 100

  return {
    cgst,
    sgst: adjustedSgst,
    igst: 0,
    total: cgst + adjustedSgst,
    cgstRate: halfRate,
    sgstRate: halfRate,
    igstRate: 0
  }
}

/**
 * Calculate GST for all line items and produce tax summary.
 *
 * @param {Array<{amount: number, gstRate: number, quantity: number, rate: number, discount: number}>} lineItems
 * @param {boolean} isInterstate
 * @returns {{
 *   lineItemsWithTax: Array,
 *   taxSummary: Array<{gstRate: number, taxableAmount: number, cgst: number, sgst: number, igst: number, total: number}>,
 *   totalCGST: number,
 *   totalSGST: number,
 *   totalIGST: number,
 *   totalTax: number,
 *   subtotal: number
 * }}
 */
export function calculateInvoiceTax(lineItems, isInterstate) {
  const taxSummaryMap = {}
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0
  let subtotal = 0

  const lineItemsWithTax = lineItems.map((item) => {
    const qty = Number(item.quantity) || 0
    const rate = Number(item.rate) || 0
    const discountPct = Number(item.discount_percent) || 0
    const calculatedLineAmount = qty * rate
    const hasExplicitAmount = item.amount !== undefined && item.amount !== null && item.amount !== ''
    const lineAmount = hasExplicitAmount ? Number(item.amount) || 0 : calculatedLineAmount
    const discountAmount = hasExplicitAmount
      ? Math.round((calculatedLineAmount - lineAmount) * 100) / 100
      : Math.round((calculatedLineAmount * discountPct / 100) * 100) / 100
    const taxableAmount = Math.round(lineAmount * 100) / 100

    subtotal += taxableAmount

    const gst = calculateGST({
      amount: taxableAmount,
      gstRate: item.gst_rate || 0,
      isInterstate
    })

    totalCGST += gst.cgst
    totalSGST += gst.sgst
    totalIGST += gst.igst

    // Accumulate tax summary grouped by GST rate
    const rateKey = String(item.gst_rate || 0)
    if (!taxSummaryMap[rateKey]) {
      taxSummaryMap[rateKey] = {
        gstRate: Number(rateKey),
        taxableAmount: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0
      }
    }
    taxSummaryMap[rateKey].taxableAmount += taxableAmount
    taxSummaryMap[rateKey].cgst += gst.cgst
    taxSummaryMap[rateKey].sgst += gst.sgst
    taxSummaryMap[rateKey].igst += gst.igst
    taxSummaryMap[rateKey].total += gst.total

    return {
      ...item,
      lineAmount,
      discountAmount,
      taxableAmount,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      taxAmount: gst.total,
      totalAmount: Math.round((taxableAmount + gst.total) * 100) / 100
    }
  })

  // Round all summary values
  const taxSummary = Object.values(taxSummaryMap).map((s) => ({
    ...s,
    taxableAmount: Math.round(s.taxableAmount * 100) / 100,
    cgst: Math.round(s.cgst * 100) / 100,
    sgst: Math.round(s.sgst * 100) / 100,
    igst: Math.round(s.igst * 100) / 100,
    total: Math.round(s.total * 100) / 100
  }))

  const totalTax = Math.round((totalCGST + totalSGST + totalIGST) * 100) / 100

  return {
    lineItemsWithTax,
    taxSummary,
    totalCGST: Math.round(totalCGST * 100) / 100,
    totalSGST: Math.round(totalSGST * 100) / 100,
    totalIGST: Math.round(totalIGST * 100) / 100,
    totalTax,
    subtotal: Math.round(subtotal * 100) / 100
  }
}
