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

  const hsnRows = Object.entries(c.taxGroups)
    .filter(([key]) => key !== 'undefined')
    .map(([key, g]) => {
      const parts = key.split('_');
      const hsn = parts[0] || '?';
      const rate = Number(parts[1]) || 0;
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

// 2. ?? Professional Modern (Emerald & Slate Accent)
export function generateProfessionalModernTemplate(voucherData, companyData) {
  return renderGSTInvoiceHTML(voucherData, companyData, {
    outerBorder: '1.5px solid #059669',
    headerBorderBottom: '2px solid #059669',
    sectionBorderBottom: '1px solid #a7f3d0',
    bannerBg: '#ecfdf5',
    headerTitleColor: '#065f46',
    accentColor: '#059669',
    brandTitleColor: '#065f46',
    primaryColor: '#059669',
    tableHeaderBg: '#d1fae5',
    tableHeaderColor: '#065f46',
    tableFooterBg: '#ecfdf5',
    zebraBg: '#f0fdf4',
    grandRowBg: '#059669',
    grandRowColor: '#ffffff',
    copyBadgeBorder: '1px solid #059669',
    copyBadgeColor: '#065f46',
    copyBadgeBg: '#ffffff',
    borderRadius: '6px'
  });
}

// 3. ?? Professional Corporate (Royal Blue & Charcoal)
export function generateProfessionalCorporateTemplate(voucherData, companyData) {
  return renderGSTInvoiceHTML(voucherData, companyData, {
    outerBorder: '1.5px solid #1e3a8a',
    headerBorderBottom: '2px solid #1e3a8a',
    sectionBorderBottom: '1.5px solid #1e3a8a',
    bannerBg: '#1e40af',
    headerTitleColor: '#ffffff',
    accentColor: '#1e40af',
    brandTitleColor: '#1e3a8a',
    primaryColor: '#1e40af',
    tableHeaderBg: '#1e40af',
    tableHeaderColor: '#ffffff',
    tableFooterBg: '#eff6ff',
    zebraBg: '#f8fafc',
    grandRowBg: '#1e3a8a',
    grandRowColor: '#ffffff',
    copyBadgeBorder: '1px solid #93c5fd',
    copyBadgeColor: '#ffffff',
    copyBadgeBg: '#1e3a8a'
  });
}

// 4. ?? Professional Tally Style (High Density Compact)
export function generateProfessionalTallyTemplate(voucherData, companyData) {
  return renderGSTInvoiceHTML(voucherData, companyData, {
    outerBorder: '2px solid #000000',
    headerBorderBottom: '2px solid #000000',
    sectionBorderBottom: '1px solid #000000',
    bannerBg: '#ffffff',
    headerTitleColor: '#000000',
    accentColor: '#000000',
    brandTitleColor: '#000000',
    primaryColor: '#000000',
    tableHeaderBg: '#e2e8f0',
    tableHeaderColor: '#000000',
    tableFooterBg: '#cbd5e1',
    grandRowBg: '#000000',
    grandRowColor: '#ffffff',
    copyBadgeBorder: '1.5px solid #000000',
    copyBadgeColor: '#000000',
    copyBadgeBg: '#ffffff',
    fontSize: '8.5pt'
  });
}

// 5. ??? Professional Minimalist (B&W Laser Print Ready)
export function generateProfessionalMinimalistTemplate(voucherData, companyData) {
  return renderGSTInvoiceHTML(voucherData, companyData, {
    outerBorder: '1px solid #000000',
    headerBorderBottom: '1px solid #000000',
    sectionBorderBottom: '1px solid #000000',
    bannerBg: '#ffffff',
    headerTitleColor: '#000000',
    accentColor: '#000000',
    brandTitleColor: '#000000',
    primaryColor: '#000000',
    tableHeaderBg: '#ffffff',
    tableHeaderColor: '#000000',
    tableFooterBg: '#ffffff',
    grandRowBg: '#000000',
    grandRowColor: '#ffffff',
    copyBadgeBorder: '1px solid #000000',
    copyBadgeColor: '#000000',
    copyBadgeBg: '#ffffff'
  });
}
