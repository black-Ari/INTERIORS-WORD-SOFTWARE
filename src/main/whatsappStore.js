import fs from 'fs';
import path from 'path';
import { app, safeStorage } from 'electron';

function getStorePath() {
  return path.join(app.getPath('userData'), 'iw_whatsapp_store.json');
}

function getHistoryPath() {
  return path.join(app.getPath('userData'), 'iw_whatsapp_chat_history.json');
}

function encryptApiKey(key) {
  if (!key) return '';
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      return 'enc:' + safeStorage.encryptString(key).toString('base64');
    } catch {
      return key;
    }
  }
  return key;
}

function decryptApiKey(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.startsWith('enc:')) {
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      try {
        const buf = Buffer.from(val.slice(4), 'base64');
        return safeStorage.decryptString(buf);
      } catch {
        return '';
      }
    }
  }
  return val;
}

function readStore() {
  try {
    if (fs.existsSync(getStorePath())) {
      return JSON.parse(fs.readFileSync(getStorePath(), 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to read WhatsApp store:', err);
  }
  return {};
}

function writeStore(data) {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write WhatsApp store:', err);
  }
}

const DEFAULT_WORKING_HOURS = {
  enabled: false,
  startTime: '09:00',
  endTime: '21:00',
  offlineMessage: 'नमस्ते! फिलहाल दुकान बंद है। हमारी दुकान सुबह 9:00 बजे खुलते ही आपके मैसेज का जवाब दिया जाएगा। धन्यवाद! - INTERIORS WORD 🙏',
};

const DEFAULT_AUTO_REPLY = {
  enabled: false,
  mode: 'simple',
  message: 'नमस्ते! INTERIORS WORD में संपर्क करने के लिए धन्यवाद। हम आपकी इंटीरियर डेकोरेशन, कर्टन्स, वॉलपेपर और फ़्लोरिंग की ज़रूरतों में कैसे मदद कर सकते हैं? हम जल्द ही आपसे संपर्क करेंगे।',
  workingHours: DEFAULT_WORKING_HOURS,
  ai: {
    apiKey: '',
    model: '',
    persona: "You are the virtual manager of 'INTERIORS WORD', a premier interior decor and home furnishing store. You assist customers politely and professionally in Hindi/English with curtains, designer wallpapers, roller & zebra blinds, PVC wall panels, wooden flooring, and sofa upholstery. Provide approximate rates and invite customers to schedule a site measurement visit.",
    businessInfo: 'INTERIORS WORD - Complete Interior Furnishing Solutions. We offer on-site measurement, design catalog consultation, and professional installation. Store hours: 10am - 8:30pm.',
    menuPricing: `1. Designer Wallpaper: Rs 850 - 2,200 per roll (covers 57 sq.ft)
2. Premium Curtain Fabrics: Rs 450 - 1,400 per meter
3. Roller & Zebra Blinds: Rs 65 - 120 per sq.ft
4. PVC Wall Panels & Fluted Panels: Rs 75 - 110 per sq.ft
5. Wooden / SPC Flooring: Rs 95 - 180 per sq.ft
6. Sofa Upholstery Fabric: Rs 550 - 1,600 per meter`,
    historyTurns: 12,
    maxRepliesPerContactPerDay: 100,
  },
};

const WhatsAppStore = {
  getAutoReply() {
    const all = readStore();
    const saved = all.autoReply || {};
    const res = {
      ...DEFAULT_AUTO_REPLY,
      ...saved,
      workingHours: {
        ...DEFAULT_WORKING_HOURS,
        ...(saved.workingHours || {}),
      },
      ai: {
        ...DEFAULT_AUTO_REPLY.ai,
        ...(saved.ai || {}),
      },
    };
    res.ai.apiKey = decryptApiKey(res.ai.apiKey);
    return res;
  },

  saveAutoReply(settings) {
    const all = readStore();
    const toSave = {
      ...settings,
      ai: {
        ...(settings.ai || {}),
        apiKey: encryptApiKey(settings.ai?.apiKey || ''),
      },
    };
    all.autoReply = toSave;
    writeStore(all);
    return WhatsAppStore.getAutoReply();
  },

  getOrders() {
    const all = readStore();
    return all.orders || [];
  },

  saveOrder(order) {
    const all = readStore();
    const orders = all.orders || [];
    const idx = orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...order };
    } else {
      orders.unshift(order);
    }
    all.orders = orders.slice(0, 500);
    writeStore(all);
  },

  updateOrderStatus(orderId, status) {
    const all = readStore();
    const orders = all.orders || [];
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      writeStore(all);
      return order;
    }
    return null;
  },

  deleteOrder(orderId) {
    const all = readStore();
    all.orders = (all.orders || []).filter((o) => o.id !== orderId);
    writeStore(all);
  },

  getAlerts() {
    const all = readStore();
    return (all.alerts || []).filter((a) => a.status === 'pending');
  },

  saveAlert(alert) {
    const all = readStore();
    const alerts = all.alerts || [];
    alerts.unshift(alert);
    all.alerts = alerts.slice(0, 100);
    writeStore(all);
  },

  dismissAlert(alertId) {
    const all = readStore();
    const alerts = all.alerts || [];
    const a = alerts.find((x) => x.id === alertId);
    if (a) {
      a.status = 'dismissed';
      writeStore(all);
    }
  },

  getChatHistory() {
    try {
      if (fs.existsSync(getHistoryPath())) {
        return JSON.parse(fs.readFileSync(getHistoryPath(), 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return {};
  },

  saveChatHistory(historyMap) {
    try {
      fs.writeFileSync(getHistoryPath(), JSON.stringify(historyMap, null, 2), 'utf-8');
    } catch {
      // Ignore
    }
  }
};

export default WhatsAppStore;
