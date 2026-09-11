'use strict';

const { contextBridge, ipcRenderer } = require('electron');

async function invokeApi(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result && result.success === false) {
    throw new Error(result.error || 'Unknown error occurred');
  }
  return result ? result.data : null;
}

contextBridge.exposeInMainWorld('api', {
  companyGet: () => invokeApi('db:company-get'),
  companySave: (data) => invokeApi('db:company-save', data),
  ledgerCreate: (data) => invokeApi('db:ledger-create', data),
  ledgerUpdate: (id, data) => invokeApi('db:ledger-update', id, data),
  ledgerDelete: (id) => invokeApi('db:ledger-delete', id),
  ledgerList: () => invokeApi('db:ledger-list'),
  ledgerSearch: (query) => invokeApi('db:ledger-search', query),
  ledgerGet: (id) => invokeApi('db:ledger-get', id),
  categoryCreate: (data) => invokeApi('db:category-create', data),
  categoryUpdate: (id, data) => invokeApi('db:category-update', id, data),
  categoryDelete: (id) => invokeApi('db:category-delete', id),
  categoryList: () => invokeApi('db:category-list'),
  itemCreate: (data) => invokeApi('db:item-create', data),
  itemUpdate: (id, data) => invokeApi('db:item-update', id, data),
  itemDelete: (id) => invokeApi('db:item-delete', id),
  itemList: (category) => invokeApi('db:item-list', category),
  itemSearch: (query) => invokeApi('db:item-search', query),
  voucherCreate: (data, items) => invokeApi('db:voucher-create', data, items),
  voucherUpdate: (id, data, items) => invokeApi('db:voucher-update', id, data, items),
  voucherList: (filters) => invokeApi('db:voucher-list', filters),
  voucherGet: (id) => invokeApi('db:voucher-get', id),
  voucherDelete: (id) => invokeApi('db:voucher-delete', id),
  getNextVoucherNumber: (type) => invokeApi('db:next-voucher-number', type),
  dashboardStats: (filters) => invokeApi('db:dashboard-stats', filters),
  globalSearch: (query) => invokeApi('app:global-search', query),
  generatePDF: (voucherId) => invokeApi('pdf:generate', voucherId),
  printInvoice: (voucherId) => invokeApi('pdf:print', voucherId),
  sendToWhatsApp: (voucherId, phone) => invokeApi('whatsapp:send', voucherId, phone),
  whatsappStatus: () => invokeApi('whatsapp:status'),
  whatsappConnect: () => invokeApi('whatsapp:connect'),
  whatsappDisconnect: () => invokeApi('whatsapp:disconnect'),
  onWhatsAppStatus: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('whatsapp:status', listener);
    return () => ipcRenderer.removeListener('whatsapp:status', listener);
  },
  openPDFFolder: () => invokeApi('app:open-pdf-folder'),
  openWBManager: () => invokeApi('app:open-wb-manager'),
  backupDatabase: () => invokeApi('app:backup-database'),
  restoreDatabase: () => invokeApi('app:restore-database'),
  getVersion: () => invokeApi('app:get-version'),
  selectFile: (opts) => ipcRenderer.invoke('app:select-file', opts),
  sendInvoiceWhatsApp: (voucherId, phone, message) => ipcRenderer.invoke('invoice:send-whatsapp', { voucherId, phone, message }),
  getMobilePairingInfo: () => invokeApi('mobile:get-pairing-info'),

  // Native WhatsApp System
  wa: {
    getStatus: () => ipcRenderer.invoke('wa:get-status'),
    connect: () => ipcRenderer.invoke('wa:connect'),
    logout: () => ipcRenderer.invoke('wa:logout'),
    resetSession: () => ipcRenderer.invoke('wa:reset-session'),
    sendBulk: (payload) => ipcRenderer.invoke('wa:send-bulk', payload),
    sendDirect: (payload) => ipcRenderer.invoke('wa:send-direct', payload),
    getAutoReply: () => ipcRenderer.invoke('wa:get-auto-reply'),
    saveAutoReply: (settings) => ipcRenderer.invoke('wa:save-auto-reply', settings),
    detectProvider: (apiKey) => ipcRenderer.invoke('wa:detect-provider', { apiKey }),
    previewAiReply: (payload) => ipcRenderer.invoke('wa:preview-ai-reply', payload),
    getOrders: () => ipcRenderer.invoke('wa:get-orders'),
    updateOrderStatus: (orderId, status) => ipcRenderer.invoke('wa:update-order-status', { orderId, status }),
    confirmOrder: (orderId) => ipcRenderer.invoke('wa:confirm-order', { orderId }),
    rejectOrder: (orderId, reason) => ipcRenderer.invoke('wa:reject-order', { orderId, reason }),
    deleteOrder: (orderId) => ipcRenderer.invoke('wa:delete-order', { orderId }),
    getAlerts: () => ipcRenderer.invoke('wa:get-alerts'),
    dismissAlert: (alertId) => ipcRenderer.invoke('wa:dismiss-alert', { alertId }),
    replyToAlert: (payload) => ipcRenderer.invoke('wa:reply-to-alert', payload),
    getCustomerContacts: () => ipcRenderer.invoke('wa:get-customer-contacts'),

    onQr: (cb) => {
      const listener = (_e, url) => cb(url);
      ipcRenderer.on('wa:qr', listener);
      return () => ipcRenderer.removeListener('wa:qr', listener);
    },
    onStatus: (cb) => {
      const listener = (_e, payload) => cb(payload);
      ipcRenderer.on('wa:status', listener);
      return () => ipcRenderer.removeListener('wa:status', listener);
    },
    onLog: (cb) => {
      const listener = (_e, entry) => cb(entry);
      ipcRenderer.on('wa:log', listener);
      return () => ipcRenderer.removeListener('wa:log', listener);
    },
    onBulkProgress: (cb) => {
      const listener = (_e, progress) => cb(progress);
      ipcRenderer.on('wa:bulk-progress', listener);
      return () => ipcRenderer.removeListener('wa:bulk-progress', listener);
    },
    onOrderSummary: (cb) => {
      const listener = (_e, order) => cb(order);
      ipcRenderer.on('wa:order-summary', listener);
      return () => ipcRenderer.removeListener('wa:order-summary', listener);
    },
    onOwnerAlert: (cb) => {
      const listener = (_e, alert) => cb(alert);
      ipcRenderer.on('wa:owner-alert', listener);
      return () => ipcRenderer.removeListener('wa:owner-alert', listener);
    }
  },

  // Auto-Updater System
  updater: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (downloadUrl) => ipcRenderer.invoke('update:download', { downloadUrl }),
    install: (filePath) => ipcRenderer.invoke('update:install', { filePath }),

    onAvailable: (cb) => {
      const listener = (_e, info) => cb(info);
      ipcRenderer.on('update:available', listener);
      return () => ipcRenderer.removeListener('update:available', listener);
    },
    onProgress: (cb) => {
      const listener = (_e, prog) => cb(prog);
      ipcRenderer.on('update:progress', listener);
      return () => ipcRenderer.removeListener('update:progress', listener);
    },
    onDownloaded: (cb) => {
      const listener = (_e, info) => cb(info);
      ipcRenderer.on('update:downloaded', listener);
      return () => ipcRenderer.removeListener('update:downloaded', listener);
    }
  }
});
