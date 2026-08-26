'use strict';

import qrcode from 'qrcode';

/**
 * Generate QR code SVG Data URI using the robust 'qrcode' npm library.
 * Zero custom Reed-Solomon bugs, 100% compliant with scanner apps.
 */
function qrToSvgDataUri(text, moduleSize = 4, margin = 1) {
  if (!text) return '';
  try {
    const qr = qrcode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const totalSize = (size + margin * 2) * moduleSize;

    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          const x = (c + margin) * moduleSize;
          const y = (r + margin) * moduleSize;
          paths += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}"/>`;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}"><rect width="${totalSize}" height="${totalSize}" fill="#fff"/><g fill="#000">${paths}</g></svg>`;
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (e) {
    console.error('QR creation error:', e);
    return '';
  }
}

/**
 * Generate a UPI payment QR code as an SVG data URI.
 * @param {object} opts - { upiId, name, amount }
 * @returns {string} SVG data URI or empty string if upiId is missing
 */
function generateUPIQR(opts) {
  const { upiId, name, amount } = opts || {};
  if (!upiId || !String(upiId).trim()) return '';

  // IMPORTANT: Do NOT encodeURIComponent on upiId itself because NPCI scanners expect pa=someone@bank plain
  const cleanUpiId = String(upiId).trim();
  const cleanName = encodeURIComponent((name || 'Payment').trim());
  let upiString = `upi://pay?pa=${cleanUpiId}&pn=${cleanName}&cu=INR`;

  try {
    return qrToSvgDataUri(upiString, 4, 1);
  } catch (e) {
    console.error('QR generation failed:', e.message);
    return '';
  }
}

export { generateUPIQR, qrToSvgDataUri };
