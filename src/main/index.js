'use strict';

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

// Disable hardware acceleration to eliminate Windows 11 AppContainer / GPU sandbox crashes (0x80000003)
try {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
} catch (_) {}

const debugLogPath = path.join(os.tmpdir(), 'interiors_word_debug.log');
export function debugLog(msg) {
  try {
    fs.appendFileSync(debugLogPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (_) {}
}

debugLog('--- Process Starting (PID: ' + process.pid + ') ---');

process.on('uncaughtException', (err) => {
  debugLog('uncaughtException: ' + (err && (err.stack || err.toString())));
  try {
    fs.writeFileSync(path.join(os.tmpdir(), 'interiors_word_crash.log'), (err && (err.stack || err.toString())) || 'Unknown error');
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  debugLog('unhandledRejection: ' + (reason && (reason.stack || reason.toString())));
  try {
    fs.writeFileSync(path.join(os.tmpdir(), 'interiors_word_rejection.log'), (reason && (reason.stack || reason.toString())) || 'Unknown rejection');
  } catch (_) {}
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
import WhatsAppService from './whatsappService.js';
import WhatsAppStore from './whatsappStore.js';
import { generateReply, detectProvider, PROVIDER_NAMES, DEFAULT_MODELS } from './whatsappAiReply.js';
import AutoUpdaterService from './autoUpdaterService.js';
import { startPairingServer, getPairingInfo, stopPairingServer } from './pairingServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

let mainWindow     = null;
let splashWin      = null;
let db             = null;
let waService      = null;
let updaterService = null;

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
    transparent: false,
    backgroundColor: '#0f172a',
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
  <div class="version">v${app.getVersion()} &nbsp;•&nbsp; Professional Edition</div>
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

  const showMainWindow = () => {
    debugLog('showMainWindow called. isVisible: ' + (mainWindow && !mainWindow.isDestroyed() ? mainWindow.isVisible() : 'destroyed/null'));
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      debugLog('mainWindow shown! isVisible: ' + mainWindow.isVisible());
    }
    if (splashWin && !splashWin.isDestroyed()) {
      setTimeout(() => {
        try {
          if (splashWin && !splashWin.isDestroyed()) {
            splashWin.close();
            splashWin = null;
            debugLog('splashWin closed successfully');
          }
        } catch (e) {
          debugLog('Error closing splashWin: ' + e);
        }
      }, 300);
    }
  };

  mainWindow.once('ready-to-show', () => {
    debugLog('mainWindow ready-to-show event fired');
    setTimeout(showMainWindow, 500);
  });

  // Failsafe: if ready-to-show takes too long, reveal window anyway after 3.5s
  setTimeout(() => {
    debugLog('Failsafe timer reached (3.5s)');
    showMainWindow();
  }, 3500);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    debugLog(`Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
    try {
      fs.writeFileSync(path.join(os.tmpdir(), 'interiors_word_load_fail.log'), `Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
    } catch (_) {}
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    debugLog('render-process-gone: ' + JSON.stringify(details));
  });

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    debugLog('Loading URL: ' + process.env.ELECTRON_RENDERER_URL);
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const htmlFile = path.join(__dirname, '../renderer/index.html');
    debugLog('Loading file: ' + htmlFile);
    mainWindow.loadFile(htmlFile);
  }

  mainWindow.on('closed', () => {
    debugLog('mainWindow closed event fired');
    mainWindow = null;
  });
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
  ipcMain.handle('whatsapp:status', () => ({ status: 'ready' }));

  ipcMain.handle('whatsapp:connect', async () => ({ success: true }));

  ipcMain.handle('whatsapp:disconnect', async () => ({ success: true }));

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

      return { success: true, data: { pdfPath, voucher } };
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

  ipcMain.handle('mobile:get-pairing-info', () => {
    try {
      return { success: true, data: getPairingInfo(db) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:open-wb-manager', () => {
    try {
      const possiblePaths = [
        'C:\\Users\\via\\Documents\\GSt softwaer\\WB Manager',
        path.resolve(app.getAppPath(), '..', '..', 'WB Manager'),
        path.resolve(app.getAppPath(), '..', 'WB Manager')
      ];
      let wbDir = 'C:\\Users\\via\\Documents\\GSt softwaer\\WB Manager';
      for (const p of possiblePaths) {
        if (fs.existsSync(p) && fs.existsSync(path.join(p, 'main.js'))) {
          wbDir = p;
          break;
        }
      }

      const candidateExes = [
        path.join(wbDir, 'dist', 'WB Manager 1.0.0.exe'),
        path.join(wbDir, 'dist', 'win-unpacked', 'WB Manager.exe'),
        path.join(wbDir, 'node_modules', 'electron', 'dist', 'electron.exe')
      ];
      const exeToRun = candidateExes.find(p => fs.existsSync(p));
      const isDev = exeToRun && exeToRun.endsWith('electron.exe');
      const exeArgs = isDev ? ['.'] : [];

      if (!exeToRun) {
        return { success: false, error: `WB Manager executable not found in: ${wbDir}` };
      }

      // Strip ELECTRON_RUN_AS_NODE so Electron boots cleanly in GUI window mode
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;

      const child = spawn(exeToRun, exeArgs, {
        cwd: wbDir,
        env,
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      return { success: true, path: wbDir };
    } catch (err) {
      return { success: false, error: err.message };
    }
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

  ipcMain.handle('app:select-file', async (_e, { title, filters } = {}) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: title || 'Select File to Send',
        properties: ['openFile'],
        filters: filters || [
          { name: 'Supported Files (PDF, Excel, Word, Images)', extensions: ['pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'webp', 'txt'] },
          { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
          { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.csv)', extensions: ['xlsx', 'xls', 'csv'] },
          { name: 'Word Documents (*.docx, *.doc)', extensions: ['docx', 'doc'] },
          { name: 'Images (*.png, *.jpg, *.jpeg, *.webp)', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      });
      if (canceled || !filePaths || filePaths.length === 0) {
        return { canceled: true };
      }
      const filePath = filePaths[0];
      const stats = fs.statSync(filePath);
      return {
        canceled: false,
        filePath,
        fileName: path.basename(filePath),
        fileSize: stats.size,
        ext: path.extname(filePath).toLowerCase()
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('invoice:send-whatsapp', async (_e, { voucherId, phone, message } = {}) => {
    try {
      if (!waService) throw new Error('WhatsApp service not initialized');
      const waStatus = waService.getStatus();
      if (waStatus.status !== 'connected') {
        throw new Error('WhatsApp is not connected. Please scan QR code in WhatsApp Manager (F10).');
      }

      const voucher = voucherGet(db, voucherId);
      if (!voucher) throw new Error('Voucher not found');

      const targetPhone = (phone || voucher.ledger_phone || '').replace(/[^0-9]/g, '');
      if (!targetPhone) throw new Error('Customer phone number is missing.');

      let pdfPath = voucher.pdf_path;
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        const company = companyGet(db);
        pdfPath = await generateInvoicePDF(mainWindow, voucher, company);
        db.prepare('UPDATE vouchers SET pdf_path = ? WHERE id = ?').run(pdfPath, voucherId);
      }

      const defaultMsg = message || `Hello ${voucher.ledger_name || ''}, your invoice #${voucher.voucher_number || ''} from INTERIORS WORD has been generated. Amount: Rs. ${voucher.net_amount || 0}. Thank you!`;

      await waService.sendDirectMessage({
        to: targetPhone,
        text: defaultMsg,
        attachmentPath: pdfPath
      });

      return { success: true, phone: targetPhone, pdfPath, voucherNumber: voucher.voucher_number };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // -------------------------------------------------------------------------
  // Native WhatsApp Business System IPCs
  // -------------------------------------------------------------------------

  ipcMain.handle('wa:get-status', () => {
    return waService ? waService.getStatus() : { status: 'disconnected', number: '' };
  });

  ipcMain.handle('wa:connect', async () => {
    if (waService) {
      waService.connect().catch((err) => {
        waService.log(`Connection error: ${err.message}`, 'error');
      });
      return { success: true };
    }
    return { success: false, error: 'Service not initialized' };
  });

  ipcMain.handle('wa:logout', async () => {
    if (waService) {
      await waService.logout();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('wa:reset-session', async () => {
    if (waService) {
      await waService.resetSession();
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('wa:send-bulk', async (_e, payload) => {
    if (!waService) throw new Error('WhatsApp service not initialized');
    return waService.sendBulk(payload, (progress) => {
      mainWindow?.webContents?.send('wa:bulk-progress', progress);
    });
  });

  ipcMain.handle('wa:send-direct', async (_e, payload) => {
    if (!waService) throw new Error('WhatsApp service not initialized');
    return waService.sendDirectMessage(payload);
  });

  ipcMain.handle('wa:get-auto-reply', () => {
    return WhatsAppStore.getAutoReply();
  });

  ipcMain.handle('wa:save-auto-reply', (_e, settings) => {
    const updated = WhatsAppStore.saveAutoReply(settings);
    if (waService) {
      waService.updateAutoReplySettings(updated);
    }
    return updated;
  });

  ipcMain.handle('wa:detect-provider', (_e, { apiKey }) => {
    const provider = detectProvider(apiKey);
    return {
      provider,
      name: PROVIDER_NAMES[provider] || 'Unknown',
      defaultModel: DEFAULT_MODELS[provider] || ''
    };
  });

  ipcMain.handle('wa:preview-ai-reply', async (_e, payload) => {
    const autoReply = WhatsAppStore.getAutoReply();
    const ai = autoReply.ai || {};
    return generateReply({
      apiKey: payload.apiKey || ai.apiKey,
      model: payload.model || ai.model,
      persona: payload.persona || ai.persona,
      businessInfo: payload.businessInfo || ai.businessInfo,
      menuPricing: payload.menuPricing || ai.menuPricing,
      history: [],
      incomingText: payload.incomingText || 'Hello, what are your curtain and wallpaper rates?'
    });
  });

  ipcMain.handle('wa:get-orders', () => {
    return WhatsAppStore.getOrders();
  });

  ipcMain.handle('wa:update-order-status', (_e, { orderId, status }) => {
    return WhatsAppStore.updateOrderStatus(orderId, status);
  });

  ipcMain.handle('wa:confirm-order', async (_e, { orderId }) => {
    if (!waService) throw new Error('WhatsApp service not initialized');
    return waService.confirmOrder(orderId);
  });

  ipcMain.handle('wa:reject-order', async (_e, { orderId, reason }) => {
    if (!waService) throw new Error('WhatsApp service not initialized');
    return waService.rejectOrder(orderId, reason);
  });

  ipcMain.handle('wa:delete-order', (_e, { orderId }) => {
    WhatsAppStore.deleteOrder(orderId);
    return { success: true };
  });

  ipcMain.handle('wa:get-alerts', () => {
    return WhatsAppStore.getAlerts();
  });

  ipcMain.handle('wa:dismiss-alert', (_e, { alertId }) => {
    WhatsAppStore.dismissAlert(alertId);
    return { success: true };
  });

  ipcMain.handle('wa:reply-to-alert', async (_e, { jid, text }) => {
    if (!waService) throw new Error('WhatsApp service not initialized');
    return waService.sendDirectMessage({ to: jid, text });
  });

  ipcMain.handle('wa:get-customer-contacts', () => {
    if (!db) return [];
    try {
      const rows = db.prepare(`
        SELECT id, name, phone, address
        FROM ledgers
        WHERE type = 'customer' AND phone IS NOT NULL AND phone != ''
        ORDER BY name ASC
      `).all();
      return rows;
    } catch (err) {
      console.error('Failed to get customer contacts:', err);
      return [];
    }
  });
  // -------------------------------------------------------------------------
  // Auto-Updater System IPCs (GitHub Releases)
  // -------------------------------------------------------------------------

  ipcMain.handle('update:check', async () => {
    if (!updaterService) return { hasUpdate: false };
    return updaterService.checkForUpdates();
  });

  ipcMain.handle('update:download', async (_e, { downloadUrl } = {}) => {
    if (!updaterService) throw new Error('Updater service not initialized');
    return updaterService.downloadUpdate(downloadUrl, (progress) => {
      mainWindow?.webContents?.send('update:progress', progress);
    });
  });

  ipcMain.handle('update:install', async (_e, { filePath } = {}) => {
    if (!updaterService) throw new Error('Updater service not initialized');
    return updaterService.installUpdate(filePath);
  });
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

const gotTheLock = app.requestSingleInstanceLock();
debugLog('gotTheLock: ' + gotTheLock);

if (!gotTheLock) {
  try {
    fs.writeFileSync(path.join(os.tmpdir(), 'interiors_word_single_instance.log'), 'Second instance exited at ' + new Date().toISOString());
  } catch (_) {}
  debugLog('Exiting because gotTheLock is false');
  app.quit();
} else {
  app.on('second-instance', () => {
    debugLog('second-instance event fired');
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else if (splashWin && !splashWin.isDestroyed()) {
      splashWin.focus();
    }
  });

  app.whenReady().then(() => {
    debugLog('app.whenReady resolved');
    try {
      const dbPath = getDbPath();
      debugLog('Initializing database at ' + dbPath);
      db = initDatabase(dbPath);
      debugLog('Database initialized successfully');
      try {
        startPairingServer(db);
        debugLog('Mobile Pairing Server started');
      } catch (err) {
        debugLog('Failed to start Mobile Pairing Server: ' + err);
      }
    } catch (err) {
      debugLog('Failed to initialize database: ' + err);
      console.error('Failed to initialize database:', err);
    }

    // Initialize native WhatsApp service
    try {
      waService = new WhatsAppService({
        onQr: (dataUrl) => mainWindow?.webContents?.send('wa:qr', dataUrl),
        onStatus: (status, info) => mainWindow?.webContents?.send('wa:status', { status, info }),
        onLog: (entry) => mainWindow?.webContents?.send('wa:log', entry),
        onBulkProgress: (progress) => mainWindow?.webContents?.send('wa:bulk-progress', progress),
        onOrderSummary: (order) => {
          WhatsAppStore.saveOrder(order);
          mainWindow?.webContents?.send('wa:order-summary', order);
        },
        onOwnerAlert: (alert) => {
          WhatsAppStore.saveAlert(alert);
          mainWindow?.webContents?.send('wa:owner-alert', alert);
        }
      });
      debugLog('WhatsAppService initialized successfully');
    } catch (err) {
      debugLog('Failed to initialize WhatsApp service: ' + err);
      console.error('Failed to initialize WhatsApp service:', err);
    }

    // Initialize background Auto-Updater
    try {
      updaterService = new AutoUpdaterService({
        onUpdateAvailable: (info) => {
          mainWindow?.webContents?.send('update:available', info);
        },
        onUpdateProgress: (progress) => {
          mainWindow?.webContents?.send('update:progress', progress);
        },
        onUpdateDownloaded: (info) => {
          mainWindow?.webContents?.send('update:downloaded', info);
        }
      });
      debugLog('AutoUpdaterService initialized successfully');
    } catch (err) {
      debugLog('Failed to initialize AutoUpdater service: ' + err);
      console.error('Failed to initialize AutoUpdater service:', err);
    }

    // Show splash first, then start main window
    debugLog('Creating splash window');
    createSplashWindow();
    debugLog('Creating main window');
    createMainWindow();
    debugLog('Registering IPC handlers');
    registerIpcHandlers();

    // Check for updates automatically 10s after startup
    setTimeout(() => {
      updaterService?.checkForUpdates().catch(() => {});
    }, 10000);

    // macOS: re-create window when dock icon is clicked
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    debugLog('app window-all-closed fired');
    // Close the database connection
    if (db) {
      try { db.close(); } catch (_) { /* ignore */ }
    }
    // On macOS apps stay open until Cmd+Q
    if (process.platform !== 'darwin') {
      debugLog('app.quit called from window-all-closed');
      app.quit();
    }
  });

  app.on('before-quit', () => {
    debugLog('app before-quit fired');
    if (db) {
      try { db.close(); } catch (_) { /* ignore */ }
      db = null;
    }
  });

  app.on('will-quit', () => {
    debugLog('app will-quit fired');
  });

  app.on('quit', (_e, exitCode) => {
    debugLog('app quit fired with exitCode: ' + exitCode);
  });
}
