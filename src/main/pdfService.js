'use strict';

import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';

import {
  generateProfessionalGSTTemplate,
  generateInteriorsTemplate,
  generateStandardTemplate,
  generateModernTemplate,
  generateMinimalistTemplate,
  generateExecutiveTemplate,
  numberToIndianWords
} from './pdfTemplates.js';

function generateInvoiceHTML(voucherData, companyData) {
  const template = companyData.invoice_template || 'professional';
  if (template === 'modern') return generateModernTemplate(voucherData, companyData);
  if (template === 'minimalist') return generateMinimalistTemplate(voucherData, companyData);
  if (template === 'executive') return generateExecutiveTemplate(voucherData, companyData);
  if (template === 'interiors') return generateInteriorsTemplate(voucherData, companyData);
  if (template === 'standard') return generateProfessionalGSTTemplate(voucherData, companyData);
  // Default to the comprehensive Rule 46 professional GST template
  return generateProfessionalGSTTemplate(voucherData, companyData);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PDF Generation
// ---------------------------------------------------------------------------

async function generateInvoicePDF(mainWindow, voucherData, companyData) {
  const billsDir = path.join(app.getPath('documents'), 'InteriorsWord_Bills');

  // Ensure output directory exists
  if (!fs.existsSync(billsDir)) {
    fs.mkdirSync(billsDir, { recursive: true });
  }

  // Sanitize voucher number for filename (replace / with -)
  const safeFileName = (voucherData.voucher_number || 'invoice')
    .replace(/\//g, '-')
    .replace(/[\\:*?"<>|]/g, '_');
  const pdfPath = path.join(billsDir, `${safeFileName}.pdf`);

  // Generate HTML
  const html = generateInvoiceHTML(voucherData, companyData);

  // Create hidden window for PDF rendering
  const pdfWindow = new BrowserWindow({
    width: 800,
    height: 1123, // A4 proportions
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Small delay for rendering
    await new Promise((resolve) => setTimeout(resolve, 500));

    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 0.2,
        bottom: 0.2,
        left: 0.2,
        right: 0.2
      }
    });

    fs.writeFileSync(pdfPath, pdfBuffer);
    return pdfPath;
  } finally {
    pdfWindow.destroy();
  }
}

// ---------------------------------------------------------------------------
// Print Invoice (opens printer dialog + saves PDF in background)
// ---------------------------------------------------------------------------

async function printInvoice(mainWindow, voucherData, companyData) {
  const billsDir = path.join(app.getPath('documents'), 'InteriorsWord_Bills');
  if (!fs.existsSync(billsDir)) {
    fs.mkdirSync(billsDir, { recursive: true });
  }

  const safeFileName = (voucherData.voucher_number || 'invoice')
    .replace(/\//g, '-')
    .replace(/[\\:*?"<>|]/g, '_');
  const pdfPath = path.join(billsDir, `${safeFileName}.pdf`);

  const html = generateInvoiceHTML(voucherData, companyData);

  const pdfWindow = new BrowserWindow({
    width: 800,
    height: 1123,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Save PDF in background (don't await — let it run in parallel)
    const savePdfPromise = pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 0.2,
        bottom: 0.2,
        left: 0.2,
        right: 0.2
      }
    }).then(pdfBuffer => {
      fs.writeFileSync(pdfPath, pdfBuffer);
    }).catch(err => {
      console.error('Background PDF save failed:', err);
    });

    // Open printer dialog
    const printPromise = new Promise((resolve) => {
      pdfWindow.webContents.print({
        silent: false,
        printBackground: true,
        pageSize: 'A4',
        margins: {
          marginType: 'custom',
          top: 0.2,
          bottom: 0.2,
          left: 0.2,
          right: 0.2
        }
      }, (success, failureReason) => {
        resolve({ success, failureReason });
      });
    });

    // Wait for both to finish
    const [printResult] = await Promise.all([printPromise, savePdfPromise]);

    return { pdfPath, printed: printResult.success };
  } finally {
    pdfWindow.destroy();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { generateInvoicePDF, printInvoice, numberToIndianWords };
