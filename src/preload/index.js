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
  getVersion: () => invokeApi('app:get-version')
});
