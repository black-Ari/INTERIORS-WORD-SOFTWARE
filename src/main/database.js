'use strict';

import Database from 'better-sqlite3';
import { RECOMMENDED_CATEGORIES } from '@shared/recommendedCategories.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Return the Indian financial-year label for a given date.
 * Indian FY runs April → March.  FY 2025-26 ⇒ "25-26"
 */
function financialYearLabel(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-based
  const startYear = month >= 3 ? year : year - 1; // April = index 3
  const endYear = startYear + 1;
  const fmt = (y) => String(y).slice(-2);
  return `${fmt(startYear)}-${fmt(endYear)}`;
}

/**
 * Prefix map for voucher types
 */
const VOUCHER_PREFIX = {
  sales: 'IW/S',
  purchase: 'IW/P',
  credit_note: 'IW/CN',
  debit_note: 'IW/DN'
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS company_profile (
  id          INTEGER PRIMARY KEY,
  name        TEXT,
  address     TEXT,
  phone       TEXT,
  gstin       TEXT,
  state_code  TEXT,
  state_name  TEXT,
  bank_name   TEXT,
  account_no  TEXT,
  ifsc        TEXT
);

CREATE TABLE IF NOT EXISTS ledgers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  type            TEXT CHECK(type IN ('customer','vendor')),
  phone           TEXT,
  email           TEXT,
  gstin           TEXT,
  address         TEXT,
  state_code      TEXT,
  state_name      TEXT,
  opening_balance REAL DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  category        TEXT,
  hsn_code        TEXT,
  gst_rate        REAL,
  unit            TEXT,
  sale_price      REAL,
  purchase_price  REAL,
  stock_qty       REAL DEFAULT 0,
  brand           TEXT,
  specifications  TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  value       TEXT UNIQUE,
  label       TEXT,
  hsn         TEXT,
  gstRate     REAL,
  defaultUnit TEXT,
  icon        TEXT
);

CREATE TABLE IF NOT EXISTS vouchers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_number  TEXT UNIQUE,
  voucher_type    TEXT CHECK(voucher_type IN ('sales','purchase','credit_note','debit_note')),
  date            TEXT,
  ledger_id       INTEGER REFERENCES ledgers(id),
  subtotal        REAL,
  cgst_amount     REAL,
  sgst_amount     REAL,
  igst_amount     REAL,
  total_tax       REAL,
  grand_total     REAL,
  discount_amount REAL DEFAULT 0,
  round_off       REAL DEFAULT 0,
  net_amount      REAL,
  notes           TEXT,
  is_interstate   INTEGER DEFAULT 0,
  pdf_path        TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voucher_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id       INTEGER REFERENCES vouchers(id),
  item_id          INTEGER,
  description      TEXT,
  category         TEXT,
  quantity         REAL,
  unit             TEXT,
  rate             REAL,
  discount_percent REAL DEFAULT 0,
  amount           REAL,
  hsn_code         TEXT,
  gst_rate         REAL,
  cgst_amount      REAL,
  sgst_amount      REAL,
  igst_amount      REAL,
  calc_metadata    TEXT
);

CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
CREATE INDEX IF NOT EXISTS idx_vouchers_ledger_id ON vouchers(ledger_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_ledgers_type ON ledgers(type);
`;

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

function initDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  // Seed an empty company_profile row if none exists
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM company_profile').get();
  if (row.cnt === 0) {
    db.prepare('INSERT INTO company_profile (id) VALUES (1)').run();
  }

  // Safe migration: Add logo column if it doesn't exist
  try {
    db.prepare('ALTER TABLE company_profile ADD COLUMN logo TEXT').run();
  } catch (err) {}

  // Safe migration: Add invoice_template column if it doesn't exist
  try {
    db.prepare('ALTER TABLE company_profile ADD COLUMN invoice_template TEXT DEFAULT "professional"').run();
  } catch (err) {}
  try {
    db.prepare("UPDATE company_profile SET invoice_template = 'professional' WHERE invoice_template IS NULL OR invoice_template IN ('standard', 'interiors', 'modern', 'minimalist', 'executive')").run();
  } catch (err) {}

  // Safe migration: Add upi_id column if it doesn't exist
  try {
    db.prepare('ALTER TABLE company_profile ADD COLUMN upi_id TEXT').run();
  } catch (err) {}

  // Safe migration: Add theme_color column if it doesn't exist
  try {
    db.prepare('ALTER TABLE company_profile ADD COLUMN theme_color TEXT DEFAULT "#2563eb"').run();
  } catch (err) {}

  // Safe migration: Remove CHECK constraint from items table
  const itemsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'").get().sql;
  if (itemsSql.includes('CHECK(category IN')) {
    db.exec(`
      CREATE TABLE items_new (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL,
        category        TEXT,
        hsn_code        TEXT,
        gst_rate        REAL,
        unit            TEXT,
        sale_price      REAL,
        purchase_price  REAL,
        stock_qty       REAL DEFAULT 0,
        brand           TEXT,
        specifications  TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO items_new SELECT * FROM items;
      DROP TABLE items;
      ALTER TABLE items_new RENAME TO items;
    `);
  }

  // Seed recommended categories — adds any that are missing (safe for existing installs)
  seedRecommendedCategories(db);

  return db;
}

function seedRecommendedCategories(db) {
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (value, label, hsn, gstRate, defaultUnit, icon)
    VALUES (@value, @label, @hsn, @gstRate, @defaultUnit, @icon)
  `);
  const seedTxn = db.transaction((categories) => {
    for (const cat of categories) {
      insertCat.run(cat);
    }
  });
  seedTxn(RECOMMENDED_CATEGORIES);
}

// ---------------------------------------------------------------------------
// Company Profile
// ---------------------------------------------------------------------------

function companyGet(db) {
  return db.prepare('SELECT * FROM company_profile WHERE id = 1').get() || {};
}

function companySave(db, data) {
  const stmt = db.prepare(`
    UPDATE company_profile SET
      name       = @name,
      address    = @address,
      phone      = @phone,
      gstin      = @gstin,
      state_code = @state_code,
      state_name = @state_name,
      bank_name  = @bank_name,
      account_no = @account_no,
      ifsc       = @ifsc,
      logo       = @logo,
      invoice_template = @invoice_template,
      upi_id     = @upi_id,
      theme_color = @theme_color
    WHERE id = 1
  `);
  stmt.run({
    name: data.name || null,
    address: data.address || null,
    phone: data.phone || null,
    gstin: data.gstin || null,
    state_code: data.state_code || null,
    state_name: data.state_name || null,
    bank_name: data.bank_name || null,
    account_no: data.account_no || null,
    ifsc: data.ifsc || null,
    logo: data.logo || null,
    invoice_template: data.invoice_template || 'standard',
    upi_id: data.upi_id || null,
    theme_color: data.theme_color || '#2563eb'
  });
  return companyGet(db);
}

// ---------------------------------------------------------------------------
// Ledgers
// ---------------------------------------------------------------------------

function ledgerCreate(db, data) {
  const stmt = db.prepare(`
    INSERT INTO ledgers (name, type, phone, email, gstin, address, state_code, state_name, opening_balance)
    VALUES (@name, @type, @phone, @email, @gstin, @address, @state_code, @state_name, @opening_balance)
  `);
  const info = stmt.run({
    name: data.name,
    type: data.type || null,
    phone: data.phone || null,
    email: data.email || null,
    gstin: data.gstin || null,
    address: data.address || null,
    state_code: data.state_code || null,
    state_name: data.state_name || null,
    opening_balance: data.opening_balance || 0
  });
  return ledgerGet(db, info.lastInsertRowid);
}

function ledgerUpdate(db, id, data) {
  const stmt = db.prepare(`
    UPDATE ledgers SET
      name            = @name,
      type            = @type,
      phone           = @phone,
      email           = @email,
      gstin           = @gstin,
      address         = @address,
      state_code      = @state_code,
      state_name      = @state_name,
      opening_balance = @opening_balance
    WHERE id = @id
  `);
  stmt.run({
    id,
    name: data.name,
    type: data.type || null,
    phone: data.phone || null,
    email: data.email || null,
    gstin: data.gstin || null,
    address: data.address || null,
    state_code: data.state_code || null,
    state_name: data.state_name || null,
    opening_balance: data.opening_balance || 0
  });
  return ledgerGet(db, id);
}

function ledgerDelete(db, id) {
  // Prevent deletion if ledger is used in vouchers
  const used = db.prepare('SELECT COUNT(*) AS cnt FROM vouchers WHERE ledger_id = ?').get(id);
  if (used.cnt > 0) {
    throw new Error('Cannot delete ledger: it has associated vouchers.');
  }
  db.prepare('DELETE FROM ledgers WHERE id = ?').run(id);
  return { success: true };
}

function ledgerList(db) {
  return db.prepare('SELECT * FROM ledgers ORDER BY name ASC').all();
}

function ledgerSearch(db, query) {
  const pattern = `%${query}%`;
  return db.prepare(`
    SELECT * FROM ledgers
    WHERE name LIKE @pattern
       OR phone LIKE @pattern
       OR gstin LIKE @pattern
       OR email LIKE @pattern
    ORDER BY name ASC
  `).all({ pattern });
}

function ledgerGet(db, id) {
  return db.prepare('SELECT * FROM ledgers WHERE id = ?').get(id);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function categoryCreate(db, data) {
  const stmt = db.prepare(`
    INSERT INTO categories (value, label, hsn, gstRate, defaultUnit, icon)
    VALUES (@value, @label, @hsn, @gstRate, @defaultUnit, @icon)
  `);
  const info = stmt.run({
    value: data.value,
    label: data.label || data.value,
    hsn: data.hsn || null,
    gstRate: data.gstRate || 0,
    defaultUnit: data.defaultUnit || null,
    icon: data.icon || '🏷️'
  });
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
}

function categoryUpdate(db, id, data) {
  const stmt = db.prepare(`
    UPDATE categories SET
      value       = @value,
      label       = @label,
      hsn         = @hsn,
      gstRate     = @gstRate,
      defaultUnit = @defaultUnit,
      icon        = @icon
    WHERE id = @id
  `);
  stmt.run({
    id,
    value: data.value,
    label: data.label || data.value,
    hsn: data.hsn || null,
    gstRate: data.gstRate || 0,
    defaultUnit: data.defaultUnit || null,
    icon: data.icon || '🏷️'
  });
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function categoryDelete(db, id) {
  // Can check if items use this category... but items uses the string value.
  // We'll just delete the category record.
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { success: true };
}

function categoryList(db) {
  return db.prepare('SELECT * FROM categories ORDER BY label ASC').all();
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function itemCreate(db, data) {
  const stmt = db.prepare(`
    INSERT INTO items (name, category, hsn_code, gst_rate, unit, sale_price, purchase_price, stock_qty, brand, specifications)
    VALUES (@name, @category, @hsn_code, @gst_rate, @unit, @sale_price, @purchase_price, @stock_qty, @brand, @specifications)
  `);
  const info = stmt.run({
    name: data.name,
    category: data.category || null,
    hsn_code: data.hsn_code || null,
    gst_rate: data.gst_rate || 0,
    unit: data.unit || null,
    sale_price: data.sale_price || 0,
    purchase_price: data.purchase_price || 0,
    stock_qty: data.stock_qty || 0,
    brand: data.brand || null,
    specifications: data.specifications || null
  });
  return db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
}

function itemUpdate(db, id, data) {
  const stmt = db.prepare(`
    UPDATE items SET
      name           = @name,
      category       = @category,
      hsn_code       = @hsn_code,
      gst_rate       = @gst_rate,
      unit           = @unit,
      sale_price     = @sale_price,
      purchase_price = @purchase_price,
      stock_qty      = @stock_qty,
      brand          = @brand,
      specifications = @specifications
    WHERE id = @id
  `);
  stmt.run({
    id,
    name: data.name,
    category: data.category || null,
    hsn_code: data.hsn_code || null,
    gst_rate: data.gst_rate || 0,
    unit: data.unit || null,
    sale_price: data.sale_price || 0,
    purchase_price: data.purchase_price || 0,
    stock_qty: data.stock_qty != null ? data.stock_qty : 0,
    brand: data.brand || null,
    specifications: data.specifications || null
  });
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
}

function itemDelete(db, id) {
  const used = db.prepare('SELECT COUNT(*) AS cnt FROM voucher_items WHERE item_id = ?').get(id);
  if (used.cnt > 0) {
    throw new Error('Cannot delete item: it is referenced in vouchers.');
  }
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  return { success: true };
}

function itemList(db, category) {
  if (category) {
    return db.prepare('SELECT * FROM items WHERE category = ? ORDER BY name ASC').all(category);
  }
  return db.prepare('SELECT * FROM items ORDER BY name ASC').all();
}

function itemSearch(db, query) {
  const pattern = `%${query}%`;
  return db.prepare(`
    SELECT * FROM items
    WHERE name LIKE @pattern
       OR brand LIKE @pattern
       OR hsn_code LIKE @pattern
       OR category LIKE @pattern
    ORDER BY name ASC
  `).all({ pattern });
}

// ---------------------------------------------------------------------------
// Voucher Number Generation
// ---------------------------------------------------------------------------

function getNextVoucherNumber(db, type) {
  const now = new Date();
  const fyLabel = financialYearLabel(now);
  const prefix = VOUCHER_PREFIX[type] || 'IW';
  const likePattern = `${prefix}/${fyLabel}/%`;

  const row = db.prepare(`
    SELECT voucher_number FROM vouchers
    WHERE voucher_number LIKE ?
    ORDER BY id DESC LIMIT 1
  `).get(likePattern);

  let nextSeq = 1;
  if (row) {
    const parts = row.voucher_number.split('/');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seqStr = String(nextSeq).padStart(4, '0');
  return `${prefix}/${fyLabel}/${seqStr}`;
}

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------

function voucherCreate(db, voucherData, items) {
  const createTxn = db.transaction((vData, lineItems) => {
    // Generate voucher number
    const voucherNumber = getNextVoucherNumber(db, vData.voucher_type);

    // Insert voucher header
    const headerStmt = db.prepare(`
      INSERT INTO vouchers (
        voucher_number, voucher_type, date, ledger_id,
        subtotal, cgst_amount, sgst_amount, igst_amount,
        total_tax, grand_total, discount_amount, round_off,
        net_amount, notes, is_interstate
      ) VALUES (
        @voucher_number, @voucher_type, @date, @ledger_id,
        @subtotal, @cgst_amount, @sgst_amount, @igst_amount,
        @total_tax, @grand_total, @discount_amount, @round_off,
        @net_amount, @notes, @is_interstate
      )
    `);

    const headerInfo = headerStmt.run({
      voucher_number: voucherNumber,
      voucher_type: vData.voucher_type,
      date: vData.date || new Date().toISOString().slice(0, 10),
      ledger_id: vData.ledger_id,
      subtotal: vData.subtotal || 0,
      cgst_amount: vData.cgst_amount || 0,
      sgst_amount: vData.sgst_amount || 0,
      igst_amount: vData.igst_amount || 0,
      total_tax: vData.total_tax || 0,
      grand_total: vData.grand_total || 0,
      discount_amount: vData.discount_amount || 0,
      round_off: vData.round_off || 0,
      net_amount: vData.net_amount || 0,
      notes: vData.notes || null,
      is_interstate: vData.is_interstate ? 1 : 0
    });

    const voucherId = headerInfo.lastInsertRowid;

    // Insert line items
    const itemStmt = db.prepare(`
      INSERT INTO voucher_items (
        voucher_id, item_id, description, category,
        quantity, unit, rate, discount_percent, amount,
        hsn_code, gst_rate, cgst_amount, sgst_amount, igst_amount,
        calc_metadata
      ) VALUES (
        @voucher_id, @item_id, @description, @category,
        @quantity, @unit, @rate, @discount_percent, @amount,
        @hsn_code, @gst_rate, @cgst_amount, @sgst_amount, @igst_amount,
        @calc_metadata
      )
    `);

    const stockUpdateSale = db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE id = ?');
    const stockUpdatePurchase = db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?');

    for (const item of lineItems) {
      itemStmt.run({
        voucher_id: voucherId,
        item_id: item.item_id || null,
        description: item.description || null,
        category: item.category || null,
        quantity: item.quantity || 0,
        unit: item.unit || null,
        rate: item.rate || 0,
        discount_percent: item.discount_percent || 0,
        amount: item.amount || 0,
        hsn_code: item.hsn_code || null,
        gst_rate: item.gst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_amount: item.igst_amount || 0,
        calc_metadata: item.calc_metadata ? JSON.stringify(item.calc_metadata) : null
      });

      // Update stock quantities
      if (item.item_id && item.quantity) {
        if (vData.voucher_type === 'sales' || vData.voucher_type === 'debit_note') {
          stockUpdateSale.run(item.quantity, item.item_id);
        } else if (vData.voucher_type === 'purchase' || vData.voucher_type === 'credit_note') {
          stockUpdatePurchase.run(item.quantity, item.item_id);
        }
      }
    }

    return voucherId;
  });

  const voucherId = createTxn(voucherData, items);
  return voucherGet(db, voucherId);
}

function voucherList(db, filters) {
  let sql = `
    SELECT v.*, l.name AS ledger_name, l.phone AS ledger_phone, l.address AS ledger_address
    FROM vouchers v
    LEFT JOIN ledgers l ON v.ledger_id = l.id
    WHERE 1=1
  `;
  const params = {};

  if (filters) {
    if (filters.voucher_type) {
      sql += ' AND v.voucher_type = @voucher_type';
      params.voucher_type = filters.voucher_type;
    }
    if (filters.ledger_id) {
      sql += ' AND v.ledger_id = @ledger_id';
      params.ledger_id = filters.ledger_id;
    }
    if (filters.date_from) {
      sql += ' AND v.date >= @date_from';
      params.date_from = filters.date_from;
    }
    if (filters.date_to) {
      sql += ' AND v.date <= @date_to';
      params.date_to = filters.date_to;
    }
  }

  sql += ' ORDER BY v.id DESC';

  return db.prepare(sql).all(params);
}

function voucherGet(db, id) {
  const voucher = db.prepare(`
    SELECT v.*, l.name AS ledger_name, l.address AS ledger_address,
           l.gstin AS ledger_gstin, l.phone AS ledger_phone,
           l.state_code AS ledger_state_code, l.state_name AS ledger_state_name
    FROM vouchers v
    LEFT JOIN ledgers l ON v.ledger_id = l.id
    WHERE v.id = ?
  `).get(id);

  if (!voucher) return null;

  const lineItems = db.prepare(`
    SELECT vi.*, i.name AS item_name
    FROM voucher_items vi
    LEFT JOIN items i ON vi.item_id = i.id
    WHERE vi.voucher_id = ?
    ORDER BY vi.id ASC
  `).all(id);

  return { ...voucher, items: lineItems };
}

function voucherDelete(db, id) {
  const deleteTxn = db.transaction((voucherId) => {
    const vData = db.prepare('SELECT voucher_type FROM vouchers WHERE id = ?').get(voucherId);
    if (!vData) throw new Error('Voucher not found');

    const lineItems = db.prepare('SELECT item_id, quantity FROM voucher_items WHERE voucher_id = ?').all(voucherId);
    
    const stockUpdateSale = db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?');
    const stockUpdatePurchase = db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE id = ?');

    for (const item of lineItems) {
      if (item.item_id && item.quantity) {
        if (vData.voucher_type === 'sales' || vData.voucher_type === 'debit_note') {
          stockUpdateSale.run(item.quantity, item.item_id);
        } else if (vData.voucher_type === 'purchase' || vData.voucher_type === 'credit_note') {
          stockUpdatePurchase.run(item.quantity, item.item_id);
        }
      }
    }

    db.prepare('DELETE FROM voucher_items WHERE voucher_id = ?').run(voucherId);
    db.prepare('DELETE FROM vouchers WHERE id = ?').run(voucherId);
  });
  
  deleteTxn(id);
  return { success: true };
}

function voucherUpdate(db, id, voucherData, lineItems) {
  const updateTxn = db.transaction((voucherId, vData, items) => {
    const existing = db.prepare('SELECT voucher_type FROM vouchers WHERE id = ?').get(voucherId);
    if (!existing) throw new Error('Voucher not found');

    const oldItems = db.prepare('SELECT item_id, quantity FROM voucher_items WHERE voucher_id = ?').all(voucherId);
    
    // Reverse stock for old items
    const stockRevertSale = db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?');
    const stockRevertPurchase = db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE id = ?');
    for (const item of oldItems) {
      if (item.item_id && item.quantity) {
        if (existing.voucher_type === 'sales' || existing.voucher_type === 'debit_note') {
          stockRevertSale.run(item.quantity, item.item_id);
        } else if (existing.voucher_type === 'purchase' || existing.voucher_type === 'credit_note') {
          stockRevertPurchase.run(item.quantity, item.item_id);
        }
      }
    }

    // Delete old items
    db.prepare('DELETE FROM voucher_items WHERE voucher_id = ?').run(voucherId);

    // Update voucher record
    db.prepare(`
      UPDATE vouchers SET
        date = @date,
        ledger_id = @ledger_id,
        subtotal = @subtotal,
        cgst_amount = @cgst_amount,
        sgst_amount = @sgst_amount,
        igst_amount = @igst_amount,
        total_tax = @total_tax,
        grand_total = @grand_total,
        discount_amount = @discount_amount,
        round_off = @round_off,
        net_amount = @net_amount,
        notes = @notes,
        is_interstate = @is_interstate
      WHERE id = @id
    `).run({
      id: voucherId,
      date: vData.date,
      ledger_id: vData.ledger_id,
      subtotal: vData.subtotal || 0,
      cgst_amount: vData.cgst_amount || 0,
      sgst_amount: vData.sgst_amount || 0,
      igst_amount: vData.igst_amount || 0,
      total_tax: vData.total_tax || 0,
      grand_total: vData.grand_total || 0,
      discount_amount: vData.discount_amount || 0,
      round_off: vData.round_off || 0,
      net_amount: vData.net_amount || 0,
      notes: vData.notes || null,
      is_interstate: vData.is_interstate ? 1 : 0
    });

    // Insert new items
    const itemStmt = db.prepare(`
      INSERT INTO voucher_items (
        voucher_id, item_id, description, category, quantity, unit, rate, 
        discount_percent, amount, hsn_code, gst_rate, cgst_amount, sgst_amount, igst_amount, calc_metadata
      ) VALUES (
        @voucher_id, @item_id, @description, @category, @quantity, @unit, @rate,
        @discount_percent, @amount, @hsn_code, @gst_rate, @cgst_amount, @sgst_amount, @igst_amount, @calc_metadata
      )
    `);

    const stockUpdateSale = db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE id = ?');
    const stockUpdatePurchase = db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?');

    for (const item of items) {
      itemStmt.run({
        voucher_id: voucherId,
        item_id: item.item_id || null,
        description: item.description || null,
        category: item.category || null,
        quantity: item.quantity || 0,
        unit: item.unit || null,
        rate: item.rate || 0,
        discount_percent: item.discount_percent || 0,
        amount: item.amount || 0,
        hsn_code: item.hsn_code || null,
        gst_rate: item.gst_rate || 0,
        cgst_amount: item.cgst_amount || 0,
        sgst_amount: item.sgst_amount || 0,
        igst_amount: item.igst_amount || 0,
        calc_metadata: item.calc_metadata ? JSON.stringify(item.calc_metadata) : null
      });

      // Apply new stock quantities
      if (item.item_id && item.quantity) {
        if (existing.voucher_type === 'sales' || existing.voucher_type === 'debit_note') {
          stockUpdateSale.run(item.quantity, item.item_id);
        } else if (existing.voucher_type === 'purchase' || existing.voucher_type === 'credit_note') {
          stockUpdatePurchase.run(item.quantity, item.item_id);
        }
      }
    }
  });

  updateTxn(id, voucherData, lineItems);
  return voucherGet(db, id);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function dashboardStats(db, filters = {}) {
  const dateFrom = filters.date_from || new Date().toISOString().slice(0, 10);
  const dateTo = filters.date_to || new Date().toISOString().slice(0, 10);

  const salesStats = db.prepare(`
    SELECT COALESCE(SUM(net_amount), 0) AS total, COUNT(*) AS count
    FROM vouchers
    WHERE voucher_type = 'sales' AND date >= ? AND date <= ?
  `).get(dateFrom, dateTo);

  const purchaseStats = db.prepare(`
    SELECT COALESCE(SUM(net_amount), 0) AS total, COUNT(*) AS count
    FROM vouchers
    WHERE voucher_type = 'purchase' AND date >= ? AND date <= ?
  `).get(dateFrom, dateTo);

  const totalCustomers = db.prepare(
    "SELECT COUNT(*) AS count FROM ledgers WHERE type = 'customer'"
  ).get();

  const totalItems = db.prepare(
    'SELECT COUNT(*) AS count FROM items'
  ).get();

  const recentInvoices = db.prepare(`
    SELECT v.id, v.voucher_number, v.date, v.net_amount, v.voucher_type,
           l.name AS ledger_name
    FROM vouchers v
    LEFT JOIN ledgers l ON v.ledger_id = l.id
    WHERE v.date >= ? AND v.date <= ?
    ORDER BY v.id DESC LIMIT 10
  `).all(dateFrom, dateTo);

  const monthsMap = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mName = monthsMap[d.getMonth()];
    last6Months.push({ ym, label: mName, value: 0 });
  }

  try {
    const trendRows = db.prepare(`
      SELECT strftime('%Y-%m', date) AS ym, COALESCE(SUM(net_amount), 0) AS total
      FROM vouchers
      WHERE voucher_type = 'sales' AND date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', date)
    `).all();

    const trendMap = {};
    for (const r of trendRows) {
      trendMap[r.ym] = r.total;
    }

    for (const item of last6Months) {
      if (trendMap[item.ym] != null) {
        item.value = trendMap[item.ym];
      }
    }
  } catch (_) {}

  return {
    todaySalesTotal: salesStats.total,
    todaySalesCount: salesStats.count,
    todayPurchaseTotal: purchaseStats.total,
    todayPurchaseCount: purchaseStats.count,
    totalCustomers: totalCustomers.count,
    totalItems: totalItems.count,
    recentInvoices: recentInvoices,
    monthlyTrend: last6Months
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
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
};

function globalSearch(db, query) {
  if (!query || query.trim() === '') return [];
  const q = `%${query.trim()}%`;
  
  const ledgers = db.prepare(`
    SELECT id, name AS title, 'Ledger' AS type, 'ledgers' AS category, phone AS subtitle 
    FROM ledgers 
    WHERE name LIKE ? OR phone LIKE ? OR gstin LIKE ?
    LIMIT 5
  `).all(q, q, q);
  
  const items = db.prepare(`
    SELECT id, name AS title, 'Item' AS type, 'items' AS category, brand AS subtitle 
    FROM items 
    WHERE name LIKE ? OR brand LIKE ? OR hsn_code LIKE ? OR category LIKE ?
    LIMIT 5
  `).all(q, q, q, q);
  
  const vouchers = db.prepare(`
    SELECT v.id, v.voucher_number AS title, v.voucher_type AS type, 'vouchers' AS category, l.name AS subtitle 
    FROM vouchers v 
    LEFT JOIN ledgers l ON v.ledger_id = l.id 
    WHERE v.voucher_number LIKE ? OR l.name LIKE ?
    LIMIT 5
  `).all(q, q);
  
  return [...ledgers, ...items, ...vouchers];
}
