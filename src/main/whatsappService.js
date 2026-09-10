import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import QRCode from 'qrcode';
import Store from './whatsappStore.js';
import { generateReply, extractOrderFromConversation } from './whatsappAiReply.js';

const AUTH_FOLDER = () => path.join(app.getPath('userData'), 'iw_whatsapp_auth');

const SIMPLE_REPLY_COOLDOWN_MS = 60 * 60 * 1000;
const AI_MIN_GAP_MS = 1500;
const AI_FLOOD_WINDOW_MS = 60 * 1000;
const AI_FLOOD_MAX_MESSAGES = 8;
const AI_FLOOD_PAUSE_MS = 10 * 60 * 1000;

const MIN_DELAY_MS = 4000;
const MAX_DELAY_MS = 8500;

function randomDelay() {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class WhatsAppService {
  constructor({ onQr, onStatus, onLog, onOrderSummary, onOwnerAlert, onBulkProgress } = {}) {
    this.onQr = onQr;
    this.onStatus = onStatus;
    this.onLog = onLog;
    this.onOrderSummary = onOrderSummary;
    this.onOwnerAlert = onOwnerAlert;
    this.onBulkProgress = onBulkProgress;

    this.sock = null;
    this.autoReply = Store.getAutoReply();
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.everConnectedThisRun = false;
    this.connectionState = 'disconnected';
    this.connectedNumber = '';

    this.lastSimpleReplyBySender = new Map();
    this.aiHistoryByJid = new Map();
    this.lastAiReplyTsByJid = new Map();
    this.incomingTimestampsByJid = new Map();
    this.pausedUntilByJid = new Map();
    this.aiRepliesTodayByJid = new Map();
    this.lastOfflineReplyByJid = new Map();
    this.pushNameByJid = new Map();

    const savedHistory = Store.getChatHistory();
    for (const [jid, turns] of Object.entries(savedHistory)) {
      this.aiHistoryByJid.set(jid, turns);
    }
  }

  log(text, type = 'info') {
    this.onLog?.({ text, type, time: new Date().toISOString() });
  }

  getStatus() {
    return {
      status: this.connectionState,
      number: this.connectedNumber,
    };
  }

  async connect() {
    if (this.connecting) return;
    this.connecting = true;
    this.connectionState = 'connecting';
    this.onStatus?.('connecting');
    this.log('Initializing WhatsApp connection engine...', 'info');

    try {
      const baileys = await import('@whiskeysockets/baileys');
      const makeWASocket = baileys.default || baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason } = baileys;

      const authDir = AUTH_FOLDER();
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      const sock = makeWASocket({
        auth: state,
        browser: ['INTERIORS WORD', 'Chrome', app.getVersion()],
        syncFullHistory: false,
        printQRInTerminal: false,
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);
      this.registerMessageHandler(sock);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const dataUrl = await QRCode.toDataURL(qr);
            this.connectionState = 'qr';
            this.onQr?.(dataUrl);
            this.onStatus?.('qr');
            this.log('New pairing QR code generated. Scan with WhatsApp to connect.', 'info');
          } catch (err) {
            this.log(`Failed to render QR code: ${err.message}`, 'error');
          }
        }

        if (connection === 'open') {
          this.connecting = false;
          this.everConnectedThisRun = true;
          this.reconnectAttempts = 0;
          this.connectionState = 'connected';
          const userPhone = (sock.user?.id || '').split(':')[0].split('@')[0];
          this.connectedNumber = userPhone;
          this.onStatus?.('connected', { number: userPhone, name: sock.user?.name || 'INTERIORS WORD' });
          this.log(`WhatsApp connected successfully! Logged in as +${userPhone}`, 'success');
        }

        if (connection === 'close') {
          this.connecting = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const errMsg = lastDisconnect?.error?.message || 'Disconnected';
          const loggedOut = statusCode === DisconnectReason?.loggedOut;

          this.log(`Connection closed (code ${statusCode ?? 'unknown'}): ${errMsg}`, 'warning');

          if (loggedOut && this.everConnectedThisRun) {
            this.connectionState = 'disconnected';
            this.connectedNumber = '';
            this.onStatus?.('disconnected');
            this.log('Session logged out from phone. Please scan QR to reconnect.', 'warning');
            return;
          }

          if (loggedOut && !this.everConnectedThisRun) {
            this.log('Saved auth session expired. Resetting session folder...', 'warning');
            try {
              fs.rmSync(AUTH_FOLDER(), { recursive: true, force: true });
            } catch {}
            this.connectionState = 'reconnecting';
            this.onStatus?.('reconnecting');
            await sleep(1500);
            this.connect();
            return;
          }

          this.connectionState = 'reconnecting';
          this.onStatus?.('reconnecting');
          const delay = Math.min(30000, 2000 * Math.pow(1.5, this.reconnectAttempts || 0));
          this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
          this.log(`Connection dropped. Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`, 'warning');
          await sleep(delay);
          this.connect();
        }
      });
    } catch (err) {
      this.connecting = false;
      this.connectionState = 'error';
      this.log(`WhatsApp startup error: ${err.message}`, 'error');
      this.onStatus?.('reconnecting');
      const delay = Math.min(30000, 3000 * Math.pow(1.5, this.reconnectAttempts || 0));
      this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
      await sleep(delay);
      this.connect();
    }
  }

  registerMessageHandler(sock) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (!msg.key.remoteJid || msg.key.remoteJid.endsWith('@g.us')) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;

        if (msg.pushName) {
          this.pushNameByJid.set(msg.key.remoteJid, msg.pushName);
        }

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        if (!text.trim()) continue;

        const senderPhone = msg.key.remoteJid.split('@')[0];
        this.log(`Incoming message from +${senderPhone}: "${text.slice(0, 70)}"`, 'incoming');

        this.queueIncomingMessage(msg.key.remoteJid, text);
      }
    });
  }

  isWithinWorkingHours() {
    const wh = this.autoReply?.workingHours;
    if (!wh || !wh.enabled) return true;
    const now = new Date();
    const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const start = wh.startTime || '09:00';
    const end = wh.endTime || '21:00';
    if (start <= end) {
      return cur >= start && cur <= end;
    }
    return cur >= start || cur <= end;
  }

  queueIncomingMessage(jid, text) {
    if (!this.autoReply?.enabled) return;

    if (!this.isWithinWorkingHours()) {
      const lastOffline = this.lastOfflineReplyByJid.get(jid) || 0;
      if (Date.now() - lastOffline > 6 * 60 * 60 * 1000) {
        this.lastOfflineReplyByJid.set(jid, Date.now());
        const offlineMsg =
          this.autoReply.workingHours?.offlineMessage ||
          'नमस्ते! फिलहाल दुकान बंद है। हमारी दुकान सुबह 9:00 बजे खुलते ही आपके मैसेज का जवाब दिया जाएगा। धन्यवाद! - INTERIORS WORD 🙏';
        this.sock?.sendMessage(jid, { text: offlineMsg }).catch(() => {});
        this.log(`Outside store hours: sent offline notice to ${jid.split('@')[0]}`, 'info');
      }
      return;
    }

    if (this.autoReply.mode !== 'ai') {
      this.maybeSimpleReply(jid);
    } else {
      this.replyWithAi(jid, text).catch((err) => {
        this.log(`AI reply handler failed: ${err.message}`, 'error');
      });
    }
  }

  async maybeSimpleReply(jid) {
    const lastSent = this.lastSimpleReplyBySender.get(jid) || 0;
    if (Date.now() - lastSent < SIMPLE_REPLY_COOLDOWN_MS) return;

    const replyText = (this.autoReply?.message || '').trim();
    if (!replyText) return;

    try {
      await sleep(1500);
      await this.sock?.sendMessage(jid, { text: replyText });
      this.lastSimpleReplyBySender.set(jid, Date.now());
      this.log(`Sent simple auto-reply to +${jid.split('@')[0]}`, 'success');
    } catch (err) {
      this.log(`Failed to send auto-reply to +${jid.split('@')[0]}: ${err.message}`, 'error');
    }
  }

  async replyWithAi(jid, incomingText) {
    const ai = this.autoReply.ai || {};
    if (!ai.apiKey || !ai.apiKey.trim()) {
      return;
    }

    const now = Date.now();
    const pausedUntil = this.pausedUntilByJid.get(jid) || 0;
    if (now < pausedUntil) return;

    const timestamps = (this.incomingTimestampsByJid.get(jid) || []).filter((t) => now - t < AI_FLOOD_WINDOW_MS);
    timestamps.push(now);
    this.incomingTimestampsByJid.set(jid, timestamps);
    if (timestamps.length > AI_FLOOD_MAX_MESSAGES) {
      this.pausedUntilByJid.set(jid, now + AI_FLOOD_PAUSE_MS);
      this.log(`Flood guard active for ${jid.split('@')[0]}: pausing AI replies for 10 minutes.`, 'warning');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const counter = this.aiRepliesTodayByJid.get(jid);
    if (counter && counter.day === today && counter.count >= (ai.maxRepliesPerContactPerDay || 100)) {
      return;
    }

    try {
      await this.sock?.sendPresenceUpdate('composing', jid);
    } catch {}

    const history = this.aiHistoryByJid.get(jid) || [];
    let replyText = '';
    let ownerAlert = null;

    try {
      const res = await generateReply({
        apiKey: ai.apiKey,
        model: ai.model,
        persona: ai.persona,
        businessInfo: ai.businessInfo,
        menuPricing: ai.menuPricing,
        history,
        incomingText,
      });
      replyText = res.text;
      ownerAlert = res.ownerAlert;
    } catch (err) {
      this.sock?.sendPresenceUpdate('paused', jid).catch(() => {});
      this.log(`AI reply generation failed for ${jid.split('@')[0]}: ${err.message}`, 'error');
      return;
    }

    if (ownerAlert) {
      const phone = jid.replace('@s.whatsapp.net', '');
      const alertObj = {
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        jid,
        phone,
        customerName: this.pushNameByJid.get(jid) || '',
        reason: ownerAlert,
        customerMessage: incomingText,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
      this.onOwnerAlert?.(alertObj);
      this.log(`⚡ Owner attention required from +${phone}: ${ownerAlert}`, 'warning');
    }

    await sleep(600);

    try {
      await this.sock?.sendMessage(jid, { text: replyText });
      this.log(`AI auto-replied to +${jid.split('@')[0]}`, 'success');
    } catch (err) {
      this.log(`Failed to deliver AI reply to ${jid.split('@')[0]}: ${err.message}`, 'error');
      return;
    } finally {
      this.sock?.sendPresenceUpdate('paused', jid).catch(() => {});
    }

    this.lastAiReplyTsByJid.set(jid, Date.now());
    if (counter && counter.day === today) {
      counter.count += 1;
    } else {
      this.aiRepliesTodayByJid.set(jid, { day: today, count: 1 });
    }

    const historyTurns = Math.max(2, ai.historyTurns || 12);
    const updatedHistory = [...history, { role: 'user', content: incomingText }, { role: 'assistant', content: replyText }];
    this.aiHistoryByJid.set(jid, updatedHistory.slice(-historyTurns));
    this.persistChatHistory();

    this.maybeExtractOrder(jid, updatedHistory).catch(() => {});
  }

  persistChatHistory() {
    const obj = {};
    for (const [k, v] of this.aiHistoryByJid.entries()) {
      obj[k] = v;
    }
    Store.saveChatHistory(obj);
  }

  async maybeExtractOrder(jid, history) {
    if (!this.onOrderSummary) return;
    const ai = this.autoReply.ai || {};
    if (!ai.apiKey || !ai.apiKey.trim()) return;
    if (!history || history.length < 2) return;

    const fullText = history.map((h) => h.content).join(' ').toLowerCase();
    const orderKeywords = [
      'order', 'book', 'need', 'want', 'curtain', 'parda', 'wallpaper', 'pvc',
      'sofa', 'fabric', 'foam', 'flooring', 'blinds', 'meter', 'sqft', 'roll',
      'visit', 'measurement', 'naap', 'sample', 'rate', 'price', 'address', 'bhejo', 'chahiye'
    ];
    if (!orderKeywords.some((kw) => fullText.includes(kw))) return;

    try {
      const conversationText = history
        .map((h) => (h.role === 'user' ? 'Customer' : 'Store') + ': ' + h.content)
        .join('\n');

      const parsed = await extractOrderFromConversation({
        apiKey: ai.apiKey,
        model: ai.model,
        conversationText,
      });

      if (!parsed || !parsed.hasOrder) return;

      const phone = jid.split('@')[0];
      const pushName = this.pushNameByJid.get(jid) || '';

      const order = {
        id: `order_${phone}_${Date.now().toString(36)}`,
        jid,
        phone,
        timestamp: new Date().toISOString(),
        summary: parsed.summary || 'Interior Furnishing Inquiry',
        items: parsed.items || [],
        deliveryLocation: parsed.deliveryLocation || '',
        customerName: parsed.customerName || pushName || '',
        specialInstructions: parsed.specialInstructions || '',
        status: 'new',
      };

      this.onOrderSummary(order);
      this.log(`Captured new inquiry/order for +${phone}: "${order.summary}"`, 'success');
    } catch (err) {
      console.warn('Order extraction error:', err.message);
    }
  }

  updateAutoReplySettings(settings) {
    this.autoReply = settings;
  }

  async logout() {
    try {
      await this.sock?.logout();
    } catch {}
    try {
      fs.rmSync(AUTH_FOLDER(), { recursive: true, force: true });
    } catch {}
    this.everConnectedThisRun = false;
    this.connectionState = 'disconnected';
    this.connectedNumber = '';
    this.onStatus?.('disconnected');
    this.log('WhatsApp logged out and session cleared. Click connect to scan a new QR code.', 'info');
  }

  async resetSession() {
    try {
      await this.sock?.logout();
    } catch {}
    try {
      fs.rmSync(AUTH_FOLDER(), { recursive: true, force: true });
    } catch {}
    this.everConnectedThisRun = false;
    this.connecting = false;
    this.log('Session reset. Re-initializing...', 'info');
    setTimeout(() => this.connect(), 500);
  }

  toJid(rawNumber) {
    let digits = String(rawNumber).replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      digits = '91' + digits;
    }
    return `${digits}@s.whatsapp.net`;
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.pdf': 'application/pdf',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.zip': 'application/zip'
    };
    return map[ext] || 'application/octet-stream';
  }

  async sendBulk({ contacts, message, sendAt, attachmentPath, filePath, mediaPath }, onProgress) {
    if (!this.sock) {
      throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    const fileToAttach = attachmentPath || filePath || mediaPath;

    if (sendAt) {
      const delay = new Date(sendAt).getTime() - Date.now();
      if (delay > 0) {
        onProgress?.({ type: 'status', text: `Scheduled to send in ${Math.round(delay / 60000)} minutes...` });
        setTimeout(() => {
          this._executeBulkSend(contacts, message, onProgress, fileToAttach);
        }, delay);
        return { scheduled: true, delay };
      }
    }

    return this._executeBulkSend(contacts, message, onProgress, fileToAttach);
  }

  async _executeBulkSend(contactList, message, onProgress, attachmentPath) {
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const total = contactList.length;

    let fileBuffer = null;
    let mimeType = null;
    let fileName = null;

    if (attachmentPath && fs.existsSync(attachmentPath)) {
      try {
        fileBuffer = fs.readFileSync(attachmentPath);
        mimeType = this.getMimeType(attachmentPath);
        fileName = path.basename(attachmentPath);
      } catch (err) {
        this.log(`Failed to read attachment ${attachmentPath}: ${err.message}`, 'error');
      }
    }

    for (let i = 0; i < contactList.length; i++) {
      const contact = contactList[i];
      const rawNumber = contact.phone || contact.fields?.A || '';
      if (!rawNumber) continue;

      const jid = this.toJid(rawNumber);
      let personalized = message;

      if (contact.fields) {
        for (const [col, val] of Object.entries(contact.fields)) {
          personalized = personalized.replace(new RegExp(`\\{${col}\\}`, 'gi'), val || '');
        }
      }
      personalized = personalized.replace(/\{\{\s*name\s*\}\}/gi, contact.fields?.B || contact.name || '');
      personalized = personalized.replace(/\{\{\s*phone\s*\}\}/gi, rawNumber);
      personalized = personalized.replace(/\{\{\s*amount\s*\}\}/gi, contact.fields?.C || '');

      try {
        const [check] = await this.sock.onWhatsApp(jid);
        if (!check?.exists) {
          skipped++;
          onProgress?.({ type: 'skipped', number: rawNumber, reason: 'Not on WhatsApp', current: i + 1, total });
          continue;
        }

        if (fileBuffer) {
          if (mimeType.startsWith('image/')) {
            await this.sock.sendMessage(check.jid, {
              image: fileBuffer,
              caption: personalized || '',
            });
          } else {
            await this.sock.sendMessage(check.jid, {
              document: fileBuffer,
              mimetype: mimeType,
              fileName: fileName,
              caption: personalized || '',
            });
          }
        } else {
          await this.sock.sendMessage(check.jid, { text: personalized });
        }

        sent++;
        onProgress?.({ type: 'sent', number: rawNumber, current: i + 1, total });
        this.log(`Bulk sent to +${rawNumber} (${i + 1}/${total})`, 'success');
      } catch (err) {
        failed++;
        onProgress?.({ type: 'failed', number: rawNumber, reason: err.message, current: i + 1, total });
        this.log(`Bulk send failed for +${rawNumber}: ${err.message}`, 'error');
      }

      if (i < contactList.length - 1) {
        const waitTime = randomDelay();
        onProgress?.({ type: 'waiting', waitMs: waitTime, current: i + 1, total });
        await sleep(waitTime);
      }
    }

    const summary = { sent, failed, skipped, total };
    onProgress?.({ type: 'done', ...summary });
    this.log(`Bulk campaign completed: ${sent} sent, ${failed} failed, ${skipped} skipped.`, 'success');
    return summary;
  }

  async sendDirectMessage({ to, text, attachmentPath, filePath, mediaPath }) {
    if (!this.sock) throw new Error('WhatsApp is not connected');
    const jid = this.toJid(to);
    const targetFile = attachmentPath || filePath || mediaPath;

    if (targetFile && fs.existsSync(targetFile)) {
      const mimeType = this.getMimeType(targetFile);
      const fileBuffer = fs.readFileSync(targetFile);
      const fileName = path.basename(targetFile);

      if (mimeType.startsWith('image/')) {
        await this.sock.sendMessage(jid, {
          image: fileBuffer,
          caption: text || '',
        });
      } else {
        await this.sock.sendMessage(jid, {
          document: fileBuffer,
          mimetype: mimeType,
          fileName: fileName,
          caption: text || '',
        });
      }
    } else {
      await this.sock.sendMessage(jid, { text });
    }

    this.log(`Direct message sent to +${to}`, 'success');
    return { success: true };
  }

  async confirmOrder(orderId) {
    const order = Store.getOrders().find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    const customerGreeting = order.customerName ? `Namaste ${order.customerName} ji!` : 'Namaste ji!';
    const itemsText = order.items && order.items.length > 0
      ? order.items.map((i) => `${i.quantity || ''} ${i.name || ''}`).join(', ')
      : order.summary;
    const locationText = order.deliveryLocation ? `\n📍 Site/Address: ${order.deliveryLocation}` : '';

    const text = `${customerGreeting} INTERIORS WORD se aapka order/measurement request confirm kar diya gaya hai. ✅\n\n🛋️ Details: ${itemsText}${locationText}\n\nHumari team jald hi aapse coordinate karegi. Dhanyawad! - INTERIORS WORD 🙏`;

    await this.sock?.sendMessage(order.jid, { text });
    Store.updateOrderStatus(orderId, 'confirmed');
    this.log(`Order confirmed for +${order.phone} and notification message sent.`, 'success');
    return { ok: true, status: 'confirmed' };
  }

  async rejectOrder(orderId, reason = '') {
    const order = Store.getOrders().find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    const customerGreeting = order.customerName ? `Namaste ${order.customerName} ji!` : 'Namaste ji!';
    const reasonText = reason ? ` (${reason})` : '';

    const text = `${customerGreeting} Asuvidha ke liye kshama chahte hain, filhal hum aapka yeh request accept nahi kar pa rahe hain${reasonText}. Kisi aur jankari ke liye hume call ya message karein. Dhanyawad! - INTERIORS WORD 🙏`;

    await this.sock?.sendMessage(order.jid, { text });
    Store.updateOrderStatus(orderId, 'rejected');
    this.log(`Order rejected for +${order.phone} and notification sent.`, 'warning');
    return { ok: true, status: 'rejected' };
  }
}

export default WhatsAppService;
