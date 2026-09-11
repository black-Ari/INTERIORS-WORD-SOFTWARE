'use strict';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { app } from 'electron';
import {
  companyGet,
  ledgerList,
  itemList,
  voucherList,
  voucherGet,
  voucherCreate
} from './database.js';

let syncTimer = null;
let isSyncing = false;

function getConfigPath() {
  return path.join(app.getPath('userData'), 'iw_cloud_sync_store.json');
}

export function getMachineHardwareId() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf-8', timeout: 3000 });
      const match = out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
      if (match && match[1]) return match[1].trim();
    }
  } catch (e) {
    console.warn('Could not read MachineGuid from registry:', e.message);
  }
  return crypto.randomUUID();
}

export function generateUniqueSyncCode(isRandom = false) {
  if (isRandom) {
    const rnd = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `IW-${rnd.slice(0, 4)}-${rnd.slice(4, 8)}`;
  }
  const hwId = getMachineHardwareId();
  const hash = crypto.createHash('sha256').update(hwId + '_INTERIORS_WORD_SYNC_SALT').digest('hex').toUpperCase();
  return `IW-${hash.slice(0, 4)}-${hash.slice(4, 8)}`;
}

const DEFAULT_CONFIG = {
  enabled: true,
  projectId: 'interiors-word',
  apiKey: 'AIzaSyC-z9LjNnLqyhAwBgvkXpw0QWUP4YDVQBw',
  syncId: ''
};

export function getCloudConfig() {
  try {
    const p = getConfigPath();
    let data = {};
    if (fs.existsSync(p)) {
      try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch (e) {}
    }

    let syncId = (data.syncId || '').trim();
    // If syncId is missing, empty, or old hardcoded default, generate HID-based unique code
    if (!syncId || syncId === 'kd_interiors') {
      syncId = generateUniqueSyncCode(false);
      data.syncId = syncId;
      try {
        fs.writeFileSync(p, JSON.stringify({ ...DEFAULT_CONFIG, ...data, syncId }, null, 2), 'utf-8');
      } catch (wErr) {
        console.warn('Could not persist generated syncId:', wErr.message);
      }
    }

    return {
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : DEFAULT_CONFIG.enabled,
      projectId: (data.projectId || DEFAULT_CONFIG.projectId).trim(),
      apiKey: (data.apiKey || DEFAULT_CONFIG.apiKey).trim(),
      syncId: syncId,
      lastSyncedAt: data.lastSyncedAt || null,
      lastError: data.lastError || null
    };
  } catch (err) {
    console.error('Failed to read cloud config:', err);
  }
  return {
    ...DEFAULT_CONFIG,
    syncId: generateUniqueSyncCode(false),
    lastSyncedAt: null,
    lastError: null
  };
}

export async function regenerateSyncCode(db) {
  try {
    const newCode = generateUniqueSyncCode(true);
    const saveRes = saveCloudConfig({ syncId: newCode });
    if (!saveRes.success) throw new Error(saveRes.error);

    if (db) {
      await syncNow(db);
    }
    return { success: true, syncId: newCode };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function saveCloudConfig(cfg) {
  try {
    const current = getCloudConfig();
    const updated = {
      ...current,
      ...cfg,
      enabled: Boolean(cfg.enabled !== undefined ? cfg.enabled : current.enabled),
      projectId: (cfg.projectId !== undefined ? cfg.projectId : current.projectId).trim(),
      apiKey: (cfg.apiKey !== undefined ? cfg.apiKey : current.apiKey).trim(),
      syncId: (cfg.syncId !== undefined ? cfg.syncId : current.syncId).trim()
    };
    fs.writeFileSync(getConfigPath(), JSON.stringify(updated, null, 2), 'utf-8');
    return { success: true, config: updated };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Firestore REST API Value Converters (Zero External Dependencies)
// ---------------------------------------------------------------------------

export function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function fromFirestoreValue(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const res = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

export function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return { fields };
}

export function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const res = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = fromFirestoreValue(v);
  }
  if (doc.name) {
    res._docId = doc.name.split('/').pop();
  }
  return res;
}

// ---------------------------------------------------------------------------
// Firestore REST Calls
// ---------------------------------------------------------------------------

function getBaseUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function firestoreWriteDoc(projectId, apiKey, docPath, data) {
  const url = `${getBaseUrl(projectId)}/${docPath}?key=${encodeURIComponent(apiKey)}`;
  const body = toFirestoreFields(data);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Firestore write failed [${resp.status}]: ${errText}`);
  }
  return resp.json();
}

async function firestoreListDocs(projectId, apiKey, collectionPath) {
  const url = `${getBaseUrl(projectId)}/${collectionPath}?key=${encodeURIComponent(apiKey)}&pageSize=300`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!resp.ok) {
    if (resp.status === 404) return [];
    const errText = await resp.text();
    throw new Error(`Firestore list failed [${resp.status}]: ${errText}`);
  }
  const json = await resp.json();
  if (!json.documents) return [];
  return json.documents.map(fromFirestoreDoc).filter(Boolean);
}

// ---------------------------------------------------------------------------
// 2-Way Sync Engine (PC <-> Firestore)
// ---------------------------------------------------------------------------

export async function syncNow(db) {
  if (isSyncing) return { success: false, message: 'Sync already in progress' };
  const cfg = getCloudConfig();
  if (!cfg.enabled || !cfg.projectId || !cfg.apiKey || !cfg.syncId) {
    return { success: false, message: 'Cloud sync is not fully configured' };
  }

  isSyncing = true;
  try {
    const { projectId, apiKey, syncId } = cfg;
    const rootPath = `workspaces/${syncId}`;

    // 1. Upload Company Profile & Dashboard Summary
    const company = companyGet(db) || { name: 'INTERIORS WORD' };
    const allSales = voucherList(db, { voucher_type: 'sales' }) || [];
    const allPurchases = voucherList(db, { voucher_type: 'purchase' }) || [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySales = allSales
      .filter((v) => (v.date || '').startsWith(todayStr))
      .reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
    const totalSales = allSales.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);
    const totalPurchases = allPurchases.reduce((sum, v) => sum + (Number(v.grand_total) || 0), 0);

    const dashboardSummary = {
      todaySales,
      totalSales,
      totalInvoicesCount: allSales.length,
      totalPurchases,
      pendingDues: 0,
      updatedAt: new Date().toISOString()
    };

    await firestoreWriteDoc(projectId, apiKey, `${rootPath}/metadata/summary`, {
      company: {
        name: company.name || 'INTERIORS WORD',
        phone: company.phone || '',
        address: company.address || '',
        gstin: company.gstin || '',
        bank_name: company.bank_name || '',
        account_no: company.account_no || '',
        ifsc: company.ifsc || ''
      },
      dashboard: dashboardSummary
    });

    // 2. Upload Stock Items
    const items = itemList(db) || [];
    for (const item of items) {
      const docId = `item_${item.id}`;
      await firestoreWriteDoc(projectId, apiKey, `${rootPath}/items/${docId}`, {
        id: item.id,
        name: item.name,
        category: item.category || 'General',
        hsn_code: item.hsn_code || '',
        gst_rate: Number(item.gst_rate) || 0,
        unit: item.unit || 'Nos',
        sale_price: Number(item.sale_price) || 0,
        stock_qty: Number(item.stock_qty) || 0,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. Upload Customers / Ledgers
    const ledgers = ledgerList(db) || [];
    for (const ledger of ledgers) {
      const docId = `ledger_${ledger.id}`;
      await firestoreWriteDoc(projectId, apiKey, `${rootPath}/ledgers/${docId}`, {
        id: ledger.id,
        name: ledger.name,
        type: ledger.type || 'customer',
        phone: ledger.phone || '',
        email: ledger.email || '',
        gstin: ledger.gstin || '',
        address: ledger.address || '',
        opening_balance: Number(ledger.opening_balance) || 0,
        updatedAt: new Date().toISOString()
      });
    }

    // 4. Upload PC Sales Invoices to Cloud
    for (const v of allSales) {
      const fullVoucher = voucherGet(db, v.id);
      if (!fullVoucher) continue;
      const safeNum = (v.voucher_number || `IW_S_${v.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const docId = `voucher_${safeNum}`;

      await firestoreWriteDoc(projectId, apiKey, `${rootPath}/vouchers/${docId}`, {
        id: v.id,
        voucher_number: v.voucher_number,
        voucher_type: v.voucher_type || 'sales',
        date: v.date,
        customer_name: fullVoucher.ledger_name || v.customer_name || 'Walk-in Customer',
        customer_phone: fullVoucher.ledger_phone || v.phone || '',
        customer_address: fullVoucher.ledger_address || '',
        subtotal: Number(fullVoucher.subtotal) || 0,
        cgst_amount: Number(fullVoucher.cgst_amount) || 0,
        sgst_amount: Number(fullVoucher.sgst_amount) || 0,
        igst_amount: Number(fullVoucher.igst_amount) || 0,
        total_tax: Number(fullVoucher.total_tax) || 0,
        grand_total: Number(fullVoucher.grand_total) || 0,
        notes: fullVoucher.notes || '',
        source: fullVoucher.source || 'pc',
        items: (fullVoucher.items || []).map((it) => ({
          item_id: it.item_id || 0,
          description: it.description || it.item_name || 'Item',
          hsn_code: it.hsn_code || '',
          quantity: Number(it.quantity) || 1,
          rate: Number(it.rate) || 0,
          unit: it.unit || 'Nos',
          gst_rate: Number(it.gst_rate) || 0,
          amount: Number(it.amount) || 0
        })),
        updatedAt: new Date().toISOString()
      });
    }

    // 5. Download Cloud Invoices Created from Mobile
    const cloudVouchers = await firestoreListDocs(projectId, apiKey, `${rootPath}/vouchers`);
    let downloadedCount = 0;

    for (const cv of cloudVouchers) {
      if (!cv.voucher_number) continue;
      // Check if this voucher already exists in PC local database
      const existing = allSales.find(
        (loc) => loc.voucher_number && loc.voucher_number.trim() === cv.voucher_number.trim()
      );

      if (!existing && cv.source === 'mobile') {
        // Insert new invoice created from mobile phone into PC SQLite database!
        try {
          // Find or create customer ledger
          let ledgerId = null;
          if (cv.customer_name) {
            const match = ledgers.find(
              (l) => l.name && l.name.toLowerCase().trim() === cv.customer_name.toLowerCase().trim()
            );
            if (match) {
              ledgerId = match.id;
            }
          }

          const voucherData = {
            voucher_number: cv.voucher_number,
            voucher_type: cv.voucher_type || 'sales',
            date: cv.date || todayStr,
            ledger_id: ledgerId,
            subtotal: cv.subtotal || 0,
            cgst_amount: cv.cgst_amount || 0,
            sgst_amount: cv.sgst_amount || 0,
            igst_amount: cv.igst_amount || 0,
            total_tax: cv.total_tax || 0,
            grand_total: cv.grand_total || 0,
            notes: cv.notes || 'Created from Mobile App (Cloud Sync)'
          };

          const voucherItems = (cv.items || []).map((it) => ({
            item_id: it.item_id || null,
            description: it.description || 'Item',
            hsn_code: it.hsn_code || '',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'Nos',
            rate: Number(it.rate) || 0,
            gst_rate: Number(it.gst_rate) || 0,
            amount: Number(it.amount) || 0
          }));

          voucherCreate(db, voucherData, voucherItems);
          downloadedCount++;
        } catch (err) {
          console.error(`Failed to import mobile invoice ${cv.voucher_number} to PC:`, err);
        }
      }
    }

    const now = new Date().toISOString();
    saveCloudConfig({ lastSyncedAt: now, lastError: null });

    return {
      success: true,
      message: `Sync successful! ${allSales.length} PC bills uploaded, ${downloadedCount} new mobile bills imported.`,
      lastSyncedAt: now,
      uploadedCount: allSales.length,
      downloadedCount
    };
  } catch (err) {
    console.error('Cloud Sync failed:', err);
    saveCloudConfig({ lastError: err.message });
    return { success: false, error: err.message };
  } finally {
    isSyncing = false;
  }
}

export function startAutoSync(db, intervalSec = 30) {
  if (syncTimer) clearInterval(syncTimer);
  const cfg = getCloudConfig();
  if (cfg.enabled && cfg.projectId && cfg.apiKey && cfg.syncId) {
    // Initial sync
    syncNow(db).catch(() => {});
    // Recurring sync
    syncTimer = setInterval(() => {
      syncNow(db).catch(() => {});
    }, intervalSec * 1000);
  }
}

export function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
