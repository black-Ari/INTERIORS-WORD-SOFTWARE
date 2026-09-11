# INTERIORS WORD — Professional GST Billing & ERP Software

[![Version](https://img.shields.io/badge/version-3.3.0-blue.svg)](https://github.com/black-Ari/INTERIORS-WORD-SOFTWARE/releases/tag/v3.3.0)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)]()
[![Electron](https://img.shields.io/badge/Electron-35.7.5-cyan.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1.0-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1.8-38bdf8.svg)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%203-003b57.svg)](https://www.sqlite.org/)

**INTERIORS WORD** is a modern, high-performance desktop GST billing, inventory management, and automated WhatsApp ERP application designed specifically for interior designers, home decor merchants, furnishing studios, wallpaper/curtain vendors, and architectural consultants.

---

## 🚀 Key Highlights & Capabilities

### 🏆 1. Rule 46 Compliant Professional GST Invoicing
- **100% Precise Math Engine**: Zero 1-paisa rounding discrepancies across item discounts, taxable value, and tax calculation.
- **Dedicated HSN/SAC Tax Summary Table**: Summarizes Taxable Amount, CGST Rate/Amt, SGST Rate/Amt, and IGST Rate/Amt per HSN code, directly matching GSTR-1 and GSTR-3B return tables.
- **Intra-State & Inter-State Auto-Switching**: Automatically detects state codes and switches between dual tax (CGST + SGST) and integrated tax (IGST).
- **Dynamic UPI Payment QR Code**: Generates real-time `Scan to Pay with Any UPI App` QR codes with pre-filled net invoice amounts for instant customer payment.
- **Amounts in Indian Words**: Full converter for Grand Total and Total Tax in standard Indian numbering (`Lakhs`, `Crores`, `Rupees ... and ... Paise Only`).
- **Official Print Layout**: Clean top banner with document copy badge (`ORIGINAL FOR RECIPIENT`), supplier GST details, buyer party info, bank details, and authorized signatory seal.

### 📲 2. Integrated Background WhatsApp Delivery
- **Zero-Popup Delivery**: Send invoice copies, payment reminders, and PDF bills directly through the background Baileys socket connection—no external popups or browser redirects required.
- **Universal Multi-File Support**:
  - **Invoices & Documents**: PDF (`.pdf`), Word (`.docx`, `.doc`)
  - **Spreadsheets & Price Lists**: Excel (`.xlsx`, `.xls`, `.csv`)
  - **Catalogs & Visuals**: Images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)
- **Bulk Broadcast Campaigns**: Send personalized marketing catalogs and payment notices to filtered client groups using dynamic tags (`{name}`, `{phone}`, `{city}`, `{balance}`).
- **Smart Anti-Ban Throttling**: Humanized randomized jitter delays (4–8.5s) to protect business WhatsApp accounts from rate limits.
- **AI-Powered Auto Responder**: Built-in conversational auto-replies with intelligent order extraction.

### 📦 3. Interior & Furnishing Inventory Master
- Tailored for home decor units: `Roll` (Wallpapers), `Mtr` (Fabrics/Curtains), `Sq.Ft` (Wooden Flooring, Wall Panels), `Pcs`, `Set`, `Box`.
- Fast item search with default HSN/SAC codes, tax slabs (0%, 5%, 12%, 18%, 28%), purchase costs, and sales rates.
- Low-stock alerts and live inventory valuation.

### 👥 4. Ledger & Party Management
- Complete registry for **Customers**, **Suppliers**, **Architects**, and **Contractors**.
- Validated GSTIN, PAN, Phone, Billing & Shipping Address, and State Codes.
- Real-time ledger balances, transaction history, and statement generation.

### 📊 5. Comprehensive Financial Reports
- Sales Register, Purchase Register, Day Book, and Party Statements.
- Tax Liability Reports (CGST, SGST, IGST totals for monthly GST filings).
- One-click export to **Excel (.xlsx)** and **PDF**.

### 🔄 6. Seamless Auto-Updater
- Integrated with GitHub Releases.
- Checks for updates automatically on startup and via **Settings**.
- Downloads new releases in the background with a live progress bar and performs safe, one-click silent updates.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Framework** | [Electron 35](https://www.electronjs.org/) + [electron-vite 3](https://electron-vite.org/) |
| **Frontend UI** | [React 19](https://react.dev/) + [React Router 7](https://reactrouter.com/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **Local Database** | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (high-speed embedded SQLite) |
| **WhatsApp Engine** | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) |
| **Packaging & Installer** | [electron-builder](https://www.electron.build/) (NSIS Windows Installer) |

---

## ⌨️ Keyboard Shortcuts

INTERIORS WORD v3.3.0 introduces comprehensive ERP-grade keyboard shortcuts designed for high-speed, mouse-free billing and data entry:

### 🧭 Navigation
| Shortcut | Action |
| :--- | :--- |
| <kbd>F2</kbd> or <kbd>Ctrl</kbd> + <kbd>1</kbd> | 📊 Dashboard Overview |
| <kbd>F8</kbd> or <kbd>Ctrl</kbd> + <kbd>2</kbd> | 🧾 Sales Invoice / Tax Invoice |
| <kbd>F9</kbd> or <kbd>Ctrl</kbd> + <kbd>3</kbd> | 📥 Purchase Entry |
| <kbd>F4</kbd> or <kbd>Ctrl</kbd> + <kbd>4</kbd> | 👥 Ledger Master (Customers & Suppliers) |
| <kbd>F5</kbd> or <kbd>Ctrl</kbd> + <kbd>5</kbd> | 📦 Item Master (Stock & Products) |
| <kbd>F6</kbd> or <kbd>Ctrl</kbd> + <kbd>6</kbd> | 📑 Reports & Registers |
| <kbd>F10</kbd> or <kbd>Ctrl</kbd> + <kbd>7</kbd> | 💬 WhatsApp Business Manager |
| <kbd>F12</kbd> or <kbd>Ctrl</kbd> + <kbd>8</kbd> | ⚙️ Company & Invoice Settings |

### ⚡ Actions & Fast Entry
| Shortcut | Action | Context |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | **Save / Record Voucher** | Sales, Purchase, Masters, Settings |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | **Print / Export PDF** | Sales Invoice (Instant high-res PDF) |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> / <kbd>Alt</kbd> + <kbd>N</kbd> | **Add Row / Create Record** | Sales/Purchase: add row; Masters: new item/ledger |
| <kbd>Alt</kbd> + <kbd>C</kbd> | **Quick Add Customer / Vendor** | Sales Invoice & Purchase Entry |
| <kbd>Alt</kbd> + <kbd>I</kbd> | **Jump to Item Master** | Sales & Purchase |
| <kbd>Alt</kbd> + <kbd>W</kbd> | **Open WhatsApp Engine** | Global / Sales Invoice |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | **Quick Send Message** | WhatsApp Manager |
| <kbd>Alt</kbd> + <kbd>O</kbd> | **Open Invoices PDF Folder** | Reports |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>F</kbd> | **Focus Search Filter** | Reports & Search bars |
| <kbd>Alt</kbd> + <kbd>Delete</kbd> | **Remove Active Row** | Sales & Purchase item tables |
| <kbd>F1</kbd> / <kbd>Ctrl</kbd> + <kbd>/</kbd> / <kbd>?</kbd> | **Interactive Shortcut Cheat Sheet** | Global searchable modal dialog |
| <kbd>Esc</kbd> | **Close Modal / Back** | Modals & Dialogs |

---

## 📥 Installation & Setup

### For End Users
Download the latest Windows setup installer from the [Releases](https://github.com/black-Ari/INTERIORS-WORD-SOFTWARE/releases/latest) page:
- **`INTERIORS WORD Setup 3.3.0.exe`**

Run the installer and follow the on-screen instructions. The application will launch with a desktop shortcut created automatically.

### For Developers

1. **Clone the repository**:
   ```bash
   git clone https://github.com/black-Ari/INTERIORS-WORD-SOFTWARE.git
   cd INTERIORS-WORD-SOFTWARE
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

4. **Build production bundles**:
   ```bash
   npm run build
   ```

5. **Package Windows Installer (.exe)**:
   ```bash
   npm run dist
   ```

---

## 🏢 Company & Project Details

- **Application**: INTERIORS WORD
- **Version**: 3.3.0 (Professional Edition)
- **Repository**: [black-Ari/INTERIORS-WORD-SOFTWARE](https://github.com/black-Ari/INTERIORS-WORD-SOFTWARE)

---

## 📄 License
Copyright (c) 2026 INTERIORS WORD. All rights reserved.
