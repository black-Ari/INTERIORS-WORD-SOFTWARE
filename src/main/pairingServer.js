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
  return {
    ip,
    port: activePort,
    serverUrl,
    qrDataUri: qrToSvgDataUri(serverUrl, 2),
    companyName: company.name || 'INTERIORS WORD',
    pairingCode: String(Math.abs(hashString(ip + activePort))).slice(0, 6)
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
        const vouchers = voucherList(db, { type: 'sales' });
        // Format for mobile app
        const formatted = vouchers.map(v => ({
          id: v.id,
          voucher_number: v.voucher_number,
          date: v.date,
          customer_name: v.ledger_name || 'Customer',
          customer_phone: v.phone || '',
          customer_gstin: v.gstin || '',
          subtotal: v.subtotal,
          total_tax: v.total_tax,
          grand_total: v.grand_total,
          status: v.status || 'Paid',
          is_interstate: v.is_interstate === 1
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
            const voucherData = {
              voucher_number: data.voucher_number,
              voucher_type: 'sales',
              date: data.date || new Date().toISOString().split('T')[0],
              ledger_id: data.ledger_id || null,
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
