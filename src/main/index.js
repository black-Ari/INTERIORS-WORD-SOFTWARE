'use strict';

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

process.on('uncaughtException', (err) => {
  import('fs').then(fs => {
    fs.writeFileSync(path.join(os.tmpdir(), 'interiors_word_crash.log'), err.stack || err.toString());
  });
});
import {
  initDatabase,
  companyGet,
  companySave,
  ledgerCreate,
  ledgerUpdate,
  ledgerDelete,
  ledgerList,
  ledgerSearch,
  ledgerGet,
  categoryCreate,
  categoryUpdate,
  categoryDelete,
  categoryList,
  itemCreate,
  itemUpdate,
  itemDelete,
  itemList,
  itemSearch,
  voucherCreate,
  voucherUpdate,
  voucherList,
  voucherGet,
  voucherDelete,
  getNextVoucherNumber,
  dashboardStats,
  globalSearch
} from './database.js';
import { generateInvoicePDF, printInvoice } from './pdfService.js';
import { sendToWhatsApp } from './whatsappService.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

let mainWindow  = null;
let splashWin   = null;
let db          = null;

const BILLS_FOLDER_NAME = 'InteriorsWord_Bills';

// ---------------------------------------------------------------------------
// Database Initialization
// ---------------------------------------------------------------------------

function getDbPath() {
  return path.join(app.getPath('userData'), 'interiors-word.db');
}

// ---------------------------------------------------------------------------
// Window Creation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Splash Screen
// ---------------------------------------------------------------------------

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  // Inline HTML splash — no external file needed
  const splashHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    height: 300px; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 20px; overflow: hidden;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    user-select: none;
  }
  .logo {
    width: 72px; height: 72px; border-radius: 20px;
    background: linear-gradient(135deg, #14b8a6, #0d9488);
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 900; color: white;
    box-shadow: 0 0 40px rgba(13,148,136,0.5);
    animation: pulse 2s ease infinite;
    margin-bottom: 20px;
  }
  @keyframes pulse {
    0%,100% { box-shadow: 0 0 30px rgba(13,148,136,0.4); }
    50% { box-shadow: 0 0 60px rgba(13,148,136,0.8); }
  }
  h1 { color: #f1f5f9; font-size: 22px; font-weight: 800; letter-spacing: 2px; }
  p  { color: #2dd4bf; font-size: 11px; font-weight: 600;
       letter-spacing: 0.4em; margin-top: 4px; }
  .version { color: #475569; font-size: 10px; margin-top: 6px; }
  .bar-wrap {
    width: 240px; height: 3px; background: rgba(255,255,255,0.08);
    border-radius: 3px; margin-top: 28px; overflow: hidden;
  }
  .bar {
    height: 100%; width: 0; border-radius: 3px;
    background: linear-gradient(90deg, #0d9488, #2dd4bf);
    animation: load 2.5s ease forwards;
  }
  @keyframes load { 0%{width:0%} 60%{width:70%} 80%{width:85%} 100%{width:100%} }
</style>
</head>
<body>
  <div class="logo">IW</div>
  <h1>INTERIORS WORD</h1>
  <p>BILLING SOFTWARE</p>
  <div class="version">v3.0.0 &nbsp;•&nbsp; Professional Edition</div>
  <div class="bar-wrap"><div class="bar"></div></div>
</body>
</html>`;

  splashWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHTML));
}

// ---------------------------------------------------------------------------
// Main Window
// ---------------------------------------------------------------------------

function createMainWindow() {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  const iconPath    = path.join(__dirname, '../../resources/icon.ico');

  const windowOpts = {
    width: 1340,
    height: 840,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: 'INTERIORS WORD',
    show: false,   // Hidden until ready-to-show
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath
    }
  };

  if (fs.existsSync(iconPath)) windowOpts.icon = iconPath;

  mainWindow = new BrowserWindow(windowOpts);

  mainWindow.once('ready-to-show', () => {
    // Close splash with a short delay for polish
    setTimeout(() => {
      if (splashWin && !splashWin.isDestroyed()) {
        splashWin.close();
        splashWin = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }, 600);
  });

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIpcHandlers() {
  // ── Company ──────────────────────────────────────────────────────────────
  ipcMain.handle('db:company-get', () => {
    try {
      return { success: true, data: companyGet(db) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:company-save', (_event, data) => {
    try {
      return { success: true, data: companySave(db, data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Ledgers ──────────────────────────────────────────────────────────────
  ipcMain.handle('db:ledger-create', (_event, data) => {
    try {
      return { success: true, data: ledgerCreate(db, data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:ledger-update', (_event, id, data) => {
    try {
      return { success: true, data: ledgerUpdate(db, id, data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:ledger-delete', (_event, id) => {
    try {
      return { success: true, data: ledgerDelete(db, id) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:ledger-list', () => {
    try {
      return { success: true, data: ledgerList(db) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:ledger-search', (_event, query) => {
    try {
      return { success: true, data: ledgerSearch(db, query) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:ledger-get', (_event, id) => {
    try {
      return { success: true, data: ledgerGet(db, id) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Categories ───────────────────────────────────────────────────────────
  ipcMain.handle('db:category-create', (_event, data) => {
    try {
      return { success: true, data: categoryCreate(db, data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:category-update', (_event, id, data) => {
    try {
      return { success: true, data: categoryUpdate(db, id, data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:category-delete', (_event, id) => {
    try {
      return { success: true, data: categoryDelete(db, id) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:category-list', () => {
    try {
      return { success: true, data: categoryList(db) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Items ────────────────────────────────────────────────────────────────
  ipcMain.handle('db:item-create', (_event, data) => {
    try {
      return { success: true, data: itemCreate(db, data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:item-update', (_event, id, data) => {
    try {
      return { success: true, data: itemUpdate(db, id, data) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:item-delete', (_event, id) => {
    try {
      return { success: true, data: itemDelete(db, id) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:item-list', (_event, category) => {
    try {
      return { success: true, data: itemList(db, category) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:item-search', (_event, query) => {
    try {
      return { success: true, data: itemSearch(db, query) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Vouchers ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:voucher-create', (_event, voucherData, items) => {
    try {
      return { success: true, data: voucherCreate(db, voucherData, items) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:voucher-update', (_event, id, voucherData, items) => {
    try {
      return { success: true, data: voucherUpdate(db, id, voucherData, items) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:voucher-list', (_event, filters) => {
    try {
      return { success: true, data: voucherList(db, filters) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:voucher-get', (_event, id) => {
    try {
      return { success: true, data: voucherGet(db, id) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:next-voucher-number', (_event, type) => {
    try {
      return { success: true, data: getNextVoucherNumber(db, type) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:voucher-delete', (_event, id) => {
    try {
      return { success: true, data: voucherDelete(db, id) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Dashboard ────────────────────────────────────────────────────────────
  ipcMain.handle('db:dashboard-stats', (_event, filters) => {
    try {
      return { success: true, data: dashboardStats(db, filters) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:global-search', (_event, query) => {
    try {
      return { success: true, data: globalSearch(db, query) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── PDF Generation ───────────────────────────────────────────────────────
  ipcMain.handle('pdf:generate', async (_event, voucherId) => {
    try {
      const voucher = voucherGet(db, voucherId);
      if (!voucher) {
        return { success: false, error: 'Voucher not found.' };
      }
      const company = companyGet(db);
      const pdfPath = await generateInvoicePDF(mainWindow, voucher, company);

      // Save PDF path to the voucher record
      db.prepare('UPDATE vouchers SET pdf_path = ? WHERE id = ?').run(pdfPath, voucherId);

      return { success: true, data: pdfPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('pdf:print', async (_event, voucherId) => {
    try {
      const voucher = voucherGet(db, voucherId);
      if (!voucher) {
        return { success: false, error: 'Voucher not found.' };
      }
      const company = companyGet(db);
      const result = await printInvoice(mainWindow, voucher, company);

      // Save PDF path to the voucher record
      db.prepare('UPDATE vouchers SET pdf_path = ? WHERE id = ?').run(result.pdfPath, voucherId);

      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── WhatsApp ─────────────────────────────────────────────────────────────
  ipcMain.handle('whatsapp:send', async (_event, voucherId, phone) => {
    try {
      const voucher = voucherGet(db, voucherId);
      if (!voucher) {
        return { success: false, error: 'Voucher not found.' };
      }

      let pdfPath = voucher.pdf_path;

      if (!pdfPath || !fs.existsSync(pdfPath)) {
        const company = companyGet(db);
        pdfPath = await generateInvoicePDF(mainWindow, voucher, company);
        db.prepare('UPDATE vouchers SET pdf_path = ? WHERE id = ?').run(pdfPath, voucherId);
      }

      const phoneNumber = phone || voucher.ledger_phone;
      if (!phoneNumber) {
        return { success: false, error: 'No phone number available.' };
      }

      const result = await sendToWhatsApp(pdfPath, phoneNumber);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Utilities ────────────────────────────────────────────────────────────
  ipcMain.handle('app:open-pdf-folder', () => {
    try {
      const billsDir = path.join(app.getPath('documents'), BILLS_FOLDER_NAME);
      if (!fs.existsSync(billsDir)) {
        fs.mkdirSync(billsDir, { recursive: true });
      }
      shell.openPath(billsDir);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:get-version', () => {
    return { success: true, data: app.getVersion() };
  });

  ipcMain.handle('app:backup-database', async () => {
    try {
      const dbPath = getDbPath();
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: 'Database file not found.' };
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const defaultName = `interiors-word_backup_${dateStr}.db`;

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Backup Database',
        defaultPath: defaultName,
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
      });

      if (canceled || !filePath) {
        return { success: true, canceled: true };
      }

      // SQLite might be in WAL mode. We should force a checkpoint before backing up if possible,
      // but simple file copy works reasonably well for small apps if no active write is happening.
      // Better-sqlite3 'backup()' method is safer.
      await db.backup(filePath);

      return { success: true, data: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:restore-database', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Restore Database',
        properties: ['openFile'],
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
      });

      if (canceled || filePaths.length === 0) {
        return { success: true, canceled: true };
      }

      const backupPath = filePaths[0];
      const dbPath = getDbPath();

      // Close current db
      if (db) {
        db.close();
        db = null;
      }

      // Copy backup over current db
      fs.copyFileSync(backupPath, dbPath);

      // Tell app to relaunch
      app.relaunch();
      app.exit(0);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  const dbPath = getDbPath();
  db = initDatabase(dbPath);

  // Show splash first, then start main window
  createSplashWindow();
  createMainWindow();
  registerIpcHandlers();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Close the database connection
  if (db) {
    try { db.close(); } catch (_) { /* ignore */ }
  }
  // On macOS apps stay open until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    try { db.close(); } catch (_) { /* ignore */ }
    db = null;
  }
});
