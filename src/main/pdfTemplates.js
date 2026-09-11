export function numberToIndianWords(num) {
  if (num === 0 || num == null || isNaN(num)) return 'Rupees Zero Only';

  const isNegative = num < 0;
  num = Math.abs(num);

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function threeDigits(n) {
    if (n === 0) return '';
    const h = Math.floor(n / 100);
    const rest = n % 100;
    let result = '';
    if (h) result += ones[h] + ' Hundred';
    if (h && rest) result += ' and ';
    if (rest) result += twoDigits(rest);
    return result;
  }

  function convertIndian(n) {
    if (n === 0) return '';

    const parts = [];
    const hundreds = n % 1000;
    n = Math.floor(n / 1000);

    if (n > 0) {
      const groups = [];
      while (n > 0) {
        groups.push(n % 100);
        n = Math.floor(n / 100);
      }

      const labels = ['Thousand', 'Lakh', 'Crore', 'Arab', 'Kharab'];

      for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i] > 0) {
          parts.push(twoDigits(groups[i]) + ' ' + (labels[i] || ''));
        }
      }
    }

    if (hundreds > 0) {
      parts.push(threeDigits(hundreds));
    }

    return parts.join(' ');
  }

  let result = isNegative ? 'Minus ' : '';
  result += 'Rupees ' + convertIndian(intPart);
  if (decPart > 0) {
    result += ' and ' + twoDigits(decPart) + ' Paise';
  }
  result += ' Only';

  return result;
}

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
      cgst,
      sgst,
      igst,
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
  companyData = companyData || voucherData?.company || {};
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
  const taxAmountInWords = numberToIndianWords(computed.totalTax || 0);
  const voucherTypeLabel = {
    sales: 'TAX INVOICE',
    purchase: 'PURCHASE INVOICE',
    credit_note: 'CREDIT NOTE',
    debit_note: 'DEBIT NOTE'
  }[voucherData.voucher_type] || 'TAX INVOICE';

  const qrDataUri = generateUPIQR({
    upiId: companyData.upi_id,
    name: companyData.name,
    amount: computed.netAmount,
    voucherNumber: voucherData.voucher_number
  });

  return {
    items,
    itemRows,
    taxGroups: computed.taxGroupsByRate,
    taxGroupsDetailed: computed.taxGroups,
    computed,
    isInterstate,
    amountInWords,
    taxAmountInWords,
    voucherTypeLabel,
    qrDataUri
  };
}

// ---------------------------------------------------------------------------
// 🏆 Professional GST Tax Invoice Templates Engine
// ---------------------------------------------------------------------------

function renderGSTInvoiceHTML(voucherData, companyData, style) {
  companyData = companyData || voucherData?.company || {};
  const data = buildTemplateData(voucherData, companyData);
  const c = data.computed;
  const isInterstate = data.isInterstate;
  const stateCode = companyData.state_code || '';
  const stateName = companyData.state_name || '';

  let panNumber = '';
  if (companyData.gstin && companyData.gstin.length >= 15) {
    panNumber = companyData.gstin.substring(2, 12);
  }

  const placeOfSupply = voucherData.place_of_supply
    || (voucherData.ledger_state_code
      ? `${voucherData.ledger_state_code}${voucherData.ledger_state_name ? ' - ' + voucherData.ledger_state_name : ''}`
      : (stateCode ? `${stateCode}${stateName ? ' - ' + stateName : ''}` : ''));

  const itemRows = c.items.map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discount_percent) || 0;
    const taxable = item.taxableAmount ?? item.amount ?? 0;
    const lineTotal = item.lineTotal ?? 0;

    if (isInterstate) {
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td class="l desc-cell">
            <strong>${escapeHtml(item.description || item.item_name || '')}</strong>
          </td>
          <td class="c">${escapeHtml(item.hsn_code || '?')}</td>
          <td class="c">${formatQty(qty)}</td>
          <td class="c">${escapeHtml(item.unit || '')}</td>
          <td class="r">${formatCurrency(rate)}</td>
          <td class="c">${discPct > 0 ? discPct + '%' : '?'}</td>
          <td class="r">${formatCurrency(taxable)}</td>
          <td class="r">${formatCurrency(item.igst || 0)}</td>
          <td class="r font-bold">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="c">${idx + 1}</td>
        <td class="l desc-cell">
          <strong>${escapeHtml(item.description || item.item_name || '')}</strong>
        </td>
        <td class="c">${escapeHtml(item.hsn_code || '?')}</td>
        <td class="c">${formatQty(qty)}</td>
        <td class="c">${escapeHtml(item.unit || '')}</td>
        <td class="r">${formatCurrency(rate)}</td>
        <td class="c">${discPct > 0 ? discPct + '%' : '?'}</td>
        <td class="r">${formatCurrency(taxable)}</td>
        <td class="r">${formatCurrency(item.cgst || 0)}</td>
        <td class="r">${formatCurrency(item.sgst || 0)}</td>
        <td class="r font-bold">${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  const hsnRows = (c.taxGroups || []).map((g) => {
    const hsn = g.hsn || '—';
    const rate = Number(g.gstRate) || 0;
    const halfRate = (rate / 2).toFixed(1);

    if (isInterstate) {
      return `<tr>
        <td class="c font-bold">${escapeHtml(hsn)}</td>
        <td class="r">${formatCurrency(g.taxableAmount)}</td>
        <td class="c">${rate}%</td>
        <td class="r">${formatCurrency(g.igst)}</td>
        <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
      </tr>`;
    }

    return `<tr>
      <td class="c font-bold">${escapeHtml(hsn)}</td>
      <td class="r">${formatCurrency(g.taxableAmount)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.cgst)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.sgst)}</td>
      <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
    </tr>`;
  }).join('');

  const received = Number(voucherData.received_amount) || 0;
  const balance = Math.round((c.netAmount - received) * 100) / 100;
  const paymentMode = voucherData.payment_mode || 'Credit / Bank Transfer';

  const defaultTerms =
    '1. Goods once sold will not be taken back or exchanged.\n' +
    '2. Payment is due upon receipt of invoice.\n' +
    '3. 18% interest per annum will be charged on overdue payments.\n' +
    '4. All disputes are subject to local jurisdiction only.';
  const termsText = companyData.terms || defaultTerms;
  const termsHtml = termsText.split('\n').filter(Boolean).map((t) => `<li>${escapeHtml(t.replace(/^[0-9]+[.\-)]\s*/, ''))}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Tax Invoice - ${escapeHtml(voucherData.voucher_number || '')}</title>
<style>
  @page {
    size: A4 portrait;
    margin: ${style.pageMargin || '6mm 6mm 6mm 6mm'};
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: ${style.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'};
    font-size: ${style.fontSize || '9pt'};
    color: ${style.textColor || '#0f172a'};
    background: #ffffff;
    line-height: 1.35;
  }
  .invoice-box {
    width: 100%;
    max-width: 100%;
    border: ${style.outerBorder || '1.5px solid #0f172a'};
    background: #ffffff;
  }

  /* Top Banner */
  .top-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${style.bannerPadding || '7px 16px'};
    background: ${style.bannerBg || '#f8fafc'};
    border-bottom: ${style.headerBorderBottom || '1.5px solid #0f172a'};
  }
  .doc-title {
    font-size: 13.5pt;
    font-weight: 900;
    letter-spacing: 2px;
    color: ${style.headerTitleColor || '#0f172a'};
    text-transform: uppercase;
  }
  .copy-badge {
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: ${style.copyBadgeColor || '#1e293b'};
    border: ${style.copyBadgeBorder || '1px solid #64748b'};
    border-radius: ${style.borderRadius || '4px'};
    padding: 3px 10px;
    background: ${style.copyBadgeBg || '#ffffff'};
    text-transform: uppercase;
  }

  /* Supplier Row */
  .supplier-row {
    display: flex;
    align-items: center;
    padding: 9px 14px;
    border-bottom: ${style.sectionBorderBottom || '1.5px solid #0f172a'};
    background: #ffffff;
    gap: 16px;
  }
  .supplier-logo img {
    max-height: 55px;
    max-width: 130px;
    object-fit: contain;
  }
  .supplier-logo-placeholder {
    width: 55px;
    height: 55px;
    border-radius: ${style.borderRadius || '4px'};
    background: ${style.primaryColor || '#0f172a'};
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16pt;
    font-weight: 900;
  }
  .supplier-info { flex: 1; }
  .company-title {
    font-size: 13.5pt;
    font-weight: 900;
    color: ${style.brandTitleColor || '#0f172a'};
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .company-addr {
    font-size: 8.2pt;
    color: #334155;
    margin-top: 1px;
    line-height: 1.3;
  }
  .company-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 3px;
    font-size: 8.2pt;
  }
  .badge-item strong { color: #0f172a; }

  /* Metadata Grid */
  .meta-grid {
    display: flex;
    border-bottom: ${style.sectionBorderBottom || '1.5px solid #0f172a'};
  }
  .meta-col { padding: 7px 12px; }
  .meta-col.buyer {
    flex: 1.25;
    border-right: ${style.sectionBorderBottom || '1.5px solid #0f172a'};
  }
  .meta-col.invoice-det { flex: 1; }
  .sec-header {
    font-size: 8pt;
    font-weight: 800;
    text-transform: uppercase;
    color: ${style.accentColor || '#0f172a'};
    letter-spacing: 0.5px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 2px;
    margin-bottom: 4px;
  }
  .buyer-name {
    font-size: 10.5pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 1px;
  }
  .buyer-addr {
    font-size: 8.2pt;
    color: #334155;
    margin-bottom: 3px;
    line-height: 1.3;
  }
  .detail-row {
    display: flex;
    font-size: 8.2pt;
    margin-bottom: 2px;
    align-items: baseline;
  }
  .detail-row .lbl {
    width: 110px;
    color: #475569;
    font-weight: 600;
  }
  .detail-row .val {
    flex: 1;
    color: #0f172a;
    font-weight: 700;
  }

  /* Items Table */
  .table-container { border-bottom: ${style.sectionBorderBottom || '1.5px solid #0f172a'}; }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.2pt;
  }
  .items-table thead th {
    background: ${style.tableHeaderBg || '#f8fafc'};
    color: ${style.tableHeaderColor || '#1e293b'};
    font-weight: 800;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 5px 6px;
    border: 1px solid #cbd5e1;
    text-align: center;
  }
  .items-table tbody td {
    padding: 4px 6px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    vertical-align: middle;
  }
  .items-table tbody tr:nth-child(even) {
    background: ${style.zebraBg || '#ffffff'};
  }
  .items-table tfoot td {
    background: ${style.tableFooterBg || '#f1f5f9'};
    font-weight: 800;
    border: 1px solid #94a3b8;
    padding: 5px 6px;
    color: #0f172a;
  }
  .desc-cell { font-size: 8.2pt; }
  .c { text-align: center; }
  .r { text-align: right; }
  .l { text-align: left; }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .font-bold { font-weight: 800; color: #0f172a; }

  /* HSN Summary Section */
  .hsn-box {
    padding: 5px 10px;
    background: #ffffff;
    border-bottom: ${style.sectionBorderBottom || '1.5px solid #0f172a'};
  }
  .hsn-title {
    font-size: 7.8pt;
    font-weight: 800;
    text-transform: uppercase;
    color: ${style.accentColor || '#0f172a'};
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }
  .hsn-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.8pt;
  }
  .hsn-table thead th {
    background: ${style.hsnHeaderBg || '#f8fafc'};
    color: ${style.hsnHeaderColor || '#334155'};
    font-weight: 800;
    font-size: 7pt;
    text-transform: uppercase;
    padding: 3px 5px;
    border: 1px solid #cbd5e1;
    text-align: center;
  }
  .hsn-table tbody td {
    padding: 3px 5px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
  }
  .hsn-table tfoot td {
    background: #f1f5f9;
    font-weight: 800;
    border: 1px solid #94a3b8;
    padding: 3px 5px;
  }
  .tax-words-bar {
    font-size: 7.5pt;
    margin-top: 3px;
    color: #475569;
  }
  .tax-words-bar strong { color: #0f172a; }

  /* Bottom Section: Bank / QR & Totals */
  .bot-grid {
    display: flex;
    background: #ffffff;
  }
  .bot-left {
    flex: 1.35;
    border-right: ${style.sectionBorderBottom || '1.5px solid #0f172a'};
    display: flex;
    flex-direction: column;
  }
  .bot-right {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Bank & QR */
  .bank-card {
    display: flex;
    gap: 12px;
    padding: 8px 10px;
    border-bottom: 1px solid #cbd5e1;
    background: #ffffff;
    align-items: center;
  }
  .qr-frame {
    text-align: center;
    flex-shrink: 0;
  }
  .qr-frame img {
    width: 105px;
    height: 105px;
    display: block;
    border: 1px solid #cbd5e1;
    padding: 3px;
    background: #ffffff;
  }
  .qr-caption {
    font-size: 6.5pt;
    font-weight: 800;
    color: ${style.accentColor || '#0f172a'};
    margin-top: 2px;
    text-transform: uppercase;
  }
  .bank-details {
    font-size: 8pt;
    line-height: 1.45;
  }
  .bank-details .b-hd {
    font-size: 8pt;
    font-weight: 800;
    text-transform: uppercase;
    color: ${style.accentColor || '#0f172a'};
    margin-bottom: 2px;
  }

  /* Terms */
  .terms-card {
    padding: 6px 10px;
    flex: 1;
  }
  .terms-hd {
    font-size: 7.5pt;
    font-weight: 800;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 2px;
  }
  .terms-list {
    list-style: decimal inside;
    font-size: 7.2pt;
    color: #475569;
    line-height: 1.35;
  }

  /* Totals Table */
  .totals-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.2pt;
  }
  .totals-table td {
    padding: 4px 10px;
    border-bottom: 1px solid #e2e8f0;
  }
  .totals-table td:nth-child(1) {
    color: #334155;
    font-weight: 600;
  }
  .totals-table td:nth-child(2) {
    text-align: right;
    font-weight: 800;
    color: #0f172a;
  }
  .totals-table tr.grand-row td {
    background: ${style.grandRowBg || '#0f172a'};
    color: ${style.grandRowColor || '#ffffff'} !important;
    font-size: 9.5pt;
    font-weight: 900;
    border-top: 1px solid #0f172a;
    border-bottom: none;
    padding: 6px 10px;
  }

  .words-container {
    padding: 5px 10px;
    font-size: 7.5pt;
    border-bottom: 1px solid #e2e8f0;
    background: #fafafa;
    line-height: 1.3;
    color: #334155;
  }
  .words-container strong { color: #0f172a; }

  /* Sign Area */
  .sign-area {
    padding: 8px 10px;
    margin-top: auto;
    text-align: right;
  }
  .sign-for {
    font-size: 8pt;
    font-weight: 800;
    color: #0f172a;
  }
  .sign-placeholder {
    font-size: 7.8pt;
    color: #334155;
    border-top: 1px dashed #94a3b8;
    padding-top: 2px;
    margin-top: 32px;
    font-weight: 700;
    display: inline-block;
    min-width: 140px;
    text-align: center;
  }

  /* Footer */
  .inv-footer {
    border-top: ${style.sectionBorderBottom || '1.5px solid #0f172a'};
    text-align: center;
    padding: 3px;
    font-size: 7pt;
    color: #64748b;
    background: #f8fafc;
  }
</style>
</head>
<body>

<div class="invoice-box">

  <!-- 1. Header Banner -->
  <div class="top-banner">
    <div class="doc-title">${escapeHtml(data.voucherTypeLabel)}</div>
    <div class="copy-badge">${escapeHtml(voucherData.copy_type || 'ORIGINAL FOR RECIPIENT')}</div>
  </div>

  <!-- 2. Supplier Header -->
  <div class="supplier-row">
    <div class="supplier-logo">
      ${companyData.logo
        ? `<img src="${companyData.logo}" alt="Logo">`
        : `<div class="supplier-logo-placeholder">${escapeHtml((companyData.name || 'IW').substring(0, 2).toUpperCase())}</div>`
      }
    </div>
    <div class="supplier-info">
      <div class="company-title">${escapeHtml(companyData.name || 'INTERIORS WORD')}</div>
      <div class="company-addr">${escapeHtml(companyData.address || 'Interior Furnishing, Blinds, Curtains, Wallpapers & Wooden Flooring')}</div>
      <div class="company-badges">
        <span class="badge-item">GSTIN: <strong>${escapeHtml(companyData.gstin || '?')}</strong></span>
        ${stateCode ? `<span class="badge-item">State: <strong>${escapeHtml(stateName ? stateName + ' (' + stateCode + ')' : stateCode)}</strong></span>` : ''}
        ${panNumber ? `<span class="badge-item">PAN: <strong>${escapeHtml(panNumber)}</strong></span>` : ''}
        ${companyData.phone ? `<span class="badge-item">Mobile: <strong>${escapeHtml(companyData.phone)}</strong></span>` : ''}
        ${companyData.email ? `<span class="badge-item">Email: <strong>${escapeHtml(companyData.email)}</strong></span>` : ''}
      </div>
    </div>
  </div>

  <!-- 3. Details of Receiver & Tax Invoice -->
  <div class="meta-grid">
    <div class="meta-col buyer">
      <div class="sec-header">Details of Receiver (Billed To)</div>
      <div class="buyer-name">${escapeHtml(voucherData.ledger_name || 'Cash Customer')}</div>
      <div class="buyer-addr">${escapeHtml(voucherData.ledger_address || '?')}</div>
      <div class="detail-row">
        <span class="lbl">GSTIN / UIN:</span>
        <span class="val font-mono">${escapeHtml(voucherData.ledger_gstin || 'Unregistered')}</span>
      </div>
      <div class="detail-row">
        <span class="lbl">State Name & Code:</span>
        <span class="val">${escapeHtml(voucherData.ledger_state_name || '?')} (${escapeHtml(voucherData.ledger_state_code || '?')})</span>
      </div>
      <div class="detail-row">
        <span class="lbl">Contact Phone:</span>
        <span class="val">${escapeHtml(voucherData.ledger_phone || '?')}</span>
      </div>
      <div class="detail-row">
        <span class="lbl">Reverse Charge:</span>
        <span class="val">No</span>
      </div>
    </div>

    <div class="meta-col invoice-det">
      <div class="sec-header">Invoice Particulars</div>
      <div class="detail-row">
        <span class="lbl">Invoice Number:</span>
        <span class="val font-bold">${escapeHtml(voucherData.voucher_number || '?')}</span>
      </div>
      <div class="detail-row">
        <span class="lbl">Invoice Date:</span>
        <span class="val">${escapeHtml(formatDate(voucherData.date))}</span>
      </div>
      <div class="detail-row">
        <span class="lbl">Due Date:</span>
        <span class="val">${escapeHtml(formatDate(voucherData.due_date || voucherData.date))}</span>
      </div>
      <div class="detail-row">
        <span class="lbl">Place of Supply:</span>
        <span class="val font-bold">${escapeHtml(placeOfSupply || '?')}</span>
      </div>
      ${voucherData.po_number ? `
        <div class="detail-row">
          <span class="lbl">PO Number:</span>
          <span class="val">${escapeHtml(String(voucherData.po_number))}</span>
        </div>
      ` : ''}
      ${voucherData.po_date ? `
        <div class="detail-row">
          <span class="lbl">PO Date:</span>
          <span class="val">${escapeHtml(formatDate(voucherData.po_date))}</span>
        </div>
      ` : ''}
      <div class="detail-row">
        <span class="lbl">Payment Mode:</span>
        <span class="val">${escapeHtml(paymentMode)}</span>
      </div>
    </div>
  </div>

  <!-- 4. Item Particulars Table -->
  <div class="table-container">
    <table class="items-table">
      <thead>
        <tr>
          ${isInterstate ? `
            <th style="width:3.5%;">#</th>
            <th style="width:28%;text-align:left;">Description of Goods / Services</th>
            <th style="width:9%;">HSN/SAC</th>
            <th style="width:7%;">Qty</th>
            <th style="width:5%;">Unit</th>
            <th style="width:9%;">Rate (?)</th>
            <th style="width:5%;">Disc</th>
            <th style="width:11.5%;">Taxable (?)</th>
            <th style="width:10%;">IGST (?)</th>
            <th style="width:12%;">Total (?)</th>
          ` : `
            <th style="width:3.5%;">#</th>
            <th style="width:26%;text-align:left;">Description of Goods / Services</th>
            <th style="width:9%;">HSN/SAC</th>
            <th style="width:6.5%;">Qty</th>
            <th style="width:5%;">Unit</th>
            <th style="width:9%;">Rate (?)</th>
            <th style="width:5%;">Disc</th>
            <th style="width:11%;">Taxable (?)</th>
            <th style="width:8.5%;">CGST (?)</th>
            <th style="width:8.5%;">SGST (?)</th>
            <th style="width:10%;">Total (?)</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="${isInterstate ? 10 : 11}" class="c" style="padding:14px;color:#94a3b8;">No items added</td></tr>`}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="c font-bold">TOTAL</td>
          <td class="c font-bold">${formatQty(c.sumQty)}</td>
          <td colspan="3"></td>
          <td class="r font-bold">? ${formatCurrency(c.sumTaxable)}</td>
          ${isInterstate ? `
            <td class="r font-bold">? ${formatCurrency(c.igstTotal)}</td>
          ` : `
            <td class="r font-bold">? ${formatCurrency(c.cgstTotal)}</td>
            <td class="r font-bold">? ${formatCurrency(c.sgstTotal)}</td>
          `}
          <td class="r font-bold">? ${formatCurrency(c.grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- 5. HSN/SAC Wise Tax Summary Table -->
  <div class="hsn-box">
    <div class="hsn-title">HSN / SAC Wise Tax Breakdown Table (GST Return Summary)</div>
    <table class="hsn-table">
      <thead>
        <tr>
          <th style="width:14%;">HSN/SAC Code</th>
          <th style="width:18%;">Taxable Amount (?)</th>
          ${isInterstate ? `
            <th style="width:14%;">IGST Rate (%)</th>
            <th style="width:18%;">IGST Amount (?)</th>
          ` : `
            <th style="width:11%;">CGST Rate</th>
            <th style="width:15%;">CGST Amount (?)</th>
            <th style="width:11%;">SGST Rate</th>
            <th style="width:15%;">SGST Amount (?)</th>
          `}
          <th style="width:18%;">Total Tax Amount (?)</th>
        </tr>
      </thead>
      <tbody>
        ${hsnRows || `<tr><td colspan="${isInterstate ? 5 : 7}" class="c" style="padding:6px;color:#94a3b8;">No taxable items</td></tr>`}
      </tbody>
      <tfoot>
        <tr>
          <td class="c font-bold">TOTAL</td>
          <td class="r font-bold">? ${formatCurrency(c.sumTaxable)}</td>
          ${isInterstate ? `
            <td></td>
            <td class="r font-bold">? ${formatCurrency(c.igstTotal)}</td>
          ` : `
            <td></td>
            <td class="r font-bold">? ${formatCurrency(c.cgstTotal)}</td>
            <td></td>
            <td class="r font-bold">? ${formatCurrency(c.sgstTotal)}</td>
          `}
          <td class="r font-bold">? ${formatCurrency(c.totalTax)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="tax-words-bar">
      Total Tax Amount in Words: <strong>${escapeHtml(data.taxAmountInWords)}</strong>
    </div>
  </div>

  <!-- 6. Bottom Split: Bank / QR / Terms (Left) + Totals / Signature (Right) -->
  <div class="bot-grid">
    <div class="bot-left">
      <div class="bank-card">
        ${data.qrDataUri ? `
          <div class="qr-frame">
            <img src="${data.qrDataUri}" alt="UPI QR">
            <div class="qr-caption">Scan to Pay UPI (? ${formatCurrency(c.netAmount)})</div>
          </div>
        ` : ''}
        <div class="bank-details">
          <div class="b-hd">Bank Account Details (NEFT / RTGS / IMPS)</div>
          <div>Bank Name: <strong>${escapeHtml(companyData.bank_name || '?')}</strong></div>
          <div>Account Number: <strong>${escapeHtml(companyData.account_no || '?')}</strong></div>
          <div>IFSC Code: <strong class="font-mono">${escapeHtml(companyData.ifsc || '?')}</strong></div>
          <div>Account Name: <strong>${escapeHtml(companyData.name || 'INTERIORS WORD')}</strong></div>
          ${companyData.upi_id ? `<div>UPI ID: <strong class="font-mono">${escapeHtml(companyData.upi_id)}</strong></div>` : ''}
        </div>
      </div>

      <div class="terms-card">
        <div class="terms-hd">Terms & Conditions:</div>
        <ul class="terms-list">
          ${termsHtml}
        </ul>
      </div>
    </div>

    <div class="bot-right">
      <table class="totals-table">
        <tbody>
          <tr>
            <td>Total Taxable Value</td>
            <td>? ${formatCurrency(c.sumTaxable)}</td>
          </tr>
          ${isInterstate ? `
            <tr>
              <td>Integrated Tax (IGST)</td>
              <td>+ ? ${formatCurrency(c.igstTotal)}</td>
            </tr>
          ` : `
            <tr>
              <td>Central Tax (CGST)</td>
              <td>+ ? ${formatCurrency(c.cgstTotal)}</td>
            </tr>
            <tr>
              <td>State Tax (SGST)</td>
              <td>+ ? ${formatCurrency(c.sgstTotal)}</td>
            </tr>
          `}
          ${c.discountAmount > 0 ? `
            <tr>
              <td>Discount (Less)</td>
              <td>- ? ${formatCurrency(c.discountAmount)}</td>
            </tr>
          ` : ''}
          ${Math.abs(c.roundOff) >= 0.01 ? `
            <tr>
              <td>Round Off (+/-)</td>
              <td>${c.roundOff >= 0 ? '+' : ''} ? ${formatCurrency(c.roundOff)}</td>
            </tr>
          ` : ''}
          <tr class="grand-row">
            <td>Grand Total (Net Amount)</td>
            <td>? ${formatCurrency(c.netAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="words-container">
        <strong>Invoice Amount in Words:</strong><br>
        <em>${escapeHtml(data.amountInWords)}</em>
      </div>

      ${(received > 0 || balance > 0) ? `
        <div style="padding:4px 10px;font-size:8pt;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;">
          <span>Received: <strong>? ${formatCurrency(received)}</strong></span>
          <span>Balance Due: <strong style="color:#dc2626;">? ${formatCurrency(balance)}</strong></span>
        </div>
      ` : ''}

      <div class="sign-area">
        <div class="sign-for">For, ${escapeHtml(companyData.name || 'INTERIORS WORD')}</div>
        <div class="sign-placeholder">Authorized Signatory / Seal</div>
      </div>
    </div>
  </div>

  <!-- 7. Footer -->
  <div class="inv-footer">
    This is a Computer Generated Tax Invoice issued in accordance with the Goods and Services Tax Act.
  </div>

</div>

</body>
</html>`;
}

// 1. ?? Professional Classic (Rule 46 & HSN Breakdown - Default)
export function generateProfessionalClassicTemplate(voucherData, companyData) {
  return renderGSTInvoiceHTML(voucherData, companyData, {
    outerBorder: '1.5px solid #0f172a',
    headerBorderBottom: '1.5px solid #0f172a',
    sectionBorderBottom: '1.5px solid #0f172a',
    bannerBg: '#f8fafc',
    headerTitleColor: '#0f172a',
    accentColor: '#0f172a',
    brandTitleColor: '#0f172a',
    primaryColor: '#0f172a',
    tableHeaderBg: '#f8fafc',
    tableHeaderColor: '#1e293b',
    tableFooterBg: '#f1f5f9',
    grandRowBg: '#0f172a',
    grandRowColor: '#ffffff',
    copyBadgeBorder: '1px solid #64748b',
    copyBadgeColor: '#1e293b',
    copyBadgeBg: '#ffffff'
  });
}

// Alias for backwards compatibility
export const generateProfessionalGSTTemplate = generateProfessionalClassicTemplate;

// Shared context extractor for all templates — ensures 100% mathematical and GST consistency
function extractInvoiceContext(voucherData, companyData) {
  companyData = companyData || voucherData?.company || {};
  const c = computeInvoiceTotals(voucherData);
  const isInterstate = c.isInterstate;
  const stateCode = companyData.state_code || '';
  const stateName = companyData.state_name || '';

  let panNumber = companyData.pan || '';
  if (!panNumber && companyData.gstin && companyData.gstin.length >= 15) {
    panNumber = companyData.gstin.substring(2, 12);
  }

  const placeOfSupply = voucherData.place_of_supply
    || (voucherData.ledger_state_code
      ? `${voucherData.ledger_state_code}${voucherData.ledger_state_name ? ' - ' + voucherData.ledger_state_name : ''}`
      : (stateCode ? `${stateCode}${stateName ? ' - ' + stateName : ''}` : ''));

  const amountInWords = numberToIndianWords(c.netAmount || 0);
  const taxAmountInWords = numberToIndianWords(c.totalTax || 0);
  const voucherTypeLabel = {
    sales: 'TAX INVOICE',
    purchase: 'PURCHASE INVOICE',
    credit_note: 'CREDIT NOTE',
    debit_note: 'DEBIT NOTE'
  }[voucherData.voucher_type] || 'TAX INVOICE';

  const qrDataUri = generateUPIQR({
    upiId: companyData.upi_id,
    name: companyData.name,
    amount: c.netAmount,
    voucherNumber: voucherData.voucher_number
  });

  const defaultTerms =
    '1. Goods once sold will not be taken back or exchanged.\n' +
    '2. Payment is due upon receipt of invoice.\n' +
    '3. 18% interest per annum will be charged on overdue payments.\n' +
    '4. All disputes are subject to local jurisdiction only.';
  const termsText = companyData.terms || defaultTerms;
  const termsList = termsText.split('\n').map(t => t.trim()).filter(Boolean).map(t => t.replace(/^[0-9]+[.\-)]\s*/, ''));

  const received = Number(voucherData.received_amount) || 0;
  const balance = Math.round((c.netAmount - received) * 100) / 100;
  const paymentMode = voucherData.payment_mode || 'Credit / Bank Transfer';

  return {
    c,
    isInterstate,
    company: companyData,
    voucher: voucherData,
    stateCode,
    stateName,
    panNumber,
    placeOfSupply,
    amountInWords,
    taxAmountInWords,
    voucherTypeLabel,
    qrDataUri,
    termsList,
    received,
    balance,
    paymentMode
  };
}

// ---------------------------------------------------------------------------
// 2. 💎 Professional Modern (Floating Cards & Emerald Hero)
// ---------------------------------------------------------------------------
export function generateProfessionalModernTemplate(voucherData, companyData) {
  const ctx = extractInvoiceContext(voucherData, companyData);
  const { c, isInterstate, company, voucher, panNumber, placeOfSupply, amountInWords, taxAmountInWords, voucherTypeLabel, qrDataUri, termsList, received, balance, paymentMode } = ctx;

  const itemRows = c.items.map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discount_percent) || 0;
    const taxable = item.taxableAmount ?? item.amount ?? 0;
    const lineTotal = item.lineTotal ?? 0;

    if (isInterstate) {
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td class="l font-semibold text-slate-900">${escapeHtml(item.description || item.item_name || '')}</td>
          <td class="c font-mono">${escapeHtml(item.hsn_code || '—')}</td>
          <td class="c">${formatQty(qty)}</td>
          <td class="c">${escapeHtml(item.unit || '')}</td>
          <td class="r">${formatCurrency(rate)}</td>
          <td class="c">${discPct > 0 ? discPct + '%' : '—'}</td>
          <td class="r">${formatCurrency(taxable)}</td>
          <td class="r">${formatCurrency(item.igst || 0)}</td>
          <td class="r font-bold text-slate-900">${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="c">${idx + 1}</td>
        <td class="l font-semibold text-slate-900">${escapeHtml(item.description || item.item_name || '')}</td>
        <td class="c font-mono">${escapeHtml(item.hsn_code || '—')}</td>
        <td class="c">${formatQty(qty)}</td>
        <td class="c">${escapeHtml(item.unit || '')}</td>
        <td class="r">${formatCurrency(rate)}</td>
        <td class="c">${discPct > 0 ? discPct + '%' : '—'}</td>
        <td class="r">${formatCurrency(taxable)}</td>
        <td class="r">${formatCurrency(item.cgst || 0)}</td>
        <td class="r">${formatCurrency(item.sgst || 0)}</td>
        <td class="r font-bold text-slate-900">${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  const hsnRows = (c.taxGroups || []).map((g) => {
    const hsn = g.hsn || '—';
    const rate = Number(g.gstRate) || 0;
    const halfRate = (rate / 2).toFixed(1);

    if (isInterstate) {
      return `<tr>
        <td class="c font-mono font-bold">${escapeHtml(hsn)}</td>
        <td class="r">${formatCurrency(g.taxableAmount)}</td>
        <td class="c">${rate}%</td>
        <td class="r">${formatCurrency(g.igst)}</td>
        <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
      </tr>`;
    }

    return `<tr>
      <td class="c font-mono font-bold">${escapeHtml(hsn)}</td>
      <td class="r">${formatCurrency(g.taxableAmount)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.cgst)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.sgst)}</td>
      <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${voucherTypeLabel} - ${escapeHtml(voucher.voucher_number || '')}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 8mm 8mm 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 8.5pt; color: #1e293b; background: #ffffff; line-height: 1.35; }
  .modern-page { width: 100%; max-width: 100%; }

  /* Modern Header */
  .modern-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .brand-block { max-width: 58%; }
  .brand-title { font-size: 16pt; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; line-height: 1.15; margin-bottom: 2px; }
  .brand-sub { font-size: 8pt; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .brand-details { font-size: 8pt; color: #475569; line-height: 1.4; margin-bottom: 6px; }
  .badge-tag { display: inline-block; font-size: 7.5pt; font-weight: 700; padding: 2px 7px; border-radius: 4px; margin-right: 4px; }
  .badge-gstin { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .badge-pan { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }

  /* Hero Invoice Card */
  .hero-card { background: #0f172a; color: #ffffff; border-radius: 8px; padding: 12px 14px; min-width: 230px; }
  .hero-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 6px; }
  .hero-doc-type { font-size: 11pt; font-weight: 800; color: #34d399; letter-spacing: 1.2px; text-transform: uppercase; }
  .hero-copy { font-size: 7pt; font-weight: 700; background: #334155; color: #f8fafc; padding: 2px 5px; border-radius: 3px; }
  .hero-meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 3px 8px; font-size: 7.5pt; color: #cbd5e1; }
  .hero-meta-grid strong { color: #ffffff; font-weight: 600; text-align: right; }
  .hero-amount-box { margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; display: flex; justify-content: space-between; align-items: baseline; }
  .hero-amount-label { font-size: 7pt; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
  .hero-amount-val { font-size: 13.5pt; font-weight: 800; color: #10b981; }

  /* Floating Info Cards */
  .cards-row { display: flex; gap: 10px; margin-bottom: 12px; }
  .info-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; }
  .card-label { font-size: 7pt; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .card-party-name { font-size: 9.5pt; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
  .card-text { font-size: 8pt; color: #475569; line-height: 1.35; }
  .card-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 6px; font-size: 7.5pt; color: #475569; }
  .card-grid strong { color: #0f172a; font-weight: 600; }

  /* Modern Item Table */
  table.modern-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 10px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; }
  table.modern-table th { background: #0f172a; color: #ffffff; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 6px 5px; border-bottom: 1px solid #0f172a; }
  table.modern-table td { padding: 5.5px 5px; font-size: 8pt; border-bottom: 1px solid #e2e8f0; color: #334155; }
  table.modern-table tbody tr:nth-child(even) { background: #f8fafc; }
  table.modern-table tfoot td { background: #f1f5f9; font-weight: 700; color: #0f172a; border-top: 1.5px solid #cbd5e1; padding: 6px 5px; }

  /* HSN Schedule */
  .hsn-container { margin-bottom: 10px; }
  .hsn-header { font-size: 7pt; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px; }
  table.hsn-table { width: 100%; border-collapse: collapse; border: 1px solid #a7f3d0; border-radius: 4px; overflow: hidden; }
  table.hsn-table th { background: #ecfdf5; color: #065f46; font-size: 7pt; font-weight: 700; padding: 4px; border: 1px solid #a7f3d0; }
  table.hsn-table td { font-size: 7.5pt; padding: 3px 4px; border: 1px solid #a7f3d0; color: #334155; }
  .tax-words-line { font-size: 7pt; color: #475569; margin-top: 3px; }

  /* Bottom Dual Layout */
  .bottom-layout { display: flex; gap: 10px; }
  .bottom-left { flex: 1.1; display: flex; flex-direction: column; gap: 8px; }
  .bottom-right { flex: 0.9; }

  /* Payment & QR Card */
  .pay-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; display: flex; gap: 10px; align-items: center; }
  .qr-img { width: 90px; height: 90px; border: 1px solid #cbd5e1; border-radius: 4px; background: #ffffff; padding: 3px; flex-shrink: 0; }
  .pay-info { font-size: 7.5pt; color: #475569; line-height: 1.35; }
  .pay-title { font-size: 8pt; font-weight: 700; color: #059669; margin-bottom: 3px; display: flex; align-items: center; gap: 4px; }
  .bank-details { font-size: 7.5pt; color: #334155; margin-top: 2px; }

  /* Terms Card */
  .terms-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px; font-size: 7pt; color: #64748b; line-height: 1.3; }
  .terms-title { font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 2px; }
  .terms-list { padding-left: 12px; }

  /* Totals Stack */
  .totals-box { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #ffffff; margin-bottom: 8px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 8px; font-size: 8pt; color: #475569; border-bottom: 1px solid #f1f5f9; }
  .totals-row.highlight { background: #f8fafc; font-weight: 600; color: #0f172a; }
  .grand-row { background: #059669; color: #ffffff; display: flex; justify-content: space-between; padding: 7px 10px; font-size: 10.5pt; font-weight: 800; }
  .words-block { font-size: 7.5pt; color: #475569; margin-top: 4px; padding: 4px 6px; background: #f1f5f9; border-radius: 4px; }

  /* Sign Area */
  .sign-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center; margin-top: 6px; background: #f8fafc; }
  .sign-for { font-size: 7.5pt; font-weight: 700; color: #0f172a; margin-bottom: 24px; }
  .sign-line { border-top: 1px dashed #94a3b8; font-size: 7pt; color: #64748b; padding-top: 3px; }

  .c { text-align: center; }
  .r { text-align: right; }
  .l { text-align: left; }
  .font-bold { font-weight: 700; }
  .font-mono { font-family: monospace; }
</style>
</head>
<body>
<div class="modern-page">

  <!-- Header -->
  <div class="modern-header">
    <div class="brand-block">
      <div class="brand-title">${escapeHtml(company.name || 'INTERIORS WORD')}</div>
      <div class="brand-sub">Interior Architecture &amp; Decoration Studio</div>
      <div class="brand-details">
        ${escapeHtml(company.address || '')}${company.city ? ', ' + escapeHtml(company.city) : ''}
        ${company.pincode ? ' - ' + escapeHtml(company.pincode) : ''}<br>
        Phone: <strong>${escapeHtml(company.phone || '—')}</strong> | Email: ${escapeHtml(company.email || '—')}
      </div>
      <div>
        <span class="badge-tag badge-gstin">GSTIN: ${escapeHtml(company.gstin || '—')}</span>
        ${panNumber ? `<span class="badge-tag badge-pan">PAN: ${escapeHtml(panNumber)}</span>` : ''}
        <span class="badge-tag" style="background:#f1f5f9;color:#475569;">State: ${escapeHtml(company.state_name || '')} (${escapeHtml(company.state_code || '')})</span>
      </div>
    </div>

    <div class="hero-card">
      <div class="hero-top">
        <span class="hero-doc-type">${escapeHtml(voucherTypeLabel)}</span>
        <span class="hero-copy">ORIGINAL</span>
      </div>
      <div class="hero-meta-grid">
        <span>Invoice No:</span><strong>${escapeHtml(voucher.voucher_number || '—')}</strong>
        <span>Date:</span><strong>${formatDate(voucher.voucher_date)}</strong>
        <span>Due Date:</span><strong>${formatDate(voucher.due_date) || 'On Receipt'}</strong>
        <span>Place of Supply:</span><strong>${escapeHtml(placeOfSupply)}</strong>
      </div>
      <div class="hero-amount-box">
        <span class="hero-amount-label">Amount Payable</span>
        <span class="hero-amount-val">₹ ${formatCurrency(c.netAmount)}</span>
      </div>
    </div>
  </div>

  <!-- Client & Supply Details -->
  <div class="cards-row">
    <div class="info-card">
      <div class="card-label">Billed To (Recipient)</div>
      <div class="card-party-name">${escapeHtml(voucher.ledger_name || 'Cash Customer')}</div>
      <div class="card-text">
        ${escapeHtml(voucher.ledger_address || 'Local Address')}<br>
        ${voucher.ledger_phone ? `Phone: ${escapeHtml(voucher.ledger_phone)}<br>` : ''}
        <strong>GSTIN:</strong> ${escapeHtml(voucher.ledger_gstin || 'Unregistered / Consumer')}<br>
        <strong>State:</strong> ${escapeHtml(voucher.ledger_state_name || company.state_name || '')} (${escapeHtml(voucher.ledger_state_code || company.state_code || '')})
      </div>
    </div>

    <div class="info-card">
      <div class="card-label">Dispatch &amp; Supply Particulars</div>
      <div class="card-grid">
        <span>Place of Supply:</span><strong>${escapeHtml(placeOfSupply)}</strong>
        <span>Reverse Charge:</span><strong>${voucher.reverse_charge ? 'Yes' : 'No'}</strong>
        <span>Payment Mode:</span><strong>${escapeHtml(paymentMode)}</strong>
        <span>PO Number:</span><strong>${escapeHtml(voucher.po_number || '—')}</strong>
        <span>PO Date:</span><strong>${formatDate(voucher.po_date) || '—'}</strong>
      </div>
    </div>
  </div>

  <!-- Item Table -->
  <table class="modern-table">
    <thead>
      <tr>
        <th style="width:24px;">#</th>
        <th style="text-align:left;">Item Description</th>
        <th style="width:60px;">HSN/SAC</th>
        <th style="width:36px;">Qty</th>
        <th style="width:36px;">Unit</th>
        <th style="width:64px; text-align:right;">Rate (₹)</th>
        <th style="width:38px;">Disc</th>
        <th style="width:74px; text-align:right;">Taxable (₹)</th>
        ${isInterstate ? `
          <th style="width:65px; text-align:right;">IGST (₹)</th>
        ` : `
          <th style="width:58px; text-align:right;">CGST (₹)</th>
          <th style="width:58px; text-align:right;">SGST (₹)</th>
        `}
        <th style="width:80px; text-align:right;">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="l">TOTALS</td>
        <td class="c">${formatQty(c.sumQty)}</td>
        <td></td>
        <td></td>
        <td></td>
        <td class="r">${formatCurrency(c.sumTaxable)}</td>
        ${isInterstate ? `
          <td class="r">${formatCurrency(c.igstTotal)}</td>
        ` : `
          <td class="r">${formatCurrency(c.cgstTotal)}</td>
          <td class="r">${formatCurrency(c.sgstTotal)}</td>
        `}
        <td class="r font-bold">₹ ${formatCurrency(c.netAmount)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- HSN Schedule -->
  <div class="hsn-container">
    <div class="hsn-header">HSN / SAC Tax Analysis Summary</div>
    <table class="hsn-table">
      <thead>
        <tr>
          <th style="width:80px;">HSN/SAC</th>
          <th style="text-align:right;">Taxable Amount (₹)</th>
          ${isInterstate ? `
            <th style="width:50px;">IGST %</th>
            <th style="text-align:right;">IGST Amount (₹)</th>
          ` : `
            <th style="width:50px;">CGST %</th>
            <th style="text-align:right;">CGST Amount (₹)</th>
            <th style="width:50px;">SGST %</th>
            <th style="text-align:right;">SGST Amount (₹)</th>
          `}
          <th style="text-align:right;">Total Tax (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${hsnRows}
      </tbody>
    </table>
    <div class="tax-words-line">
      <strong>Total Tax in Words:</strong> <em>${escapeHtml(taxAmountInWords)}</em>
    </div>
  </div>

  <!-- Bottom Details & Totals -->
  <div class="bottom-layout">
    <div class="bottom-left">
      <!-- Payment & QR -->
      <div class="pay-card">
        ${qrDataUri ? `<img class="qr-img" src="${qrDataUri}" alt="UPI QR">` : ''}
        <div class="pay-info">
          <div class="pay-title">📱 Scan &amp; Pay via UPI</div>
          ${company.upi_id ? `<div>UPI ID: <strong style="color:#0f172a;">${escapeHtml(company.upi_id)}</strong></div>` : ''}
          <div class="bank-details">
            <strong>Bank:</strong> ${escapeHtml(company.bank_name || '—')}<br>
            <strong>A/c No:</strong> ${escapeHtml(company.bank_account_number || '—')}<br>
            <strong>IFSC:</strong> ${escapeHtml(company.bank_ifsc_code || '—')} | <strong>Branch:</strong> ${escapeHtml(company.bank_branch || '—')}
          </div>
        </div>
      </div>

      <!-- Terms -->
      <div class="terms-card">
        <div class="terms-title">Terms &amp; Conditions:</div>
        <ul class="terms-list">
          ${termsList.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="bottom-right">
      <div class="totals-box">
        <div class="totals-row">
          <span>Taxable Subtotal</span>
          <strong>₹ ${formatCurrency(c.sumTaxable)}</strong>
        </div>
        ${!isInterstate ? `
          <div class="totals-row">
            <span>Central GST (CGST)</span>
            <span>₹ ${formatCurrency(c.cgstTotal)}</span>
          </div>
          <div class="totals-row">
            <span>State GST (SGST)</span>
            <span>₹ ${formatCurrency(c.sgstTotal)}</span>
          </div>
        ` : `
          <div class="totals-row">
            <span>Integrated GST (IGST)</span>
            <span>₹ ${formatCurrency(c.igstTotal)}</span>
          </div>
        `}
        ${c.discountAmount > 0 ? `
          <div class="totals-row" style="color:#dc2626;">
            <span>Discount Applied</span>
            <span>- ₹ ${formatCurrency(c.discountAmount)}</span>
          </div>
        ` : ''}
        ${c.roundOff !== 0 ? `
          <div class="totals-row">
            <span>Round Off</span>
            <span>${c.roundOff > 0 ? '+' : ''}₹ ${formatCurrency(c.roundOff)}</span>
          </div>
        ` : ''}
        <div class="grand-row">
          <span>Net Payable Amount</span>
          <span>₹ ${formatCurrency(c.netAmount)}</span>
        </div>
      </div>

      <div class="words-block">
        <strong>Amount in Words:</strong><br>
        <em>${escapeHtml(amountInWords)}</em>
      </div>

      <div class="sign-box">
        <div class="sign-for">For, ${escapeHtml(company.name || 'INTERIORS WORD')}</div>
        <div class="sign-line">Authorised Signatory / Digital Seal</div>
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 3. 🏢 Professional Corporate (Navy Full-Bleed Executive Banner)
// ---------------------------------------------------------------------------
export function generateProfessionalCorporateTemplate(voucherData, companyData) {
  const ctx = extractInvoiceContext(voucherData, companyData);
  const { c, isInterstate, company, voucher, panNumber, placeOfSupply, amountInWords, taxAmountInWords, voucherTypeLabel, qrDataUri, termsList, paymentMode } = ctx;

  const itemRows = c.items.map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discount_percent) || 0;
    const taxable = item.taxableAmount ?? item.amount ?? 0;
    const lineTotal = item.lineTotal ?? 0;

    if (isInterstate) {
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td class="l font-bold text-navy">${escapeHtml(item.description || item.item_name || '')}</td>
          <td class="c">${escapeHtml(item.hsn_code || '—')}</td>
          <td class="c font-bold">${formatQty(qty)}</td>
          <td class="c">${escapeHtml(item.unit || '')}</td>
          <td class="r">${formatCurrency(rate)}</td>
          <td class="c">${discPct > 0 ? discPct + '%' : '—'}</td>
          <td class="r font-bold">${formatCurrency(taxable)}</td>
          <td class="r">${formatCurrency(item.igst || 0)}</td>
          <td class="r font-bold text-navy">₹ ${formatCurrency(lineTotal)}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td class="c">${idx + 1}</td>
        <td class="l font-bold text-navy">${escapeHtml(item.description || item.item_name || '')}</td>
        <td class="c">${escapeHtml(item.hsn_code || '—')}</td>
        <td class="c font-bold">${formatQty(qty)}</td>
        <td class="c">${escapeHtml(item.unit || '')}</td>
        <td class="r">${formatCurrency(rate)}</td>
        <td class="c">${discPct > 0 ? discPct + '%' : '—'}</td>
        <td class="r font-bold">${formatCurrency(taxable)}</td>
        <td class="r">${formatCurrency(item.cgst || 0)}</td>
        <td class="r">${formatCurrency(item.sgst || 0)}</td>
        <td class="r font-bold text-navy">₹ ${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  const hsnRows = (c.taxGroups || []).map((g) => {
    const hsn = g.hsn || '—';
    const rate = Number(g.gstRate) || 0;
    const halfRate = (rate / 2).toFixed(1);

    if (isInterstate) {
      return `<tr>
        <td class="c font-bold">${escapeHtml(hsn)}</td>
        <td class="r">${formatCurrency(g.taxableAmount)}</td>
        <td class="c">${rate}%</td>
        <td class="r">${formatCurrency(g.igst)}</td>
        <td class="r font-bold">₹ ${formatCurrency(g.totalTax)}</td>
      </tr>`;
    }

    return `<tr>
      <td class="c font-bold">${escapeHtml(hsn)}</td>
      <td class="r">${formatCurrency(g.taxableAmount)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.cgst)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.sgst)}</td>
      <td class="r font-bold">₹ ${formatCurrency(g.totalTax)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${voucherTypeLabel} - ${escapeHtml(voucher.voucher_number || '')}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", -apple-system, Roboto, Arial, sans-serif; font-size: 8.5pt; color: #1e293b; background: #ffffff; line-height: 1.35; }
  .corp-wrapper { width: 100%; }

  /* Navy Banner */
  .corp-banner { background: #0a2540; color: #ffffff; padding: 18px 22px; border-bottom: 3.5px solid #d97706; display: flex; justify-content: space-between; align-items: center; }
  .corp-company-name { font-size: 17pt; font-weight: 800; letter-spacing: 0.5px; color: #ffffff; margin-bottom: 2px; }
  .corp-company-sub { font-size: 8pt; color: #fbbf24; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .corp-company-meta { font-size: 7.5pt; color: #cbd5e1; line-height: 1.35; }
  .corp-banner-right { text-align: right; }
  .corp-doc-title { font-size: 16pt; font-weight: 900; color: #fbbf24; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .corp-badge-box { background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 5px; padding: 6px 10px; text-align: left; min-width: 190px; }
  .corp-badge-row { display: flex; justify-content: space-between; font-size: 7.5pt; color: #cbd5e1; margin-bottom: 2px; }
  .corp-badge-row strong { color: #ffffff; }

  /* Container */
  .corp-content { padding: 14px 20px; }

  /* Two Column Parties Grid */
  .parties-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; }
  .parties-table th { background: #1e3a8a; color: #ffffff; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 5px 8px; text-align: left; }
  .parties-table td { padding: 8px 10px; font-size: 8pt; vertical-align: top; width: 50%; border-right: 1px solid #cbd5e1; background: #ffffff; }
  .party-name { font-size: 9.5pt; font-weight: 700; color: #0a2540; margin-bottom: 2px; }

  /* Corporate Grid Table */
  table.corp-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #0a2540; }
  table.corp-table th { background: #0a2540; color: #ffffff; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 5px; border: 1px solid #0a2540; }
  table.corp-table td { padding: 5px 5px; font-size: 8pt; border: 1px solid #e2e8f0; color: #334155; }
  table.corp-table tbody tr:nth-child(even) { background: #f8fafc; }
  table.corp-table tfoot td { background: #eff6ff; font-weight: 700; color: #0a2540; border-top: 2px solid #0a2540; padding: 6px 5px; }

  /* HSN Breakdown */
  .corp-hsn-title { font-size: 7.5pt; font-weight: 700; color: #0a2540; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
  table.corp-hsn-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 12px; }
  table.corp-hsn-table th { background: #f1f5f9; color: #0a2540; font-size: 7pt; font-weight: 700; padding: 4px; border: 1px solid #cbd5e1; }
  table.corp-hsn-table td { font-size: 7.5pt; padding: 3px 5px; border: 1px solid #cbd5e1; }

  /* Settlement & Summary Grid */
  .corp-bottom-grid { display: flex; gap: 14px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; background: #ffffff; margin-bottom: 10px; }
  .corp-remit-col { flex: 1.1; display: flex; gap: 10px; align-items: center; border-right: 1px solid #e2e8f0; padding-right: 10px; }
  .corp-qr { width: 92px; height: 92px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px; flex-shrink: 0; }
  .corp-bank-box { font-size: 7.5pt; color: #334155; line-height: 1.4; }
  .corp-bank-title { font-weight: 700; color: #0a2540; font-size: 8pt; margin-bottom: 3px; text-transform: uppercase; }
  
  .corp-summary-col { flex: 0.9; }
  .corp-sum-row { display: flex; justify-content: space-between; font-size: 8pt; color: #475569; padding: 2px 0; }
  .corp-sum-row strong { color: #0a2540; }
  .corp-grand-row { border-top: 1.5px solid #0a2540; border-bottom: 3px double #0a2540; padding: 5px 0; margin-top: 4px; display: flex; justify-content: space-between; font-size: 11pt; font-weight: 800; color: #0a2540; }

  /* Statutory Declaration & Sign */
  .corp-footer-grid { display: flex; gap: 14px; align-items: flex-start; }
  .corp-terms-box { flex: 1.2; font-size: 7pt; color: #64748b; line-height: 1.35; }
  .corp-sign-box { flex: 0.8; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; background: #f8fafc; }
  .corp-sign-title { font-size: 7.5pt; font-weight: 700; color: #0a2540; margin-bottom: 24px; }
  .corp-sign-sub { border-top: 1px dashed #64748b; font-size: 7pt; color: #64748b; padding-top: 2px; }

  .c { text-align: center; }
  .r { text-align: right; }
  .l { text-align: left; }
  .text-navy { color: #0a2540; }
  .font-bold { font-weight: 700; }
</style>
</head>
<body>
<div class="corp-wrapper">

  <!-- Navy Banner -->
  <div class="corp-banner">
    <div>
      <div class="corp-company-name">${escapeHtml(company.name || 'INTERIORS WORD')}</div>
      <div class="corp-company-sub">Interior Contracting &amp; Architectural Decoration</div>
      <div class="corp-company-meta">
        ${escapeHtml(company.address || '')}${company.city ? ', ' + escapeHtml(company.city) : ''}
        ${company.pincode ? ' - ' + escapeHtml(company.pincode) : ''}<br>
        <strong>GSTIN:</strong> ${escapeHtml(company.gstin || '—')} | <strong>PAN:</strong> ${escapeHtml(panNumber || '—')}<br>
        State: ${escapeHtml(company.state_name || '')} (${escapeHtml(company.state_code || '')}) | Phone: ${escapeHtml(company.phone || '—')}
      </div>
    </div>
    <div class="corp-banner-right">
      <div class="corp-doc-title">${escapeHtml(voucherTypeLabel)}</div>
      <div class="corp-badge-box">
        <div class="corp-badge-row"><span>Invoice No:</span><strong>${escapeHtml(voucher.voucher_number || '—')}</strong></div>
        <div class="corp-badge-row"><span>Date:</span><strong>${formatDate(voucher.voucher_date)}</strong></div>
        <div class="corp-badge-row"><span>Due Date:</span><strong>${formatDate(voucher.due_date) || 'Immediate'}</strong></div>
        <div class="corp-badge-row"><span>Place of Supply:</span><strong>${escapeHtml(placeOfSupply)}</strong></div>
      </div>
    </div>
  </div>

  <div class="corp-content">

    <!-- Parties Grid -->
    <table class="parties-table">
      <thead>
        <tr>
          <th>CONSIGNOR / SUPPLIER</th>
          <th>CONSIGNEE / BUYER (BILLED TO)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="party-name">${escapeHtml(company.name || 'INTERIORS WORD')}</div>
            ${escapeHtml(company.address || '')}<br>
            <strong>GSTIN:</strong> ${escapeHtml(company.gstin || '—')}<br>
            <strong>State:</strong> ${escapeHtml(company.state_name || '')} (Code: ${escapeHtml(company.state_code || '')})<br>
            Phone: ${escapeHtml(company.phone || '—')} | Email: ${escapeHtml(company.email || '—')}
          </td>
          <td>
            <div class="party-name">${escapeHtml(voucher.ledger_name || 'Cash Customer')}</div>
            ${escapeHtml(voucher.ledger_address || 'Local Destination')}<br>
            <strong>GSTIN:</strong> ${escapeHtml(voucher.ledger_gstin || 'Unregistered / Consumer')}<br>
            <strong>State:</strong> ${escapeHtml(voucher.ledger_state_name || company.state_name || '')} (Code: ${escapeHtml(voucher.ledger_state_code || company.state_code || '')})<br>
            ${voucher.ledger_phone ? `Phone: ${escapeHtml(voucher.ledger_phone)} | ` : ''}Payment Mode: <strong>${escapeHtml(paymentMode)}</strong>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Items Table -->
    <table class="corp-table">
      <thead>
        <tr>
          <th style="width:24px;">#</th>
          <th style="text-align:left;">Description of Goods / Services</th>
          <th style="width:65px;">HSN/SAC</th>
          <th style="width:36px;">Qty</th>
          <th style="width:36px;">Unit</th>
          <th style="width:64px; text-align:right;">Rate (₹)</th>
          <th style="width:36px;">Disc</th>
          <th style="width:74px; text-align:right;">Taxable (₹)</th>
          ${isInterstate ? `
            <th style="width:65px; text-align:right;">IGST (₹)</th>
          ` : `
            <th style="width:58px; text-align:right;">CGST (₹)</th>
            <th style="width:58px; text-align:right;">SGST (₹)</th>
          `}
          <th style="width:80px; text-align:right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="l">TOTALS</td>
          <td class="c">${formatQty(c.sumQty)}</td>
          <td></td>
          <td></td>
          <td></td>
          <td class="r">₹ ${formatCurrency(c.sumTaxable)}</td>
          ${isInterstate ? `
            <td class="r">₹ ${formatCurrency(c.igstTotal)}</td>
          ` : `
            <td class="r">₹ ${formatCurrency(c.cgstTotal)}</td>
            <td class="r">₹ ${formatCurrency(c.sgstTotal)}</td>
          `}
          <td class="r font-bold">₹ ${formatCurrency(c.netAmount)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Corporate HSN Schedule -->
    <div class="corp-hsn-title">Statutory HSN / SAC Tax Summary</div>
    <table class="corp-hsn-table">
      <thead>
        <tr>
          <th style="width:80px;">HSN/SAC</th>
          <th style="text-align:right;">Taxable Amount (₹)</th>
          ${isInterstate ? `
            <th style="width:55px;">IGST Rate</th>
            <th style="text-align:right;">IGST Amount (₹)</th>
          ` : `
            <th style="width:50px;">CGST Rate</th>
            <th style="text-align:right;">CGST Amount (₹)</th>
            <th style="width:50px;">SGST Rate</th>
            <th style="text-align:right;">SGST Amount (₹)</th>
          `}
          <th style="text-align:right;">Total Tax (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${hsnRows}
      </tbody>
    </table>

    <!-- Remittance & Accounting Summary -->
    <div class="corp-bottom-grid">
      <div class="corp-remit-col">
        ${qrDataUri ? `<img class="corp-qr" src="${qrDataUri}" alt="UPI QR">` : ''}
        <div class="corp-bank-box">
          <div class="corp-bank-title">Remittance &amp; Wire Instructions</div>
          <strong>Account Name:</strong> ${escapeHtml(company.bank_account_name || company.name || '')}<br>
          <strong>Bank Name:</strong> ${escapeHtml(company.bank_name || '—')}<br>
          <strong>A/c Number:</strong> ${escapeHtml(company.bank_account_number || '—')}<br>
          <strong>IFSC Code:</strong> ${escapeHtml(company.bank_ifsc_code || '—')}<br>
          <strong>Branch:</strong> ${escapeHtml(company.bank_branch || '—')}<br>
          ${company.upi_id ? `<strong>UPI ID:</strong> ${escapeHtml(company.upi_id)}` : ''}
        </div>
      </div>

      <div class="corp-summary-col">
        <div class="corp-sum-row">
          <span>Gross Taxable Amount</span>
          <strong>₹ ${formatCurrency(c.sumTaxable)}</strong>
        </div>
        ${!isInterstate ? `
          <div class="corp-sum-row">
            <span>Central Tax (CGST)</span>
            <span>₹ ${formatCurrency(c.cgstTotal)}</span>
          </div>
          <div class="corp-sum-row">
            <span>State Tax (SGST)</span>
            <span>₹ ${formatCurrency(c.sgstTotal)}</span>
          </div>
        ` : `
          <div class="corp-sum-row">
            <span>Integrated Tax (IGST)</span>
            <span>₹ ${formatCurrency(c.igstTotal)}</span>
          </div>
        `}
        ${c.discountAmount > 0 ? `
          <div class="corp-sum-row" style="color:#dc2626;">
            <span>Special Discount</span>
            <span>- ₹ ${formatCurrency(c.discountAmount)}</span>
          </div>
        ` : ''}
        ${c.roundOff !== 0 ? `
          <div class="corp-sum-row">
            <span>Round Off Adjustment</span>
            <span>${c.roundOff > 0 ? '+' : ''}₹ ${formatCurrency(c.roundOff)}</span>
          </div>
        ` : ''}
        <div class="corp-grand-row">
          <span>TOTAL PAYABLE</span>
          <span>₹ ${formatCurrency(c.netAmount)}</span>
        </div>
      </div>
    </div>

    <!-- Declarations & Sign -->
    <div class="corp-footer-grid">
      <div class="corp-terms-box">
        <strong>Amount in Words:</strong> <em>${escapeHtml(amountInWords)}</em><br>
        <strong>Tax in Words:</strong> <em>${escapeHtml(taxAmountInWords)}</em>
        <div style="margin-top:5px;">
          <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
        </div>
      </div>

      <div class="corp-sign-box">
        <div class="corp-sign-title">For, ${escapeHtml(company.name || 'INTERIORS WORD')}</div>
        <div class="corp-sign-sub">Authorized Signatory &amp; Company Seal</div>
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 4. 📊 Professional Tally Style (High Density Compact Matrix)
// ---------------------------------------------------------------------------
export function generateProfessionalTallyTemplate(voucherData, companyData) {
  const ctx = extractInvoiceContext(voucherData, companyData);
  const { c, isInterstate, company, voucher, panNumber, placeOfSupply, amountInWords, taxAmountInWords, voucherTypeLabel, qrDataUri, termsList, paymentMode } = ctx;

  const itemRows = c.items.map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discount_percent) || 0;
    const taxable = item.taxableAmount ?? item.amount ?? 0;

    return `
      <tr class="tally-item-row">
        <td class="c border-r">${idx + 1}</td>
        <td class="l border-r font-bold">${escapeHtml(item.description || item.item_name || '')}</td>
        <td class="c border-r">${escapeHtml(item.hsn_code || '')}</td>
        <td class="c border-r font-bold">${formatQty(qty)}</td>
        <td class="r border-r">${formatCurrency(rate)}</td>
        <td class="c border-r">${escapeHtml(item.unit || 'NOS')}</td>
        <td class="c border-r">${discPct > 0 ? discPct + '%' : ''}</td>
        <td class="r font-bold">${formatCurrency(taxable)}</td>
      </tr>
    `;
  }).join('');

  const hsnRows = (c.taxGroups || []).map((g) => {
    const hsn = g.hsn || '—';
    const rate = Number(g.gstRate) || 0;
    const halfRate = (rate / 2).toFixed(1);

    if (isInterstate) {
      return `<tr>
        <td class="c border-r">${escapeHtml(hsn)}</td>
        <td class="r border-r">${formatCurrency(g.taxableAmount)}</td>
        <td class="c border-r">${rate}%</td>
        <td class="r border-r">${formatCurrency(g.igst)}</td>
        <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
      </tr>`;
    }

    return `<tr>
      <td class="c border-r">${escapeHtml(hsn)}</td>
      <td class="r border-r">${formatCurrency(g.taxableAmount)}</td>
      <td class="c border-r">${halfRate}%</td>
      <td class="r border-r">${formatCurrency(g.cgst)}</td>
      <td class="c border-r">${halfRate}%</td>
      <td class="r border-r">${formatCurrency(g.sgst)}</td>
      <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${voucherTypeLabel} - ${escapeHtml(voucher.voucher_number || '')}</title>
<style>
  @page { size: A4 portrait; margin: 6mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 8pt; color: #000000; background: #ffffff; line-height: 1.3; }

  /* Tally Outer Frame */
  .tally-frame { width: 100%; border: 2px solid #000000; }

  .tally-title-bar { text-align: center; font-weight: bold; font-size: 11pt; letter-spacing: 1px; padding: 4px 0; border-bottom: 1px solid #000000; display: flex; justify-content: space-between; padding-left: 10px; padding-right: 10px; }

  /* 4-Quadrant Header Matrix */
  .tally-quadrant { display: flex; width: 100%; border-bottom: 1px solid #000000; }
  .quad-half { width: 50%; padding: 6px 8px; vertical-align: top; }
  .border-r { border-right: 1px solid #000000; }
  .border-b { border-bottom: 1px solid #000000; }

  .company-name-tally { font-size: 11pt; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
  .meta-sub-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
  .meta-sub-table td { padding: 2px 4px; vertical-align: top; border-bottom: 1px solid #e0e0e0; }
  .meta-sub-table td:nth-child(odd) { color: #333333; width: 45%; }
  .meta-sub-table td:nth-child(even) { font-weight: bold; }

  /* Continuous Column Ledger Table */
  table.tally-table { width: 100%; border-collapse: collapse; border-bottom: 1px solid #000000; }
  table.tally-table th { border-bottom: 1px solid #000000; border-right: 1px solid #000000; font-size: 7.5pt; padding: 4px; background: #ffffff; font-weight: bold; }
  table.tally-table th:last-child { border-right: none; }
  table.tally-table td { padding: 4px; font-size: 8pt; vertical-align: top; }
  .tally-item-row td { border-right: 1px solid #000000; }
  .tally-item-row td:last-child { border-right: none; }
  
  /* Ledger Postings */
  .tally-ledger-row td { border-right: 1px solid #000000; padding: 2px 4px; font-style: italic; }
  .tally-ledger-row td:last-child { border-right: none; }

  /* Subtotal Bar */
  .tally-tot-row td { border-top: 1px solid #000000; border-bottom: 1px solid #000000; border-right: 1px solid #000000; font-weight: bold; padding: 4px; }
  .tally-tot-row td:last-child { border-right: none; }

  /* HSN Summary */
  .tally-hsn-wrap { padding: 6px 8px; border-bottom: 1px solid #000000; }
  table.tally-hsn { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-top: 4px; }
  table.tally-hsn th { border: 1px solid #000000; padding: 3px; font-size: 7pt; font-weight: bold; text-align: center; }
  table.tally-hsn td { border: 1px solid #000000; padding: 2px 4px; font-size: 7.5pt; }

  /* Bottom Details */
  .tally-bottom-grid { display: flex; width: 100%; }
  .tally-bottom-left { width: 60%; padding: 6px 8px; border-right: 1px solid #000000; font-size: 7.5pt; line-height: 1.4; }
  .tally-bottom-right { width: 40%; padding: 6px 8px; text-align: right; display: flex; flex-direction: column; justify-content: space-between; }

  .c { text-align: center; }
  .r { text-align: right; }
  .l { text-align: left; }
  .font-bold { font-weight: bold; }
</style>
</head>
<body>
<div class="tally-frame">

  <!-- Title Bar -->
  <div class="tally-title-bar">
    <span></span>
    <span>${escapeHtml(voucherTypeLabel)}</span>
    <span style="font-size:7.5pt; font-weight:normal;">(ORIGINAL FOR RECIPIENT)</span>
  </div>

  <!-- Quadrant 1 & 2 -->
  <div class="tally-quadrant">
    <div class="quad-half border-r">
      <div class="company-name-tally">${escapeHtml(company.name || 'INTERIORS WORD')}</div>
      <div>${escapeHtml(company.address || '')}${company.city ? ', ' + escapeHtml(company.city) : ''}</div>
      <div><strong>GSTIN/UIN:</strong> ${escapeHtml(company.gstin || '—')}</div>
      <div><strong>State Name:</strong> ${escapeHtml(company.state_name || '')}, <strong>Code:</strong> ${escapeHtml(company.state_code || '')}</div>
      <div><strong>Contact:</strong> ${escapeHtml(company.phone || '—')} | <strong>E-Mail:</strong> ${escapeHtml(company.email || '—')}</div>
    </div>
    <div class="quad-half">
      <table class="meta-sub-table">
        <tr><td>Invoice No.</td><td>${escapeHtml(voucher.voucher_number || '—')}</td></tr>
        <tr><td>Dated</td><td>${formatDate(voucher.voucher_date)}</td></tr>
        <tr><td>Delivery Note</td><td>${escapeHtml(voucher.delivery_note || '—')}</td></tr>
        <tr><td>Mode/Terms of Payment</td><td>${escapeHtml(paymentMode)}</td></tr>
        <tr><td>Supplier's Ref. / Other Ref.</td><td>${escapeHtml(voucher.po_number || '—')}</td></tr>
      </table>
    </div>
  </div>

  <!-- Quadrant 3 & 4 -->
  <div class="tally-quadrant">
    <div class="quad-half border-r">
      <div style="font-size:7pt; color:#555; text-transform:uppercase;">Buyer (Bill to)</div>
      <div style="font-size:9.5pt; font-weight:bold; margin-bottom:2px;">${escapeHtml(voucher.ledger_name || 'Cash Customer')}</div>
      <div>${escapeHtml(voucher.ledger_address || 'Local Customer')}</div>
      <div><strong>GSTIN/UIN:</strong> ${escapeHtml(voucher.ledger_gstin || 'Unregistered')}</div>
      <div><strong>State Name:</strong> ${escapeHtml(voucher.ledger_state_name || company.state_name || '')}, <strong>Code:</strong> ${escapeHtml(voucher.ledger_state_code || company.state_code || '')}</div>
    </div>
    <div class="quad-half">
      <table class="meta-sub-table">
        <tr><td>Buyer's Order No.</td><td>${escapeHtml(voucher.po_number || '—')}</td></tr>
        <tr><td>Dated</td><td>${formatDate(voucher.po_date) || '—'}</td></tr>
        <tr><td>Dispatch Doc No.</td><td>—</td></tr>
        <tr><td>Place of Supply</td><td>${escapeHtml(placeOfSupply)}</td></tr>
        <tr><td>Reverse Charge</td><td>${voucher.reverse_charge ? 'Yes' : 'No'}</td></tr>
      </table>
    </div>
  </div>

  <!-- Continuous Column Table -->
  <table class="tally-table">
    <thead>
      <tr>
        <th style="width:28px;">Sl No.</th>
        <th style="text-align:left;">Description of Goods</th>
        <th style="width:70px;">HSN/SAC</th>
        <th style="width:40px;">Quantity</th>
        <th style="width:65px; text-align:right;">Rate</th>
        <th style="width:38px;">per</th>
        <th style="width:38px;">Disc %</th>
        <th style="width:85px; text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}

      <!-- Tally Ledger Breakdown Lines -->
      ${!isInterstate ? `
        <tr class="tally-ledger-row">
          <td class="border-r"></td>
          <td class="l border-r"><strong>Output CGST</strong></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="r">${formatCurrency(c.cgstTotal)}</td>
        </tr>
        <tr class="tally-ledger-row">
          <td class="border-r"></td>
          <td class="l border-r"><strong>Output SGST</strong></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="r">${formatCurrency(c.sgstTotal)}</td>
        </tr>
      ` : `
        <tr class="tally-ledger-row">
          <td class="border-r"></td>
          <td class="l border-r"><strong>Output IGST</strong></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="r">${formatCurrency(c.igstTotal)}</td>
        </tr>
      `}
      ${c.roundOff !== 0 ? `
        <tr class="tally-ledger-row">
          <td class="border-r"></td>
          <td class="l border-r"><strong>Round Off</strong></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="border-r"></td>
          <td class="r">${formatCurrency(c.roundOff)}</td>
        </tr>
      ` : ''}
    </tbody>
    <tfoot>
      <tr class="tally-tot-row">
        <td colspan="3" class="l">Total</td>
        <td class="c">${formatQty(c.sumQty)}</td>
        <td colspan="3"></td>
        <td class="r font-bold">₹ ${formatCurrency(c.netAmount)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Amount in Words -->
  <div style="padding: 4px 8px; border-bottom: 1px solid #000000; font-size: 8pt;">
    Amount Chargeable (in words):<br>
    <strong>INR ${escapeHtml(amountInWords)}</strong>
  </div>

  <!-- Tally HSN/SAC Table -->
  <div class="tally-hsn-wrap">
    <table class="tally-hsn">
      <thead>
        <tr>
          <th rowspan="2" style="width:80px;">HSN/SAC</th>
          <th rowspan="2" style="text-align:right;">Taxable Value</th>
          ${isInterstate ? `
            <th colspan="2">Integrated Tax</th>
          ` : `
            <th colspan="2">Central Tax</th>
            <th colspan="2">State Tax</th>
          `}
          <th rowspan="2" style="text-align:right;">Total Tax Amount</th>
        </tr>
        <tr>
          ${isInterstate ? `
            <th style="width:45px;">Rate</th>
            <th style="text-align:right;">Amount</th>
          ` : `
            <th style="width:40px;">Rate</th>
            <th style="text-align:right;">Amount</th>
            <th style="width:40px;">Rate</th>
            <th style="text-align:right;">Amount</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${hsnRows}
        <tr style="font-weight:bold; background:#fafafa;">
          <td class="c border-r">Total</td>
          <td class="r border-r">${formatCurrency(c.sumTaxable)}</td>
          ${isInterstate ? `
            <td class="border-r"></td>
            <td class="r border-r">${formatCurrency(c.igstTotal)}</td>
          ` : `
            <td class="border-r"></td>
            <td class="r border-r">${formatCurrency(c.cgstTotal)}</td>
            <td class="border-r"></td>
            <td class="r border-r">${formatCurrency(c.sgstTotal)}</td>
          `}
          <td class="r">${formatCurrency(c.totalTax)}</td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top:3px; font-size:7.5pt;">
      Tax Amount (in words): <strong>INR ${escapeHtml(taxAmountInWords)}</strong>
    </div>
  </div>

  <!-- Bottom Bank & Sign Grid -->
  <div class="tally-bottom-grid">
    <div class="tally-bottom-left">
      <div style="display:flex; gap:10px; align-items:center;">
        ${qrDataUri ? `<img src="${qrDataUri}" style="width:85px; height:85px; border:1px solid #999; padding:2px; flex-shrink:0;">` : ''}
        <div>
          <strong>Company's Bank Details:</strong><br>
          Bank Name: <strong>${escapeHtml(company.bank_name || '—')}</strong><br>
          A/c No.: <strong>${escapeHtml(company.bank_account_number || '—')}</strong><br>
          Branch &amp; IFS Code: <strong>${escapeHtml(company.bank_branch || '—')} &amp; ${escapeHtml(company.bank_ifsc_code || '—')}</strong><br>
          ${company.upi_id ? `UPI ID: <strong>${escapeHtml(company.upi_id)}</strong><br>` : ''}
          ${panNumber ? `Company's PAN: <strong>${escapeHtml(panNumber)}</strong>` : ''}
        </div>
      </div>
      <div style="margin-top:6px; font-size:7pt; color:#444;">
        <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
      </div>
    </div>

    <div class="tally-bottom-right">
      <div style="font-size:8pt;">For, <strong>${escapeHtml(company.name || 'INTERIORS WORD')}</strong></div>
      <div style="font-size:7.5pt; font-weight:bold; margin-top:28px;">Authorised Signatory</div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 5. ✨ Professional Minimalist (Monochrome Luxury Fine-Line)
// ---------------------------------------------------------------------------
export function generateProfessionalMinimalistTemplate(voucherData, companyData) {
  const ctx = extractInvoiceContext(voucherData, companyData);
  const { c, isInterstate, company, voucher, panNumber, placeOfSupply, amountInWords, taxAmountInWords, voucherTypeLabel, qrDataUri, termsList, paymentMode } = ctx;

  const itemRows = c.items.map((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discount_percent) || 0;
    const taxable = item.taxableAmount ?? item.amount ?? 0;
    const lineTotal = item.lineTotal ?? 0;

    return `
      <tr>
        <td class="c">${idx + 1}</td>
        <td class="l">
          <span style="font-weight:600; color:#111;">${escapeHtml(item.description || item.item_name || '')}</span>
        </td>
        <td class="c" style="letter-spacing:0.5px;">${escapeHtml(item.hsn_code || '—')}</td>
        <td class="c">${formatQty(qty)}</td>
        <td class="c">${escapeHtml(item.unit || '')}</td>
        <td class="r">${formatCurrency(rate)}</td>
        <td class="c">${discPct > 0 ? discPct + '%' : '—'}</td>
        <td class="r">${formatCurrency(taxable)}</td>
        <td class="r">${formatCurrency(item.gstAmount || 0)}</td>
        <td class="r font-bold" style="color:#000;">${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  const hsnRows = (c.taxGroups || []).map((g) => {
    const hsn = g.hsn || '—';
    const rate = Number(g.gstRate) || 0;
    const halfRate = (rate / 2).toFixed(1);

    if (isInterstate) {
      return `<tr>
        <td class="c">${escapeHtml(hsn)}</td>
        <td class="r">${formatCurrency(g.taxableAmount)}</td>
        <td class="c">${rate}%</td>
        <td class="r">${formatCurrency(g.igst)}</td>
        <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
      </tr>`;
    }

    return `<tr>
      <td class="c">${escapeHtml(hsn)}</td>
      <td class="r">${formatCurrency(g.taxableAmount)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.cgst)}</td>
      <td class="c">${halfRate}%</td>
      <td class="r">${formatCurrency(g.sgst)}</td>
      <td class="r font-bold">${formatCurrency(g.totalTax)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${voucherTypeLabel} - ${escapeHtml(voucher.voucher_number || '')}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 9mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 8pt; color: #222222; background: #ffffff; line-height: 1.4; }
  .mini-wrapper { width: 100%; }

  /* Minimalist Studio Header */
  .mini-top { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 1.5px solid #111111; margin-bottom: 12px; }
  .studio-name { font-size: 15pt; font-weight: 300; letter-spacing: 3px; text-transform: uppercase; color: #111111; margin-bottom: 2px; }
  .studio-sub { font-size: 7pt; letter-spacing: 1.5px; color: #777777; text-transform: uppercase; }
  .studio-meta { font-size: 7.5pt; color: #555555; margin-top: 4px; }
  .doc-meta-right { text-align: right; }
  .mini-doc-type { font-size: 12.5pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #111111; margin-bottom: 3px; }
  .mini-inv-grid { font-size: 7.5pt; color: #555555; }
  .mini-inv-grid strong { color: #111111; font-weight: 600; }

  /* Client & Specification Section */
  .mini-parties { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 12px; border-bottom: 0.75px solid #e5e7eb; margin-bottom: 12px; }
  .mini-client-col { flex: 1.2; }
  .mini-spec-col { flex: 0.8; text-align: right; }
  .section-label { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #888888; margin-bottom: 4px; }
  .client-name { font-size: 10pt; font-weight: 600; color: #000000; margin-bottom: 2px; }

  /* Architectural Item Table */
  table.mini-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  table.mini-table th { border-top: 1.2px solid #111111; border-bottom: 1.2px solid #111111; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 4px; color: #111111; }
  table.mini-table td { padding: 6px 4px; border-bottom: 0.5px solid #e5e7eb; font-size: 8pt; color: #333333; }
  table.mini-table tfoot td { border-top: 1.2px solid #111111; border-bottom: 1.2px solid #111111; font-weight: 700; color: #000000; padding: 6px 4px; }

  /* HSN Minimalist Block */
  .mini-hsn-wrap { margin-bottom: 12px; }
  .hsn-title-mini { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888888; margin-bottom: 3px; }
  table.mini-hsn { width: 100%; border-collapse: collapse; border-top: 0.75px solid #cccccc; border-bottom: 0.75px solid #cccccc; }
  table.mini-hsn th { font-size: 6.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 4px; color: #666666; border-bottom: 0.5px solid #e5e7eb; }
  table.mini-hsn td { font-size: 7.5pt; padding: 3px 4px; border-bottom: 0.5px solid #f1f5f9; }

  /* Minimalist Settlement & Totals Grid */
  .mini-bottom { display: flex; justify-content: space-between; gap: 20px; padding-top: 6px; }
  .mini-pay-col { flex: 1.1; }
  .mini-qr-box { display: flex; gap: 10px; align-items: center; border: 0.75px solid #e5e7eb; border-radius: 4px; padding: 8px; margin-bottom: 8px; background: #fafafa; }
  .mini-qr-img { width: 85px; height: 85px; border: 0.5px solid #cccccc; padding: 2px; background: #ffffff; flex-shrink: 0; }
  .mini-bank-text { font-size: 7pt; color: #444444; line-height: 1.35; }
  .mini-bank-text strong { color: #111111; }

  .mini-totals-col { flex: 0.9; }
  .mini-tot-row { display: flex; justify-content: space-between; font-size: 8pt; color: #555555; padding: 2px 0; }
  .mini-grand-row { border-top: 1.2px solid #111111; border-bottom: 2px solid #111111; padding: 6px 0; margin-top: 4px; display: flex; justify-content: space-between; font-size: 10.5pt; font-weight: 700; color: #000000; }
  
  .mini-words { font-size: 7pt; color: #666666; margin-top: 6px; font-style: italic; line-height: 1.3; }

  .mini-sign-area { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10px; border-top: 0.5px solid #e5e7eb; font-size: 7pt; color: #777777; }
  .mini-sign-line { border-top: 1px solid #111111; width: 140px; text-align: center; padding-top: 3px; color: #111111; font-weight: 600; }

  .c { text-align: center; }
  .r { text-align: right; }
  .l { text-align: left; }
  .font-bold { font-weight: 700; }
</style>
</head>
<body>
<div class="mini-wrapper">

  <!-- Minimalist Studio Header -->
  <div class="mini-top">
    <div>
      <div class="studio-name">${escapeHtml(company.name || 'INTERIORS WORD')}</div>
      <div class="studio-sub">Architecture &amp; Interior Design Studio</div>
      <div class="studio-meta">
        ${escapeHtml(company.address || '')}${company.city ? ', ' + escapeHtml(company.city) : ''}
        ${company.pincode ? ' - ' + escapeHtml(company.pincode) : ''}<br>
        GSTIN: <strong>${escapeHtml(company.gstin || '—')}</strong> | PAN: <strong>${escapeHtml(panNumber || '—')}</strong> | State: ${escapeHtml(company.state_name || '')} (${escapeHtml(company.state_code || '')})
      </div>
    </div>
    <div class="doc-meta-right">
      <div class="mini-doc-type">${escapeHtml(voucherTypeLabel)}</div>
      <div class="mini-inv-grid">
        Invoice #: <strong>${escapeHtml(voucher.voucher_number || '—')}</strong><br>
        Date: <strong>${formatDate(voucher.voucher_date)}</strong><br>
        Due: <strong>${formatDate(voucher.due_date) || 'On Receipt'}</strong>
      </div>
    </div>
  </div>

  <!-- Client & Project Specs -->
  <div class="mini-parties">
    <div class="mini-client-col">
      <div class="section-label">Client &amp; Recipient</div>
      <div class="client-name">${escapeHtml(voucher.ledger_name || 'Cash Customer')}</div>
      <div style="font-size:7.5pt; color:#555;">
        ${escapeHtml(voucher.ledger_address || 'Local Site Address')}<br>
        <strong>GSTIN:</strong> ${escapeHtml(voucher.ledger_gstin || 'Unregistered / Consumer')} | 
        <strong>State:</strong> ${escapeHtml(voucher.ledger_state_name || company.state_name || '')} (${escapeHtml(voucher.ledger_state_code || company.state_code || '')})
      </div>
    </div>
    <div class="mini-spec-col">
      <div class="section-label">Billing Specifications</div>
      <div style="font-size:7.5pt; color:#555;">
        Place of Supply: <strong>${escapeHtml(placeOfSupply)}</strong><br>
        Payment Mode: <strong>${escapeHtml(paymentMode)}</strong><br>
        ${voucher.po_number ? `PO Reference: <strong>${escapeHtml(voucher.po_number)}</strong><br>` : ''}
        Reverse Charge: <strong>${voucher.reverse_charge ? 'Yes' : 'No'}</strong>
      </div>
    </div>
  </div>

  <!-- Architectural Item Table -->
  <table class="mini-table">
    <thead>
      <tr>
        <th style="width:24px;">#</th>
        <th style="text-align:left;">Specification / Description</th>
        <th style="width:65px;">HSN/SAC</th>
        <th style="width:36px;">Qty</th>
        <th style="width:36px;">Unit</th>
        <th style="width:65px; text-align:right;">Rate (₹)</th>
        <th style="width:36px;">Disc</th>
        <th style="width:75px; text-align:right;">Taxable (₹)</th>
        <th style="width:65px; text-align:right;">GST (₹)</th>
        <th style="width:85px; text-align:right;">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="l">TOTALS</td>
        <td class="c">${formatQty(c.sumQty)}</td>
        <td colspan="3"></td>
        <td class="r">${formatCurrency(c.sumTaxable)}</td>
        <td class="r">${formatCurrency(c.totalTax)}</td>
        <td class="r font-bold">₹ ${formatCurrency(c.netAmount)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Minimalist HSN Block -->
  <div class="mini-hsn-wrap">
    <div class="hsn-title-mini">HSN / SAC Tax Breakdown</div>
    <table class="mini-hsn">
      <thead>
        <tr>
          <th style="width:80px;">HSN/SAC</th>
          <th style="text-align:right;">Taxable Value (₹)</th>
          ${isInterstate ? `
            <th style="width:55px;">IGST %</th>
            <th style="text-align:right;">IGST (₹)</th>
          ` : `
            <th style="width:50px;">CGST %</th>
            <th style="text-align:right;">CGST (₹)</th>
            <th style="width:50px;">SGST %</th>
            <th style="text-align:right;">SGST (₹)</th>
          `}
          <th style="text-align:right;">Total Tax (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${hsnRows}
      </tbody>
    </table>
  </div>

  <!-- Bottom Settlement & Totals Grid -->
  <div class="mini-bottom">
    <div class="mini-pay-col">
      <div class="mini-qr-box">
        ${qrDataUri ? `<img class="mini-qr-img" src="${qrDataUri}" alt="UPI QR">` : ''}
        <div class="mini-bank-text">
          <strong style="color:#000; letter-spacing:0.5px;">DIRECT SETTLEMENT INSTRUCTIONS:</strong><br>
          ${company.upi_id ? `UPI ID: <strong>${escapeHtml(company.upi_id)}</strong><br>` : ''}
          Bank: <strong>${escapeHtml(company.bank_name || '—')}</strong><br>
          A/c No: <strong>${escapeHtml(company.bank_account_number || '—')}</strong><br>
          IFSC: <strong>${escapeHtml(company.bank_ifsc_code || '—')}</strong> | Branch: ${escapeHtml(company.bank_branch || '—')}
        </div>
      </div>
      <div style="font-size:6.5pt; color:#888;">
        ${termsList.slice(0, 2).map(t => `• ${escapeHtml(t)}<br>`).join('')}
      </div>
    </div>

    <div class="mini-totals-col">
      <div class="mini-tot-row">
        <span>Taxable Subtotal</span>
        <strong>₹ ${formatCurrency(c.sumTaxable)}</strong>
      </div>
      ${!isInterstate ? `
        <div class="mini-tot-row">
          <span>Central Tax (CGST)</span>
          <span>₹ ${formatCurrency(c.cgstTotal)}</span>
        </div>
        <div class="mini-tot-row">
          <span>State Tax (SGST)</span>
          <span>₹ ${formatCurrency(c.sgstTotal)}</span>
        </div>
      ` : `
        <div class="mini-tot-row">
          <span>Integrated Tax (IGST)</span>
          <span>₹ ${formatCurrency(c.igstTotal)}</span>
        </div>
      `}
      ${c.discountAmount > 0 ? `
        <div class="mini-tot-row" style="color:#b91c1c;">
          <span>Discount</span>
          <span>- ₹ ${formatCurrency(c.discountAmount)}</span>
        </div>
      ` : ''}
      ${c.roundOff !== 0 ? `
        <div class="mini-tot-row">
          <span>Round Off</span>
          <span>${c.roundOff > 0 ? '+' : ''}₹ ${formatCurrency(c.roundOff)}</span>
        </div>
      ` : ''}
      <div class="mini-grand-row">
        <span>TOTAL PAYABLE</span>
        <span>₹ ${formatCurrency(c.netAmount)}</span>
      </div>
      <div class="mini-words">
        Amount: <em>${escapeHtml(amountInWords)}</em>
      </div>
    </div>
  </div>

  <!-- Signature -->
  <div class="mini-sign-area">
    <div>This is a computer generated invoice issued per the GST Act, 2017.</div>
    <div>
      <div style="margin-bottom:18px; text-align:center;">For, <strong>${escapeHtml(company.name || 'INTERIORS WORD')}</strong></div>
      <div class="mini-sign-line">Authorised Signatory</div>
    </div>
  </div>

</div>
</body>
</html>`;
}
