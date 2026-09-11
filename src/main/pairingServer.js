'use strict';

import http from 'http';
import os from 'os';
import {
  companyGet,
  ledgerList,
  itemList,
  voucherList,
  voucherGet,
  voucherCreate,
  voucherDelete
} from './database.js';

import { qrToSvgDataUri } from './qrGenerator.js';
import { getCloudConfig } from './firebaseSync.js';

let server = null;
let activePort = 39281;

export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

export function getPairingInfo(db) {
  const ip = getLocalIpAddress();
  const company = db ? companyGet(db) : { name: 'INTERIORS WORD' };
  const serverUrl = `http://${ip}:${activePort}`;
  const rawCode = String(Math.abs(hashString(ip + ':' + activePort)));
  const pairingCode = rawCode.slice(0, 6).padStart(6, '7');
  return {
    ip,
    port: activePort,
    serverUrl,
    qrDataUri: qrToSvgDataUri(serverUrl, 2),
    companyName: company.name || 'INTERIORS WORD',
    pairingCode,
    cloudConfig: getCloudConfig()
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function startPairingServer(db, port = 39281) {
  if (server) return;
  activePort = port;

  server = http.createServer(async (req, res) => {
    // Enable CORS for mobile app fetch
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    try {
      // 1. Ping / Health check
      if (pathname === '/api/ping') {
        const comp = companyGet(db);
        sendJson(200, {
          status: 'ok',
          companyName: comp.name || 'INTERIORS WORD',
          version: '3.4.0'
        });
        return;
      }

      // 1b. Pairing info
      if (pathname === '/api/pairing-info') {
        sendJson(200, getPairingInfo(db));
        return;
      }

      // 1c. Sync All Data in One Fast Call
      if (pathname === '/api/sync-all' && req.method === 'GET') {
        const todayStr = new Date().toISOString().slice(0, 10);
        const comp = companyGet(db) || {};
        
        // Real Sales Vouchers
        const salesVouchers = voucherList(db, { voucher_type: 'sales' });
        const formattedSales = salesVouchers.map(v => ({
          id: v.id,
          voucher_number: v.voucher_number,
          date: v.date,
          customer_name: v.ledger_name || 'Customer',
          customer_phone: v.ledger_phone || v.phone || '',
          customer_address: v.ledger_address || '',
          subtotal: v.subtotal || 0,
          total_tax: v.total_tax || 0,
          grand_total: v.grand_total || v.net_amount || 0,
          status: 'Paid',
          is_interstate: v.is_interstate === 1
        }));

        // Real Purchase Vouchers
        const purchaseVouchers = voucherList(db, { voucher_type: 'purchase' });
        const formattedPurchases = purchaseVouchers.map(v => ({
          id: v.id,
          voucher_number: v.voucher_number,
          date: v.date,
          supplier_name: v.ledger_name || 'Supplier',
          supplier_phone: v.ledger_phone || v.phone || '',
          subtotal: v.subtotal || 0,
          total_tax: v.total_tax || 0,
          grand_total: v.grand_total || v.net_amount || 0,
          status: 'Paid'
        }));

        // Real Items / Stock
        const allItems = itemList(db).map(i => ({
          id: i.id,
          name: i.name,
          category: i.category || 'General',
          hsn: i.hsn_code || '',
          gst: i.gst_rate || 0,
          price: i.sale_price || 0,
          purchase_price: i.purchase_price || 0,
          stock: i.stock_qty != null ? i.stock_qty : 0,
          unit: i.unit || 'Unit'
        }));

        // Real Customers / Ledgers
        const allLedgers = ledgerList(db).map(l => ({
          id: l.id,
          name: l.name,
          type: l.type || 'customer',
          phone: l.phone || '',
          gstin: l.gstin || '',
          address: l.address || '',
          balance: l.opening_balance || 0
        }));

        // Live Dashboard Calculation
        let todaySalesTotal = 0;
        let todaySalesCount = 0;
        let totalSalesRevenue = 0;
        formattedSales.forEach(s => {
          totalSalesRevenue += s.grand_total;
          if (s.date === todayStr) {
            todaySalesTotal += s.grand_total;
            todaySalesCount++;
          }
        });

        let totalPurchasesAmount = 0;
        formattedPurchases.forEach(p => {
          totalPurchasesAmount += p.grand_total;
        });

        let totalPendingDues = 0;
        allLedgers.forEach(l => {
          if (l.type === 'customer' && l.balance > 0) {
            totalPendingDues += l.balance;
          }
        });

        sendJson(200, {
          company: {
            name: comp.name || 'INTERIORS WORD',
            address: comp.address || '',
            phone: comp.phone || '',
            gstin: comp.gstin || '',
            upi_id: comp.upi_id || '',
            bank_name: comp.bank_name || '',
            account_no: comp.account_no || '',
            ifsc: comp.ifsc || '',
            invoice_template: comp.invoice_template || 'professional'
          },
          dashboard: {
            todaySales: todaySalesTotal,
            todaySalesCount,
            totalSales: totalSalesRevenue,
            totalInvoicesCount: formattedSales.length,
            todayPurchases: 0,
            totalPurchases: totalPurchasesAmount,
            totalPurchasesCount: formattedPurchases.length,
            pendingDues: totalPendingDues,
            customerCount: allLedgers.filter(l => l.type === 'customer').length,
            itemCount: allItems.length
          },
          invoices: formattedSales,
          purchases: formattedPurchases,
          items: allItems,
          customers: allLedgers,
          cloudConfig: getCloudConfig()
        });
        return;
      }

      // 2. Company Profile
      if (pathname === '/api/company' && req.method === 'GET') {
        sendJson(200, companyGet(db));
        return;
      }

      // 3. Customers / Ledgers
      if (pathname === '/api/customers' && req.method === 'GET') {
        sendJson(200, ledgerList(db));
        return;
      }

      // 4. Items
      if (pathname === '/api/items' && req.method === 'GET') {
        sendJson(200, itemList(db));
        return;
      }

      // 5. Invoices List
      if (pathname === '/api/invoices' && req.method === 'GET') {
        const vouchers = voucherList(db, { voucher_type: 'sales' });
        const formatted = vouchers.map(v => ({
          id: v.id,
          voucher_number: v.voucher_number,
          date: v.date,
          customer_name: v.ledger_name || 'Customer',
          customer_phone: v.ledger_phone || v.phone || '',
          customer_address: v.ledger_address || '',
          customer_gstin: '',
          subtotal: v.subtotal || 0,
          total_tax: v.total_tax || 0,
          grand_total: v.grand_total || v.net_amount || 0,
          status: 'Paid',
          is_interstate: v.is_interstate === 1
        }));
        sendJson(200, formatted);
        return;
      }

      // 5b. Purchases List
      if (pathname === '/api/purchases' && req.method === 'GET') {
        const vouchers = voucherList(db, { voucher_type: 'purchase' });
        const formatted = vouchers.map(v => ({
          id: v.id,
          voucher_number: v.voucher_number,
          date: v.date,
          supplier_name: v.ledger_name || 'Supplier',
          supplier_phone: v.ledger_phone || v.phone || '',
          subtotal: v.subtotal || 0,
          total_tax: v.total_tax || 0,
          grand_total: v.grand_total || v.net_amount || 0,
          status: 'Paid'
        }));
        sendJson(200, formatted);
        return;
      }

      // 6. Create Invoice from Mobile
      if (pathname === '/api/invoices' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);

            // Auto-link or auto-create customer ledger if needed
            let ledgerId = data.ledger_id;
            if (!ledgerId && data.customer_name) {
              const existing = db.prepare('SELECT id FROM ledgers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(data.customer_name);
              if (existing) {
                ledgerId = existing.id;
              } else {
                const info = db.prepare('INSERT INTO ledgers (name, type, phone, gstin) VALUES (?, "customer", ?, ?)').run(
                  data.customer_name,
                  data.customer_phone || null,
                  data.customer_gstin || null
                );
                ledgerId = info.lastInsertRowid;
              }
            }

            const voucherData = {
              voucher_type: 'sales',
              date: data.date && data.date !== 'Today' ? data.date : new Date().toISOString().split('T')[0],
              ledger_id: ledgerId || null,
              subtotal: data.subtotal || 0,
              cgst_amount: data.is_interstate ? 0 : (data.total_tax / 2 || 0),
              sgst_amount: data.is_interstate ? 0 : (data.total_tax / 2 || 0),
              igst_amount: data.is_interstate ? (data.total_tax || 0) : 0,
              total_tax: data.total_tax || 0,
              grand_total: data.grand_total || 0,
              net_amount: data.grand_total || 0,
              notes: 'Created via Mobile App',
              is_interstate: data.is_interstate ? 1 : 0
            };

            const created = voucherCreate(db, voucherData, data.items || []);
            sendJson(201, { success: true, invoice: created });
          } catch (err) {
            sendJson(400, { error: err.message });
          }
        });
        return;
      }

      // 7. Delete Invoice from Mobile
      if (pathname.startsWith('/api/invoices/') && req.method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        if (isNaN(id)) {
          sendJson(400, { error: 'Invalid invoice ID' });
          return;
        }
        voucherDelete(db, id);
        sendJson(200, { success: true, deletedId: id });
        return;
      }

      // 404 Not Found
      sendJson(404, { error: 'Not found' });
    } catch (error) {
      sendJson(500, { error: error.message });
    }
  });

  server.listen(activePort, '0.0.0.0', () => {
    console.log(`[Mobile Pairing Server] Running on http://${getLocalIpAddress()}:${activePort}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Mobile Pairing Server] Port ${activePort} in use, trying ${activePort + 1}`);
      server.close();
      server = null;
      startPairingServer(db, activePort + 1);
    }
  });
}

export function stopPairingServer() {
  if (server) {
    server.close();
    server = null;
  }
}
