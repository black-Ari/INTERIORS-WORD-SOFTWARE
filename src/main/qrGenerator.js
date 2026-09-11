'use strict';

import qrcode from 'qrcode';

/**
 * Generate QR code SVG Data URI using the robust 'qrcode' npm library.
 * Uses ISO/IEC 18004 compliant 4-module quiet zone and crisp vector edges
 * so all phone camera scanners (PhonePe, Google Pay, Paytm, BHIM) detect it instantly.
 */
function qrToSvgDataUri(text, margin = 4) {
  if (!text) return '';
  try {
    const qr = qrcode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const total = size + margin * 2;

    let d = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(r, c)) {
          d += `M${c + margin} ${r + margin}h1v1h-1z `;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="100%" height="100%" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path fill="#000000" d="${d}"/></svg>`;
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (e) {
    console.error('QR creation error:', e);
    return '';
  }
}

function generateUPIQR(opts) {
  const { upiId, name, amount, voucherNumber, txnRef, txnDesc } = opts || {};
  if (!upiId || !String(upiId).trim()) return '';

  let cleanUpiId = String(upiId).trim();
  // Auto-detect if user entered just a 10-digit mobile number without a VPA handle
  if (/^\d{10}$/.test(cleanUpiId)) {
    cleanUpiId = `${cleanUpiId}@upi`;
  }

  // Payee name formatted safely for NPCI scanners
  const cleanName = (name || 'Merchant').trim().replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Merchant';
  const encodedName = encodeURIComponent(cleanName);

  let upiString = `upi://pay?pa=${cleanUpiId}&pn=${encodedName}&cu=INR`;

  const numAmount = Number(amount);
  if (!isNaN(numAmount) && numAmount > 0) {
    upiString += `&am=${numAmount.toFixed(2)}`;
  }

  // Optional transaction reference (for reconciliation)
  const ref = txnRef || (voucherNumber ? String(voucherNumber).trim().replace(/[^a-zA-Z0-9\-\/]/g, '') : '');
  if (ref) {
    upiString += `&tr=${encodeURIComponent(ref)}`;
  }

  // Optional transaction description / note
  const desc = txnDesc || (voucherNumber ? `Invoice ${String(voucherNumber).trim().replace(/[^a-zA-Z0-9\-\/]/g, '')}` : '');
  if (desc) {
    upiString += `&tn=${encodeURIComponent(desc)}`;
  }

  return qrToSvgDataUri(upiString, 4);
}

export { generateUPIQR, qrToSvgDataUri };

