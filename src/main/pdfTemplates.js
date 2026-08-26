import { numberToIndianWords } from './pdfService.js';
import { generateUPIQR } from './qrGenerator.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrency(num) {
  if (num == null || isNaN(num)) return '0.00';
  return Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQty(num) {
  if (num == null || isNaN(num)) return '0';
  const n = Number(num);
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Normalize & compute all invoice figures from line items.
 * Recomputes missing GST from taxable amount + rate (for older saved invoices).
 * Groups tax by HSN + GST rate (GST compliance).
 */
function computeInvoiceTotals(voucherData) {
  const rawItems = voucherData.items || [];
  const isInterstate = Number(voucherData.is_interstate) === 1;

  const taxGroupMap = {};
  let sumTaxable = 0;
  let sumCGST = 0;
  let sumSGST = 0;
  let sumIGST = 0;

  const items = rawItems.map((item) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discount_percent) || 0;
    const gstRate = Number(item.gst_rate) || 0;

    // Taxable value — prefer stored amount, else calculate from qty × rate − discount
    let taxable = Number(item.amount) || 0;
    if (taxable === 0 && qty > 0 && rate > 0) {
      const lineAmt = qty * rate;
      taxable = Math.round(lineAmt * (1 - discPct / 100) * 100) / 100;
    }

    let cgst = Number(item.cgst_amount) || 0;
    let sgst = Number(item.sgst_amount) || 0;
    let igst = Number(item.igst_amount) || 0;
    let gstAmt = Math.round((cgst + sgst + igst) * 100) / 100;

    // Recompute tax when line has taxable + rate but no stored tax breakdown
    if (gstAmt === 0 && taxable > 0 && gstRate > 0) {
      if (isInterstate) {
        igst = Math.round(taxable * gstRate / 100 * 100) / 100;
        cgst = 0;
        sgst = 0;
      } else {
        const half = gstRate / 2;
        cgst = Math.round(taxable * half / 100 * 100) / 100;
        sgst = Math.round((taxable * gstRate / 100 - cgst) * 100) / 100;
        igst = 0;
      }
      gstAmt = Math.round((cgst + sgst + igst) * 100) / 100;
    }

    const lineTotal = Math.round((taxable + gstAmt) * 100) / 100;
    sumTaxable += taxable;
    sumCGST += cgst;
    sumSGST += sgst;
    sumIGST += igst;

    const hsn = (item.hsn_code || '').trim() || '—';
    const groupKey = `${hsn}__${gstRate}`;
    if (!taxGroupMap[groupKey]) {
      taxGroupMap[groupKey] = { hsn, gstRate, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
    }
    taxGroupMap[groupKey].taxableAmount += taxable;
    taxGroupMap[groupKey].cgst += cgst;
    taxGroupMap[groupKey].sgst += sgst;
    taxGroupMap[groupKey].igst += igst;
    taxGroupMap[groupKey].totalTax += gstAmt;

    return {
      ...item,
      taxableAmount: taxable,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      gstAmount: gstAmt,
      lineTotal
    };
  });

  // Round tax group totals
  const taxGroups = Object.values(taxGroupMap).map((g) => ({
    ...g,
    taxableAmount: Math.round(g.taxableAmount * 100) / 100,
    cgst: Math.round(g.cgst * 100) / 100,
    sgst: Math.round(g.sgst * 100) / 100,
    igst: Math.round(g.igst * 100) / 100,
    totalTax: Math.round(g.totalTax * 100) / 100
  }));

  sumTaxable = Math.round(sumTaxable * 100) / 100;
  sumCGST = Math.round(sumCGST * 100) / 100;
  sumSGST = Math.round(sumSGST * 100) / 100;
  sumIGST = Math.round(sumIGST * 100) / 100;
  const computedTotalTax = Math.round((sumCGST + sumSGST + sumIGST) * 100) / 100;

  const subtotal = Number(voucherData.subtotal) || sumTaxable;
  const cgstTotal = Number(voucherData.cgst_amount) || sumCGST;
  const sgstTotal = Number(voucherData.sgst_amount) || sumSGST;
  const igstTotal = Number(voucherData.igst_amount) || sumIGST;
  const totalTax = Number(voucherData.total_tax) || computedTotalTax;
  const discountAmount = Number(voucherData.discount_amount) || 0;
  const grandTotal = Number(voucherData.grand_total) || Math.round((subtotal + totalTax) * 100) / 100;
  const netAmount = Number(voucherData.net_amount) || grandTotal;
  const roundOff = Number(voucherData.round_off) || Math.round((netAmount - grandTotal) * 100) / 100;

  // Legacy object keyed by GST rate (for older templates)
  const taxGroupsByRate = {};
  for (const g of taxGroups) {
    const rate = String(g.gstRate);
    if (!taxGroupsByRate[rate]) {
      taxGroupsByRate[rate] = { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    taxGroupsByRate[rate].taxableAmount += g.taxableAmount;
    taxGroupsByRate[rate].cgst += g.cgst;
    taxGroupsByRate[rate].sgst += g.sgst;
    taxGroupsByRate[rate].igst += g.igst;
  }

  return {
    items,
    taxGroups,
    taxGroupsByRate,
    isInterstate,
    subtotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    totalTax,
    discountAmount,
    grandTotal,
    netAmount,
    roundOff,
    sumTaxable,
    sumQty: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  };
}

function buildTemplateData(voucherData, companyData) {
  const computed = computeInvoiceTotals(voucherData);
  const items = computed.items;

  const itemRows = items.map((item, idx) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td>${escapeHtml(item.description || item.item_name || '')}</td>
      <td class="center">${escapeHtml(item.hsn_code || '')}</td>
      <td class="right">${formatQty(item.quantity)}</td>
      <td class="center">${escapeHtml(item.unit || '')}</td>
      <td class="right">${formatCurrency(item.rate)}</td>
      <td class="right">${item.discount_percent ? item.discount_percent + '%' : '-'}</td>
      <td class="right">${formatCurrency(item.taxableAmount ?? item.amount)}</td>
    </tr>
  `).join('');

  const isInterstate = computed.isInterstate;
  const amountInWords = numberToIndianWords(computed.netAmount || 0);
  const voucherTypeLabel = {
    sales: 'TAX INVOICE',
    purchase: 'PURCHASE INVOICE',
    credit_note: 'CREDIT NOTE',
    debit_note: 'DEBIT NOTE'
  }[voucherData.voucher_type] || 'TAX INVOICE';

  const qrDataUri = generateUPIQR({
    upiId: companyData.upi_id,
    name: companyData.name,
    amount: computed.netAmount
  });

  return {
    items,
    itemRows,
    taxGroups: computed.taxGroupsByRate,
    taxGroupsDetailed: computed.taxGroups,
    computed,
    isInterstate,
    amountInWords,
    voucherTypeLabel,
    qrDataUri
  };
}

export function generateStandardTemplate(voucherData, companyData) {
  const data = buildTemplateData(voucherData, companyData);
  const c = data.computed;
  const brandColor = companyData.theme_color || '#1e40af';
  
  const taxHeaders = data.isInterstate
    ? '<th>IGST Rate</th><th>IGST Amt</th>'
    : '<th>CGST Rate</th><th>CGST Amt</th><th>SGST Rate</th><th>SGST Amt</th>';

  const taxRows = Object.entries(data.taxGroups)
    .filter(([rate]) => Number(rate) > 0)
    .map(([rate, g]) => {
      const halfRate = (Number(rate) / 2).toFixed(1);
      if (data.isInterstate) {
        return `<tr><td class="right">${formatCurrency(g.taxableAmount)}</td><td class="center">${Number(rate)}%</td><td class="right">${formatCurrency(g.igst)}</td><td class="right">${formatCurrency(g.igst)}</td></tr>`;
      }
      return `<tr><td class="right">${formatCurrency(g.taxableAmount)}</td><td class="center">${halfRate}%</td><td class="right">${formatCurrency(g.cgst)}</td><td class="center">${halfRate}%</td><td class="right">${formatCurrency(g.sgst)}</td><td class="right">${formatCurrency(g.cgst + g.sgst)}</td></tr>`;
    }).join('');

  const taxSummaryHeaders = data.isInterstate
    ? '<th>Taxable Amount</th>' + taxHeaders + '<th>Total Tax</th>'
    : '<th>Taxable Amount</th>' + taxHeaders + '<th>Total Tax</th>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1e293b; padding: 20px 30px; }
  .invoice-wrapper { border: 2px solid ${brandColor}; padding: 0; min-height: 1040px; display: flex; flex-direction: column; }
  .header { background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%); color: #fff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
  .header .company-name { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
  .header .company-details { font-size: 10px; margin-top: 4px; line-height: 1.5; opacity: 0.9; }
  .header .invoice-type { font-size: 16px; font-weight: 700; text-align: right; letter-spacing: 2px; border: 2px solid rgba(255,255,255,0.5); padding: 6px 16px; border-radius: 4px; }
  .meta-section { display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding: 14px 24px; }
  .meta-section .block { flex: 1; }
  .meta-section .block:last-child { text-align: right; }
  .meta-section .label { font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 2px; }
  .meta-section .value { font-size: 12px; font-weight: 600; color: #0f172a; }
  .meta-section .customer-name { font-size: 14px; }
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table th { background: #f1f5f9; color: #334155; font-weight: 600; font-size: 10px; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid ${brandColor}; border-top: 1px solid #cbd5e1; }
  .items-table td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  .items-table tr:last-child td { border-bottom: 2px solid ${brandColor}; }
  .center { text-align: center; } .right { text-align: right; }
  .tax-section { padding: 10px 24px; border-bottom: 1px solid #cbd5e1; }
  .tax-section h4 { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
  .tax-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .tax-table th { background: #f8fafc; padding: 5px 8px; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
  .tax-table td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  .totals-section { display: flex; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid #cbd5e1; }
  .amount-words { flex: 1.5; font-size: 11px; font-style: italic; padding-right: 20px; }
  .totals-box { flex: 1; }
  .totals-box .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
  .totals-box .row.grand { font-size: 14px; font-weight: 700; color: ${brandColor}; border-top: 2px solid ${brandColor}; margin-top: 4px; padding-top: 6px; }
  .footer { display: flex; justify-content: space-between; padding: 14px 24px; font-size: 10px; color: #475569; background: #f8fafc; }
  .footer .bank-details { flex: 1.5; }
  .footer .auth-section { flex: 1; text-align: right; display: flex; flex-direction: column; justify-content: flex-end; }
  .footer .auth-section .sig-line { border-top: 1px solid #94a3b8; padding-top: 4px; margin-top: 30px; font-size: 10px; }
</style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="header">
      <div style="display: flex; align-items: center; gap: 15px;">
        ${companyData.logo ? `<img src="${companyData.logo}" alt="Logo" style="max-height: 60px; max-width: 150px; object-fit: contain; border-radius: 4px; background: white; padding: 4px;">` : ''}
        <div>
          <div class="company-name">${escapeHtml(companyData.name || 'INTERIORS WORD')}</div>
          <div class="company-details">${escapeHtml(companyData.address || '')}<br>Phone: ${escapeHtml(companyData.phone || '')} &nbsp;|&nbsp; GSTIN: ${escapeHtml(companyData.gstin || '')}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        ${data.qrDataUri ? `<div style="background: white; padding: 4px; border-radius: 6px; text-align: center; border: 1px solid rgba(255,255,255,0.4);"><img src="${data.qrDataUri}" alt="UPI QR" style="width: 65px; height: 65px; display: block;"><div style="font-size: 7px; color: #1e293b; font-weight: bold; margin-top: 1px;">SCAN TO PAY</div></div>` : ''}
        <div class="invoice-type">${data.voucherTypeLabel}</div>
      </div>
    </div>
    <div class="meta-section">
      <div class="block">
        <div class="label">Bill To</div>
        <div class="value customer-name">${escapeHtml(voucherData.ledger_name || '')}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px;">
          ${escapeHtml(voucherData.ledger_address || '')}<br>
          ${voucherData.ledger_gstin ? 'GSTIN: ' + escapeHtml(voucherData.ledger_gstin) : ''}
          ${voucherData.ledger_phone ? '&nbsp;|&nbsp; Phone: ' + escapeHtml(voucherData.ledger_phone) : ''}
        </div>
      </div>
      <div class="block">
        <div class="label">Invoice Number</div>
        <div class="value">${escapeHtml(voucherData.voucher_number || '')}</div>
        <div style="margin-top:8px;"><div class="label">Date</div><div class="value">${escapeHtml(formatDate(voucherData.date))}</div></div>
      </div>
    </div>
    <div style="flex: 1;">
      <table class="items-table">
        <thead><tr><th style="width:5%">S.No</th><th style="width:30%">Description</th><th style="width:10%">HSN</th><th style="width:8%">Qty</th><th style="width:7%">Unit</th><th style="width:12%">Rate (₹)</th><th style="width:8%">Disc</th><th style="width:14%">Amount (₹)</th></tr></thead>
        <tbody>${data.itemRows}</tbody>
      </table>
    </div>
    <div class="tax-section">
      <h4>Tax Summary</h4>
      <table class="tax-table">
        <thead><tr>${taxSummaryHeaders}</tr></thead>
        <tbody>${taxRows}</tbody>
      </table>
    </div>
    <div class="totals-section">
      <div class="amount-words"><b>Amount in Words:</b><br>${escapeHtml(data.amountInWords)}</div>
      <div class="totals-box">
        <div class="row"><span>Subtotal</span><span>₹ ${formatCurrency(c.subtotal)}</span></div>
        ${!data.isInterstate ? `
        <div class="row"><span>CGST</span><span>₹ ${formatCurrency(c.cgstTotal)}</span></div>
        <div class="row"><span>SGST</span><span>₹ ${formatCurrency(c.sgstTotal)}</span></div>
        ` : `<div class="row"><span>IGST</span><span>₹ ${formatCurrency(c.igstTotal)}</span></div>`}
        ${c.discountAmount ? `<div class="row"><span>Discount</span><span>- ₹ ${formatCurrency(c.discountAmount)}</span></div>` : ''}
        ${Math.abs(c.roundOff) >= 0.01 ? `<div class="row"><span>Round Off</span><span>₹ ${formatCurrency(c.roundOff)}</span></div>` : ''}
        <div class="row grand"><span>Net Amount</span><span>₹ ${formatCurrency(c.netAmount)}</span></div>
      </div>
    </div>
    <div class="footer">
      <div class="bank-details" style="display: flex; align-items: flex-start; gap: 12px;">
        <div>
          <h4>Bank Details</h4>Bank: ${escapeHtml(companyData.bank_name || 'N/A')}<br>A/C No: ${escapeHtml(companyData.account_no || 'N/A')}<br>IFSC: ${escapeHtml(companyData.ifsc || 'N/A')}
          ${companyData.upi_id ? `<br>UPI: ${escapeHtml(companyData.upi_id)}` : ''}
        </div>
      </div>
      <div class="auth-section">
        <div>For <strong>${escapeHtml(companyData.name || 'INTERIORS WORD')}</strong></div>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function generateModernTemplate(voucherData, companyData) {
  const data = buildTemplateData(voucherData, companyData);
  const brandColor = companyData.theme_color || '#0d9488';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; font-size: 12px; color: #334155; padding: 30px; }
  .invoice-wrapper { border-top: 8px solid ${brandColor}; background: #fff; min-height: 1020px; display: flex; flex-direction: column; padding-top: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .header { display: flex; justify-content: space-between; padding: 0 30px 20px; border-bottom: 2px solid #f1f5f9; }
  .header-right { text-align: right; }
  .company-name { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
  .invoice-title { font-size: 32px; font-weight: 300; color: ${brandColor}; letter-spacing: 2px; text-transform: uppercase; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 20px 30px; }
  .meta-box { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid ${brandColor}; }
  .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
  .items-table { width: calc(100% - 60px); margin: 20px 30px; border-collapse: collapse; }
  .items-table th { background: ${brandColor}; color: #fff; text-transform: uppercase; font-size: 10px; padding: 10px; text-align: left; }
  .items-table th.center { text-align: center; } .items-table th.right { text-align: right; }
  .items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
  .center { text-align: center; } .right { text-align: right; }
  .totals-section { display: flex; justify-content: space-between; padding: 20px 30px; margin-top: auto; }
  .bank-box { background: #f1f5f9; padding: 15px; border-radius: 8px; width: 60%; font-size: 11px; }
  .totals-box { width: 35%; }
  .totals-box .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #475569; }
  .totals-box .row.grand { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 8px; }
  .footer { text-align: center; padding: 20px 30px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 10px; }
</style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="header">
      <div>
        ${companyData.logo ? `<img src="${companyData.logo}" style="height: 50px; margin-bottom: 10px;">` : ''}
        <div class="company-name">${escapeHtml(companyData.name)}</div>
        <div style="color: #64748b;">${escapeHtml(companyData.address)}<br>GSTIN: ${escapeHtml(companyData.gstin)} | Ph: ${escapeHtml(companyData.phone)}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        ${data.qrDataUri ? `<div style="background: #ffffff; padding: 5px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.08);"><img src="${data.qrDataUri}" alt="UPI QR" style="width: 70px; height: 70px; display: block;"><div style="font-size: 8px; color: #1e293b; font-weight: 700; margin-top: 2px;">SCAN TO PAY</div></div>` : ''}
        <div class="header-right">
          <div class="invoice-title">${data.voucherTypeLabel}</div>
          <div style="margin-top: 10px; font-size: 14px;"><strong>#${escapeHtml(voucherData.voucher_number)}</strong></div>
          <div style="color: #64748b;">Date: ${escapeHtml(formatDate(voucherData.date))}</div>
        </div>
      </div>
    </div>
    
    <div class="meta-grid">
      <div class="meta-box">
        <div class="label">Billed To</div>
        <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">${escapeHtml(voucherData.ledger_name)}</div>
        <div style="color: #475569; font-size: 11px;">
          ${escapeHtml(voucherData.ledger_address)}<br>
          ${voucherData.ledger_gstin ? `GSTIN: ${escapeHtml(voucherData.ledger_gstin)}<br>` : ''}
          ${voucherData.ledger_phone ? `Phone: ${escapeHtml(voucherData.ledger_phone)}` : ''}
        </div>
      </div>
      <div class="meta-box" style="border-left-color: #3b82f6;">
        <div class="label">Amount Due</div>
        <div style="font-size: 24px; font-weight: 800; color: #0f172a;">₹ ${formatCurrency(voucherData.net_amount)}</div>
        <div style="color: #64748b; font-size: 11px; margin-top: 4px; font-style: italic;">${escapeHtml(data.amountInWords)}</div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th class="center">HSN</th>
          <th class="right">Qty</th>
          <th class="right">Rate</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr>
            <td><strong>${escapeHtml(item.description || item.item_name)}</strong></td>
            <td class="center">${escapeHtml(item.hsn_code)}</td>
            <td class="right">${formatQty(item.quantity)} ${escapeHtml(item.unit)}</td>
            <td class="right">${formatCurrency(item.rate)}</td>
            <td class="right"><strong>${formatCurrency(item.amount)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="bank-box">
        <div style="display: flex; align-items: flex-start; gap: 15px;">
          <div style="flex: 1;">
            <div class="label">Payment Details</div>
            <strong>Bank:</strong> ${escapeHtml(companyData.bank_name)}<br>
            <strong>A/C No:</strong> ${escapeHtml(companyData.account_no)}<br>
            <strong>IFSC:</strong> ${escapeHtml(companyData.ifsc)}<br>
            ${companyData.upi_id ? `<strong>UPI:</strong> ${escapeHtml(companyData.upi_id)}<br>` : ''}
          </div>
        </div>
        <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; width: 200px; padding-top: 4px; text-align: center;">Authorised Signatory</div>
      </div>
      
      <div class="totals-box">
        <div class="row"><span>Subtotal:</span><span>₹ ${formatCurrency(voucherData.subtotal)}</span></div>
        ${!data.isInterstate ? `
        <div class="row"><span>CGST:</span><span>₹ ${formatCurrency(voucherData.cgst_amount)}</span></div>
        <div class="row"><span>SGST:</span><span>₹ ${formatCurrency(voucherData.sgst_amount)}</span></div>
        ` : `<div class="row"><span>IGST:</span><span>₹ ${formatCurrency(voucherData.igst_amount)}</span></div>`}
        ${voucherData.discount_amount ? `<div class="row text-red-500"><span>Discount:</span><span>- ₹ ${formatCurrency(voucherData.discount_amount)}</span></div>` : ''}
        ${voucherData.round_off ? `<div class="row"><span>Round Off:</span><span>₹ ${formatCurrency(voucherData.round_off)}</span></div>` : ''}
        <div class="row grand"><span>Total:</span><span>₹ ${formatCurrency(voucherData.net_amount)}</span></div>
      </div>
    </div>

    <div class="footer">
      Thank you for your business. | Goods once sold will not be taken back.
    </div>
  </div>
</body>
</html>`;
}

export function generateMinimalistTemplate(voucherData, companyData) {
  const data = buildTemplateData(voucherData, companyData);
  // Black and white, ultra minimal
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #000; padding: 40px; }
  .invoice-wrapper { min-height: 1000px; display: flex; flex-direction: column; }
  .title { font-size: 20px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 40px; border-bottom: 1px solid #000; padding-bottom: 10px; }
  .grid { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .col { width: 45%; }
  .label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px; }
  .value { font-size: 12px; line-height: 1.6; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
  .items-table th { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #000; padding: 8px 0; text-align: left; }
  .items-table td { padding: 12px 0; border-bottom: 1px solid #eee; }
  .right { text-align: right; }
  .totals-grid { display: flex; justify-content: flex-end; }
  .totals { width: 300px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .grand { font-size: 14px; font-weight: bold; border-top: 1px solid #000; margin-top: 8px; padding-top: 8px; }
  .footer { margin-top: auto; border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
</style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="title">${data.voucherTypeLabel}</div>
    
    <div class="grid">
      <div class="col">
        <div class="label">From</div>
        <div class="value">
          <strong>${escapeHtml(companyData.name)}</strong><br>
          ${escapeHtml(companyData.address)}<br>
          GSTIN: ${escapeHtml(companyData.gstin)}<br>
          Ph: ${escapeHtml(companyData.phone)}
        </div>
      </div>
      <div class="col right" style="display: flex; justify-content: flex-end; align-items: flex-start; gap: 15px;">
        ${data.qrDataUri ? `<div style="background: #ffffff; padding: 4px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;"><img src="${data.qrDataUri}" alt="UPI QR" style="width: 60px; height: 60px; display: block;"><div style="font-size: 7px; color: #0f172a; font-weight: 700; margin-top: 2px;">SCAN TO PAY</div></div>` : ''}
        <div>
          <div class="label">Invoice Details</div>
          <div class="value">
            <strong>No: ${escapeHtml(voucherData.voucher_number)}</strong><br>
            Date: ${escapeHtml(formatDate(voucherData.date))}
          </div>
        </div>
      </div>
    </div>

    <div class="grid" style="margin-bottom: 60px;">
      <div class="col">
        <div class="label">Billed To</div>
        <div class="value">
          <strong>${escapeHtml(voucherData.ledger_name)}</strong><br>
          ${escapeHtml(voucherData.ledger_address)}<br>
          ${voucherData.ledger_gstin ? `GSTIN: ${escapeHtml(voucherData.ledger_gstin)}` : ''}
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50%">Item</th>
          <th class="right">Qty</th>
          <th class="right">Rate</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
          <tr>
            <td>${escapeHtml(item.description || item.item_name)}</td>
            <td class="right">${formatQty(item.quantity)} ${escapeHtml(item.unit)}</td>
            <td class="right">${formatCurrency(item.rate)}</td>
            <td class="right">${formatCurrency(item.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals-grid">
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${formatCurrency(voucherData.subtotal)}</span></div>
        ${!data.isInterstate ? `
        <div class="row"><span>CGST</span><span>${formatCurrency(voucherData.cgst_amount)}</span></div>
        <div class="row"><span>SGST</span><span>${formatCurrency(voucherData.sgst_amount)}</span></div>
        ` : `<div class="row"><span>IGST</span><span>${formatCurrency(voucherData.igst_amount)}</span></div>`}
        ${voucherData.discount_amount ? `<div class="row"><span>Discount</span><span>-${formatCurrency(voucherData.discount_amount)}</span></div>` : ''}
        <div class="row grand"><span>Total INR</span><span>${formatCurrency(voucherData.net_amount)}</span></div>
      </div>
    </div>

    <div style="margin-top: 40px;">
      <div class="label">Amount in Words</div>
      <div style="font-size: 10px;">${escapeHtml(data.amountInWords)}</div>
    </div>

    <div class="footer">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div>
          <strong>Bank Details:</strong> ${escapeHtml(companyData.bank_name)} | A/C: ${escapeHtml(companyData.account_no)} | IFSC: ${escapeHtml(companyData.ifsc)}
          ${companyData.upi_id ? `| UPI: ${escapeHtml(companyData.upi_id)}` : ''}
        </div>
      </div>
      <div>Authorised Signatory</div>
    </div>
  </div>
</body>
</html>`;
}

export function generateExecutiveTemplate(voucherData, companyData) {
  const data = buildTemplateData(voucherData, companyData);
  const c = data.computed;
  const brandColor = companyData.theme_color || '#2563eb';

  const taxHeaders = data.isInterstate
    ? '<th>IGST Rate</th><th>IGST Amt</th>'
    : '<th>CGST Rate</th><th>CGST Amt</th><th>SGST Rate</th><th>SGST Amt</th>';

  const taxRows = Object.entries(data.taxGroups)
    .filter(([rate]) => Number(rate) > 0)
    .map(([rate, g]) => {
      const halfRate = (Number(rate) / 2).toFixed(1);
      if (data.isInterstate) {
        return `<tr><td class="right">${formatCurrency(g.taxableAmount)}</td><td class="center">${Number(rate)}%</td><td class="right">${formatCurrency(g.igst)}</td><td class="right">${formatCurrency(g.igst)}</td></tr>`;
      }
      return `<tr><td class="right">${formatCurrency(g.taxableAmount)}</td><td class="center">${halfRate}%</td><td class="right">${formatCurrency(g.cgst)}</td><td class="center">${halfRate}%</td><td class="right">${formatCurrency(g.sgst)}</td><td class="right">${formatCurrency(g.cgst + g.sgst)}</td></tr>`;
    }).join('');

  const taxSummaryHeaders = data.isInterstate
    ? '<th>Taxable Amount</th>' + taxHeaders + '<th>Total Tax</th>'
    : '<th>Taxable Amount</th>' + taxHeaders + '<th>Total Tax</th>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1e293b; padding: 25px 35px; }
  .invoice-wrapper { border: 1px solid #cbd5e1; border-top: 10px solid ${brandColor}; padding: 0; min-height: 1040px; display: flex; flex-direction: column; background: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
  .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 24px 30px; border-bottom: 2px solid #f1f5f9; }
  .logo-area { display: flex; align-items: center; gap: 16px; }
  .company-name { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
  .company-details { font-size: 11px; color: #64748b; line-height: 1.5; margin-top: 4px; }
  .voucher-badge { background: ${brandColor}; color: #ffffff; padding: 8px 20px; font-size: 16px; font-weight: 800; letter-spacing: 2px; border-radius: 6px; text-transform: uppercase; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
  .meta-card { background: #ffffff; padding: 14px 18px; border-radius: 8px; border: 1px solid #e2e8f0; border-left: 4px solid ${brandColor}; }
  .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
  .value { font-size: 12px; font-weight: 600; color: #0f172a; }
  .customer-name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .items-table { width: calc(100% - 60px); margin: 24px 30px; border-collapse: collapse; }
  .items-table th { background: ${brandColor}; color: #ffffff; font-weight: 700; font-size: 10px; text-transform: uppercase; padding: 10px 12px; border: none; }
  .items-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #334155; }
  .items-table tr:nth-child(even) td { background: #f8fafc; }
  .items-table tr:last-child td { border-bottom: 2px solid ${brandColor}; }
  .center { text-align: center; } .right { text-align: right; }
  .tax-section { padding: 10px 30px; border-bottom: 1px solid #e2e8f0; }
  .tax-section h4 { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
  .tax-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .tax-table th { background: #f8fafc; padding: 6px 10px; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
  .tax-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  .totals-section { display: flex; justify-content: space-between; padding: 20px 30px; margin-top: auto; border-top: 1px solid #e2e8f0; }
  .amount-words { flex: 1.4; font-size: 11px; font-style: italic; color: #475569; padding-right: 20px; }
  .totals-box { flex: 1; background: #f8fafc; padding: 16px 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .totals-box .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #475569; }
  .totals-box .row.grand { font-size: 16px; font-weight: 800; color: ${brandColor}; border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 10px; }
  .footer { display: flex; justify-content: space-between; align-items: center; padding: 18px 30px; background: #0f172a; color: #f8fafc; font-size: 11px; }
  .footer strong { color: ${brandColor}; }
</style>
</head>
<body>
  <div class="invoice-wrapper">
    <div class="top-bar">
      <div class="logo-area">
        ${companyData.logo ? `<img src="${companyData.logo}" alt="Logo" style="max-height: 70px; max-width: 170px; object-fit: contain; border-radius: 6px; background: #ffffff; padding: 4px;">` : ''}
        <div>
          <div class="company-name">${escapeHtml(companyData.name || 'INTERIORS WORD')}</div>
          <div class="company-details">${escapeHtml(companyData.address || '')}<br>Phone: ${escapeHtml(companyData.phone || '')} &nbsp;|&nbsp; GSTIN: ${escapeHtml(companyData.gstin || '')}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        ${data.qrDataUri ? `<div style="background: #ffffff; padding: 4px; border-radius: 6px; text-align: center; border: 1px solid rgba(0,0,0,0.1);"><img src="${data.qrDataUri}" alt="UPI QR" style="width: 65px; height: 65px; display: block;"><div style="font-size: 7px; color: #0f172a; font-weight: 700; margin-top: 1px;">SCAN TO PAY</div></div>` : ''}
        <div class="voucher-badge">${data.voucherTypeLabel}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="label">Bill To (Customer)</div>
        <div class="customer-name">${escapeHtml(voucherData.ledger_name || '')}</div>
        ${voucherData.ledger_address ? `<div class="value" style="font-weight: 400; color: #475569;">${escapeHtml(voucherData.ledger_address)}</div>` : ''}
        ${voucherData.ledger_phone ? `<div class="value" style="margin-top: 4px;">Phone: ${escapeHtml(voucherData.ledger_phone)}</div>` : ''}
        ${voucherData.ledger_gstin ? `<div class="value">GSTIN: ${escapeHtml(voucherData.ledger_gstin)}</div>` : ''}
      </div>
      <div class="meta-card">
        <div class="label">Invoice Details</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Invoice No:</span>
          <strong>#${escapeHtml(voucherData.voucher_number)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Date:</span>
          <strong>${formatDate(voucherData.date)}</strong>
        </div>
        ${voucherData.po_number ? `
        <div style="display: flex; justify-content: space-between;">
          <span>PO Number:</span>
          <strong>${escapeHtml(voucherData.po_number)}</strong>
        </div>` : ''}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width: 5%;">#</th>
          <th style="width: 35%;">Item Description</th>
          <th class="center" style="width: 10%;">HSN/SAC</th>
          <th class="right" style="width: 10%;">Qty</th>
          <th class="center" style="width: 8%;">Unit</th>
          <th class="right" style="width: 12%;">Rate</th>
          <th class="right" style="width: 8%;">Dis%</th>
          <th class="right" style="width: 12%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.itemRows}
      </tbody>
    </table>

    ${taxRows ? `
    <div class="tax-section">
      <h4>Tax Breakdown</h4>
      <table class="tax-table">
        <thead><tr>${taxSummaryHeaders}</tr></thead>
        <tbody>${taxRows}</tbody>
      </table>
    </div>` : ''}

    <div class="totals-section">
      <div class="amount-words">
        <div class="label" style="margin-bottom: 6px;">Amount in Words</div>
        <div>${escapeHtml(data.amountInWords)}</div>
      </div>
      <div class="totals-box">
        <div class="row"><span>Subtotal:</span><span>${formatCurrency(c.subtotal)}</span></div>
        ${!data.isInterstate ? `
        <div class="row"><span>CGST:</span><span>${formatCurrency(c.cgstTotal)}</span></div>
        <div class="row"><span>SGST:</span><span>${formatCurrency(c.sgstTotal)}</span></div>
        ` : `<div class="row"><span>IGST:</span><span>${formatCurrency(c.igstTotal)}</span></div>`}
        ${c.discountAmount ? `<div class="row" style="color: #16a34a;"><span>Discount:</span><span>-${formatCurrency(c.discountAmount)}</span></div>` : ''}
        <div class="row grand"><span>Total INR:</span><span>₹ ${formatCurrency(c.netAmount)}</span></div>
      </div>
    </div>

    <div class="footer">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div>
          <div style="font-size: 12px; font-weight: 700; margin-bottom: 3px;">Payment Information</div>
          <div>Bank: ${escapeHtml(companyData.bank_name)} &nbsp;|&nbsp; A/C: ${escapeHtml(companyData.account_no)} &nbsp;|&nbsp; IFSC: ${escapeHtml(companyData.ifsc)}</div>
          ${companyData.upi_id ? `<div style="margin-top: 2px;">UPI ID: <strong>${escapeHtml(companyData.upi_id)}</strong></div>` : ''}
        </div>
      </div>
      <div style="text-align: right;">
        <div style="margin-top: 25px; border-top: 1px solid #475569; padding-top: 6px; color: #cbd5e1;">Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================
// INTERIORS WORLD TEMPLATE — exact match to printed GST bill
// ============================================================
export function generateInteriorsTemplate(voucherData, companyData) {
  const data = buildTemplateData(voucherData, companyData);
  const c = data.computed;

  /* ── Item rows: 8 columns matching the printed bill ─────────────────────
     No | Particular | HSN/SAC | Quantity | Unit | Price/Unit(₹) | GST(₹) | Amount(₹)
     GST column shows amount on top and (rate%) below                        */
  const itemRows = c.items.map((item, idx) => {
    const gstRate  = Number(item.gst_rate) || 0;
    const taxable  = item.taxableAmount ?? item.amount ?? 0;
    const gstAmt   = item.gstAmount ?? 0;
    const lineTotal = item.lineTotal ?? (taxable + gstAmt);
    return `<tr>
      <td class="c">${idx + 1}</td>
      <td>${escapeHtml(item.description || item.item_name || '')}</td>
      <td class="c">${escapeHtml((item.hsn_code || '').trim() || '')}</td>
      <td class="c">${formatQty(item.quantity)}</td>
      <td class="c">${escapeHtml(item.unit || '')}</td>
      <td class="r">&#8377; ${formatCurrency(item.rate)}</td>
      <td class="c"><div>&#8377; ${formatCurrency(gstAmt)}</div><div class="gst-pct">(${gstRate}%)</div></td>
      <td class="r"><strong>&#8377; ${formatCurrency(lineTotal)}</strong></td>
    </tr>`;
  }).join('');

  /* ── Tax Summary table (HSN-wise) ─────────────────────────────────────── */
  const taxSummaryRows = data.taxGroupsDetailed
    .filter((g) => g.gstRate > 0 || g.taxableAmount > 0)
    .map((g) => {
      if (data.isInterstate) {
        return `<tr>
          <td class="c">${escapeHtml(g.hsn)}</td>
          <td class="r">${formatCurrency(g.taxableAmount)}</td>
          <td class="c" colspan="2">${g.gstRate}%</td>
          <td class="r" colspan="2">${formatCurrency(g.igst)}</td>
          <td class="r"><strong>${formatCurrency(g.totalTax)}</strong></td>
        </tr>`;
      }
      const halfRate = (g.gstRate / 2).toFixed(1);
      return `<tr>
        <td class="c">${escapeHtml(g.hsn)}</td>
        <td class="r">${formatCurrency(g.taxableAmount)}</td>
        <td class="c">${halfRate}</td>
        <td class="r">${formatCurrency(g.cgst)}</td>
        <td class="c">${halfRate}</td>
        <td class="r">${formatCurrency(g.sgst)}</td>
        <td class="r"><strong>${formatCurrency(g.totalTax)}</strong></td>
      </tr>`;
    }).join('');

  /* Tax summary footer totals */
  const taxFooterCols = data.isInterstate
    ? `<td class="c"><b>TOTAL</b></td>
       <td class="r"><b>${formatCurrency(c.subtotal)}</b></td>
       <td colspan="2"></td>
       <td class="r" colspan="2"><b>${formatCurrency(c.igstTotal)}</b></td>
       <td class="r"><b>${formatCurrency(c.totalTax)}</b></td>`
    : `<td class="c"><b>TOTAL</b></td>
       <td class="r"><b>${formatCurrency(c.subtotal)}</b></td>
       <td></td>
       <td class="r"><b>${formatCurrency(c.cgstTotal)}</b></td>
       <td></td>
       <td class="r"><b>${formatCurrency(c.sgstTotal)}</b></td>
       <td class="r"><b>${formatCurrency(c.totalTax)}</b></td>`;

  /* Tax summary header */
  const taxHeadCols = data.isInterstate
    ? `<th>HSN/SAC</th>
       <th>Taxable Amount (&#8377;)</th>
       <th colspan="2">IGST Rate (%)</th>
       <th colspan="2">Amt (&#8377;)</th>
       <th>Total Tax(&#8377;)</th>`
    : `<th>HSN/SAC</th>
       <th>Taxable Amount (&#8377;)</th>
       <th>CGST<br>Rate (%)</th>
       <th>Amt (&#8377;)</th>
       <th>SGST<br>Rate (%)</th>
       <th>Amt (&#8377;)</th>
       <th>Total Tax(&#8377;)</th>`;

  /* ── Computed values ───────────────────────────────────────────────────── */
  const received    = Number(voucherData.received_amount) || 0;
  const balance     = Math.round((c.netAmount - received) * 100) / 100;
  const paymentMode = voucherData.payment_mode || 'Credit';
  const stateCode   = companyData.state_code || '';
  const stateName   = companyData.state_name || '';
  const placeOfSupply = voucherData.place_of_supply
    || (voucherData.ledger_state_code
      ? `${voucherData.ledger_state_code}${voucherData.ledger_state_name ? '-' + voucherData.ledger_state_name : ''}`
      : (stateCode ? `${stateCode}${stateName ? '-' + stateName : ''}` : ''));

  const termsText = companyData.terms
    || '*Thank you for doing business with us.*\n*Order once finalized will not be cancelled*\n*There will No Responsibility of Us in Labour Work *\n*Expenses Extra For Goods*';
  const termsLines = termsText.split('\n').map((l) => `<div>${escapeHtml(l)}</div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size:11px; color:#000; background:#fff; padding:10px 14px; }

  /* ── Title ─────────────────────────────────────────── */
  .inv-title {
    text-align:center; font-size:22px; font-weight:bold;
    margin-bottom:6px; letter-spacing:1px; color:#000;
  }

  /* ── Company header row ────────────────────────────── */
  .co-box {
    border:2px solid #333; display:flex; align-items:center;
    gap:12px; padding:8px 12px;
  }
  .co-logo img { width:80px; height:80px; object-fit:contain; }
  .co-logo-ph {
    width:80px; height:80px;
    background:linear-gradient(135deg,#1a3a6b,#c8102e);
    border-radius:6px; display:flex; align-items:center;
    justify-content:center; color:#fff; font-size:18px; font-weight:900;
  }
  .co-info { flex:1; }
  .co-info .co-name {
    font-size:20px; font-weight:900; color:#000;
    letter-spacing:1px; margin-bottom:2px;
  }
  .co-info .co-det {
    font-size:9.5px; color:#222; line-height:1.7;
  }

  /* ── Bill-To + Invoice Details side-by-side ─────────── */
  .meta-row { display:flex; border:2px solid #333; border-top:none; }
  .meta-col { flex:1; padding:6px 10px; }
  .meta-col + .meta-col { border-left:1px solid #555; }
  .meta-col .sec-hd {
    font-size:10.5px; font-weight:bold; color:#000;
    border-bottom:1px solid #999; margin-bottom:4px; padding-bottom:2px;
  }
  .cust-name { font-size:12px; font-weight:bold; margin-bottom:3px; }
  .cust-sub  { font-size:10px; color:#333; margin-bottom:2px; }
  .mrow { display:flex; gap:4px; font-size:10px; margin-bottom:2px; }
  .mrow .ml { min-width:100px; color:#333; }
  .mrow .mv { font-weight:600; }

  /* ── Ship-To ───────────────────────────────────────── */
  .ship-row {
    border:2px solid #333; border-top:none;
    padding:4px 10px; font-size:10px;
  }

  /* ── Items table ───────────────────────────────────── */
  .it {
    width:100%; border-collapse:collapse;
    border-left:2px solid #333; border-right:2px solid #333;
    border-bottom:2px solid #333;
  }
  .it th {
    background:#e0e0e0; font-size:9.5px; font-weight:bold;
    padding:5px 4px; border:1px solid #555; text-align:center;
    color:#000;
  }
  .it td {
    padding:4px 4px; border:1px solid #aaa;
    font-size:10px; vertical-align:middle;
  }
  .it tfoot td {
    font-weight:bold; background:#e0e0e0;
    border:1px solid #555; font-size:10px;
  }
  .c { text-align:center; }
  .r { text-align:right; }
  .l { text-align:left; }
  .gst-pct { font-size:8px; color:#555; margin-top:1px; }

  /* ── Bottom split: Tax Summary left | Totals right ─── */
  .bot {
    display:flex;
    border-left:2px solid #333; border-right:2px solid #333;
    border-bottom:2px solid #333;
    min-height:120px;
  }
  .tax-side { flex:1.7; border-right:1px solid #555; }
  .tot-side { flex:1; display:flex; flex-direction:column; }

  /* Tax summary sub-table */
  .tax-hd {
    font-size:10px; font-weight:bold; padding:4px 8px;
    background:#e0e0e0; border-bottom:1px solid #555;
  }
  .tt { width:100%; border-collapse:collapse; }
  .tt th {
    font-size:8px; font-weight:bold; padding:4px 3px;
    border:1px solid #aaa; background:#e0e0e0;
    text-align:center; color:#000;
  }
  .tt td {
    font-size:9px; padding:3px 3px;
    border:1px solid #ccc;
  }
  .tt tfoot td {
    font-weight:bold; background:#e0e0e0;
    border:1px solid #555;
  }

  /* Totals column on the right */
  .tot-row {
    display:flex; justify-content:space-between;
    padding:3px 10px; border-bottom:1px solid #ddd;
    font-size:10px;
  }
  .tot-row.grand {
    font-weight:bold; font-size:11px;
    border-top:2px solid #333; background:#f5f5f5;
    padding:5px 10px;
  }
  .words-box {
    padding:4px 10px; font-size:9px;
    border-bottom:1px solid #ccc; line-height:1.4;
  }
  .words-box b { font-style:normal; }
  .rec-box { padding:4px 10px; border-bottom:1px solid #ccc; }
  .rrow {
    display:flex; justify-content:space-between;
    font-size:10px; padding:2px 0;
  }
  .rrow.bold { font-weight:bold; }
  .pay-box {
    padding:4px 10px; font-size:10px; margin-top:auto;
  }

  /* ── Terms ─────────────────────────────────────────── */
  .terms-box {
    border-left:2px solid #333; border-right:2px solid #333;
    border-bottom:2px solid #333;
    padding:5px 10px; font-size:9px;
  }
  .terms-box .tlbl {
    font-weight:bold; font-size:10px; margin-bottom:3px;
  }

  /* ── Footer: Bank + Signature ──────────────────────── */
  .foot-row {
    display:flex;
    border-left:2px solid #333; border-right:2px solid #333;
    border-bottom:2px solid #333;
  }
  .bank-col {
    flex:1.5; padding:7px 10px; border-right:1px solid #555;
    display:flex; gap:10px; align-items:flex-start;
  }
  .bank-txt { font-size:9.5px; line-height:1.65; }
  .bank-txt b { font-size:10px; display:block; margin-bottom:2px; }
  .sign-col {
    flex:1; padding:7px 10px;
    display:flex; flex-direction:column; justify-content:space-between;
  }
  .for-lbl { font-size:10px; font-weight:bold; }
  .sig-line {
    margin-top:30px; border-top:1px solid #999;
    padding-top:4px; font-size:10px; text-align:center;
  }
</style>
</head>
<body>

  <div class="inv-title">${escapeHtml(data.voucherTypeLabel)}</div>

  <!-- ═══ Company Header ═══ -->
  <div class="co-box">
    <div class="co-logo">
      ${companyData.logo
        ? `<img src="${companyData.logo}" alt="Logo">`
        : `<div class="co-logo-ph">${escapeHtml((companyData.name || 'IW').substring(0, 2).toUpperCase())}</div>`
      }
    </div>
    <div class="co-info">
      <div class="co-name">${escapeHtml(companyData.name || 'INTERIORS WORLD')}</div>
      <div class="co-det">
        ${companyData.address ? escapeHtml(companyData.address) + '<br>' : ''}
        ${companyData.phone ? 'Phone: <strong>' + escapeHtml(companyData.phone) + '</strong>' : ''}
        ${companyData.email ? ' &nbsp;&nbsp;Email: <strong>' + escapeHtml(companyData.email) + '</strong>' : ''}<br>
        GSTIN: <strong>${escapeHtml(companyData.gstin || '—')}</strong>
        ${stateCode ? ' &nbsp;&nbsp;State: <strong>' + escapeHtml(stateCode + (stateName ? '-' + stateName : '')) + '</strong>' : ''}
      </div>
    </div>
  </div>

  <!-- ═══ Bill To + Invoice Details ═══ -->
  <div class="meta-row">
    <div class="meta-col" style="flex:1.5;">
      <div class="sec-hd">Bill To:</div>
      <div class="cust-name">${escapeHtml(voucherData.ledger_name || '—')}</div>
      ${voucherData.ledger_address ? `<div class="cust-sub">${escapeHtml(voucherData.ledger_address)}</div>` : ''}
      ${voucherData.ledger_phone ? `<div class="mrow"><span class="ml">Contact No:</span><span class="mv">${escapeHtml(voucherData.ledger_phone)}</span></div>` : ''}
      ${voucherData.ledger_gstin ? `<div class="mrow"><span class="ml">GSTIN Number:</span><span class="mv">${escapeHtml(voucherData.ledger_gstin)}</span></div>` : ''}
      ${voucherData.ledger_state_code ? `<div class="mrow"><span class="ml">State:</span><span class="mv">${escapeHtml(voucherData.ledger_state_code + (voucherData.ledger_state_name ? '-' + voucherData.ledger_state_name : ''))}</span></div>` : ''}
    </div>
    <div class="meta-col" style="flex:1;">
      <div class="sec-hd">Invoice Details:</div>
      <div class="mrow"><span class="ml">No:</span><span class="mv">${escapeHtml(voucherData.voucher_number || '')}</span></div>
      <div class="mrow"><span class="ml">Date:</span><span class="mv">${escapeHtml(formatDate(voucherData.date))}</span></div>
      ${voucherData.po_date ? `<div class="mrow"><span class="ml">PO date:</span><span class="mv">${escapeHtml(formatDate(voucherData.po_date))}</span></div>` : ''}
      ${voucherData.po_number ? `<div class="mrow"><span class="ml">PO number:</span><span class="mv">${escapeHtml(String(voucherData.po_number))}</span></div>` : ''}
      ${placeOfSupply ? `<div class="mrow"><span class="ml">Place of Supply:</span><span class="mv">${escapeHtml(placeOfSupply)}</span></div>` : ''}
    </div>
  </div>

  <!-- ═══ Ship To ═══ -->
  ${(voucherData.ship_to || voucherData.ledger_address) ? `
  <div class="ship-row">
    <strong>Ship To:</strong> &nbsp;${escapeHtml(voucherData.ship_to || voucherData.ledger_address || '')}
  </div>` : ''}

  <!-- ═══ Items Table (8 columns — matches printed bill) ═══ -->
  <table class="it">
    <thead>
      <tr>
        <th style="width:4%">No</th>
        <th style="width:28%;text-align:left;">Particular</th>
        <th style="width:9%">HSN/SAC</th>
        <th style="width:8%">Quantity</th>
        <th style="width:6%">Unit</th>
        <th style="width:14%">Price/ Unit(&#8377;)</th>
        <th style="width:14%">GST(&#8377;)</th>
        <th style="width:14%">Amount(&#8377;)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || `<tr><td colspan="8" class="c" style="padding:14px;color:#888;">No items</td></tr>`}
    </tbody>
    <tfoot>
      <tr>
        <td class="c" colspan="2"><strong>Total</strong></td>
        <td></td>
        <td class="c">${formatQty(c.sumQty)}</td>
        <td colspan="2"></td>
        <td class="r">&#8377; ${formatCurrency(c.totalTax)}</td>
        <td class="r">&#8377; ${formatCurrency(c.grandTotal)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- ═══ Tax Summary (left) + Totals (right) ═══ -->
  <div class="bot">
    <div class="tax-side">
      <div class="tax-hd">Tax Summary:</div>
      <table class="tt">
        <thead><tr>${taxHeadCols}</tr></thead>
        <tbody>
          ${taxSummaryRows || `<tr><td colspan="7" class="c" style="padding:8px;color:#888;">No taxable items</td></tr>`}
        </tbody>
        <tfoot><tr>${taxFooterCols}</tr></tfoot>
      </table>
      <div style="padding:4px 8px; font-size:10px; border-top:1px solid #ccc;">
        <strong>Payment Mode:</strong> ${escapeHtml(paymentMode)}
      </div>
    </div>
    <div class="tot-side">
      <div class="tot-row"><span>Sub Total</span><span>&#8377; ${formatCurrency(c.subtotal)}</span></div>
      <div class="tot-row"><span>Total</span><span>&#8377; ${formatCurrency(c.grandTotal)}</span></div>
      ${c.discountAmount > 0 ? `<div class="tot-row"><span>Less: Discount</span><span>- &#8377; ${formatCurrency(c.discountAmount)}</span></div>` : ''}
      ${Math.abs(c.roundOff) >= 0.01 ? `<div class="tot-row"><span>Round Off</span><span>&#8377; ${formatCurrency(c.roundOff)}</span></div>` : ''}
      <div class="tot-row grand"><span>Net Payable</span><span>&#8377; ${formatCurrency(c.netAmount)}</span></div>
      <div class="words-box">
        <b>Invoice Amount In Words :</b><br>
        ${escapeHtml(data.amountInWords)}
      </div>
      <div class="rec-box">
        <div class="rrow"><span>Received</span><span>&#8377; ${formatCurrency(received)}</span></div>
        <div class="rrow bold"><span>Balance</span><span>&#8377; ${formatCurrency(balance)}</span></div>
      </div>
    </div>
  </div>

  <!-- ═══ Terms & Conditions ═══ -->
  <div class="terms-box">
    <div class="tlbl">Terms And Conditions:</div>
    ${termsLines}
  </div>

  <!-- ═══ Bank Details + Authorised Signatory ═══ -->
  <div class="foot-row">
    <div class="bank-col">
      ${data.qrDataUri ? `<div style="flex-shrink:0;"><img src="${data.qrDataUri}" style="width:68px;height:68px;" alt="UPI QR"><div style="font-size:7.5px;text-align:center;margin-top:2px;color:#555;">Scan & Pay</div></div>` : ''}
      <div class="bank-txt">
        <b>Bank Details:</b>
        ${companyData.bank_name  ? 'Name: <strong>' + escapeHtml(companyData.bank_name) + '</strong><br>' : ''}
        ${companyData.account_no ? 'Account No.: <strong>' + escapeHtml(companyData.account_no) + '</strong><br>' : ''}
        ${companyData.ifsc       ? 'IFSC code: <strong>' + escapeHtml(companyData.ifsc) + '</strong><br>' : ''}
        ${companyData.upi_id     ? 'UPI: <strong>' + escapeHtml(companyData.upi_id) + '</strong><br>' : ''}
        ${companyData.name       ? "Account Holder's Name: <strong>" + escapeHtml(companyData.name) + '</strong>' : ''}
      </div>
    </div>
    <div class="sign-col">
      <div class="for-lbl">For ${escapeHtml(companyData.name || 'INTERIORS WORLD')}:</div>
      <div class="sig-line">Authorized Signatory</div>
    </div>
  </div>

</body>
</html>`;
}
