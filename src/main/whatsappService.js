'use strict';

import path from 'path';
import qrcode from 'qrcode';
import whatsappWeb from 'whatsapp-web.js';

const { Client, LocalAuth, MessageMedia } = whatsappWeb;

let client = null;
let status = 'disconnected';
let qrDataUrl = null;
let statusListener = null;
let initializationPromise = null;

function publish(nextStatus, extra = {}) {
  status = nextStatus;
  if (nextStatus !== 'qr') qrDataUrl = null;
  statusListener?.({ status, qr: qrDataUrl, ...extra });
}

function normalizePhone(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  const phone10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (phone10.length !== 10) {
    throw new Error(`Invalid phone number: expected 10 digits, got "${phoneNumber}"`);
  }
  return `91${phone10}`;
}

function getWhatsAppStatus() {
  return { status, qr: qrDataUrl };
}

async function initializeWhatsApp(userDataPath, onStatus) {
  statusListener = onStatus;
  if (client) return getWhatsAppStatus();
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'interiors-word',
        dataPath: path.join(userDataPath, 'whatsapp-session')
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    client.on('qr', async (qr) => {
      qrDataUrl = await qrcode.toDataURL(qr, { width: 280, margin: 2 });
      publish('qr');
    });
    client.on('authenticated', () => publish('authenticated'));
    client.on('ready', () => publish('ready'));
    client.on('auth_failure', (message) => publish('error', { error: message }));
    client.on('disconnected', (reason) => {
      client = null;
      initializationPromise = null;
      publish('disconnected', { error: String(reason || 'WhatsApp disconnected') });
    });

    publish('connecting');
    await client.initialize();
    return getWhatsAppStatus();
  })().catch((error) => {
    client = null;
    initializationPromise = null;
    publish('error', { error: error.message });
    throw error;
  });

  return initializationPromise;
}

async function disconnectWhatsApp() {
  if (client) await client.destroy();
  client = null;
  initializationPromise = null;
  publish('disconnected');
  return getWhatsAppStatus();
}

async function sendToWhatsApp(pdfPath, phoneNumber, message = '') {
  if (!client || status !== 'ready') {
    throw new Error('WhatsApp is not connected. Scan the QR code first.');
  }

  const phone = normalizePhone(phoneNumber);
  const chatId = `${phone}@c.us`;
  const isRegistered = await client.isRegisteredUser(chatId);
  if (!isRegistered) throw new Error('This phone number is not registered on WhatsApp.');

  if (message.trim()) await client.sendMessage(chatId, message.trim());
  const media = MessageMedia.fromFilePath(pdfPath);
  await client.sendMessage(chatId, media, { sendMediaAsDocument: true });

  return { success: true, phone };
}

export {
  initializeWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  sendToWhatsApp
};
