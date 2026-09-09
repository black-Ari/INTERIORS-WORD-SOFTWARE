import https from 'https';

const MAX_TOKENS = 1024;

const PROVIDER_NAMES = {
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  openai: 'OpenAI (GPT)',
  unknown: 'Unrecognized key format',
};

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
};

const GEMINI_FALLBACKS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

function extractOwnerAlert(rawText) {
  if (!rawText) return null;
  const match = rawText.match(/\[(?:OWNER_ALERT|OWNER_ACTION_REQUIRED):\s*([^\]]+)\]/i);
  return match ? match[1].trim() : null;
}

function cleanReply(rawText) {
  if (!rawText) return '';
  let text = rawText.trim();
  text = text.replace(/^(?:\*{1,2}|#+)?\s*(?:Constraint Check|Thinking|Reasoning|Thought Process|Internal|Note|Reply|Message|WhatsApp Reply):.*?(?:\n+|$)/gis, '');
  text = text.replace(/^[:*#\-\s\t]+/g, '');
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  if (text.startsWith('"') && !text.slice(1).includes('"')) {
    text = text.slice(1).trim();
  }
  text = text.replace(/^[*•\-]\s*/gm, '');
  text = text.replace(/\[(?:OWNER_ALERT|OWNER_ACTION_REQUIRED):\s*[^\]]+\]/gi, '');
  return text.trim();
}

function sanitizeApiKey(raw) {
  let key = (raw || '').trim();
  key = key.replace(/^['"`]+|['"`]+$/g, '');
  key = key.replace(/[\s\u200B-\u200D\uFEFF]+/g, '');
  return key;
}

function detectProvider(apiKey) {
  const key = sanitizeApiKey(apiKey);
  if (!key) return null;
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('AIza') || key.startsWith('AQ.')) return 'google';
  if (key.startsWith('sk-')) return 'openai';
  return 'unknown';
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON from AI provider: ${data.slice(0, 200)}`));
          }
        } else {
          let errDetail = data;
          try {
            const parsed = JSON.parse(data);
            errDetail = parsed.error?.message || parsed.message || data;
          } catch {}
          reject(new Error(`AI provider error (${res.statusCode}): ${errDetail}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('AI request timed out after 30 seconds'));
    });

    if (body) req.write(body);
    req.end();
  });
}

async function callAnthropic({ apiKey, model, system, messages }) {
  const body = JSON.stringify({
    model: model || DEFAULT_MODELS.anthropic,
    max_tokens: MAX_TOKENS,
    system,
    messages,
  });

  const res = await httpsRequest(
    {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    },
    body
  );

  const textBlock = res.content?.find((c) => c.type === 'text');
  return textBlock?.text || '';
}

async function callGemini({ apiKey, model, system, messages }) {
  const modelsToTry = model ? [model] : GEMINI_FALLBACKS;
  let lastErr = null;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const payload = {
    contents,
    generationConfig: { maxOutputTokens: MAX_TOKENS },
  };
  if (system) {
    payload.systemInstruction = { parts: [{ text: system }] };
  }
  const body = JSON.stringify(payload);

  for (const candidateModel of modelsToTry) {
    try {
      const res = await httpsRequest(
        {
          hostname: 'generativelanguage.googleapis.com',
          path: `/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        body
      );
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      lastErr = err;
      if (!model && (err.message.includes('404') || err.message.includes('not found') || err.message.includes('unsupported'))) {
        continue;
      }
      throw err;
    }
  }

  throw lastErr || new Error('All Gemini model fallbacks failed');
}

async function callOpenAI({ apiKey, model, system, messages }) {
  const chatMessages = [];
  if (system) chatMessages.push({ role: 'system', content: system });
  for (const m of messages) {
    chatMessages.push({ role: m.role, content: m.content });
  }

  const body = JSON.stringify({
    model: model || DEFAULT_MODELS.openai,
    max_tokens: MAX_TOKENS,
    messages: chatMessages,
  });

  const res = await httpsRequest(
    {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    },
    body
  );

  return res.choices?.[0]?.message?.content || '';
}

function buildSystemPrompt({ persona, businessInfo, menuPricing }) {
  const parts = [
    `You are the official WhatsApp assistant for "INTERIORS WORD", a premium interior decor and home furnishing store.`,
    `You are chatting with a customer on WhatsApp. Reply directly as the store in a warm, polite, and helpful tone (Hindi, Hinglish, or English depending on how the customer speaks).`,
    `Keep replies concise, clear, and easy to read on a mobile phone screen.`,
    `If a customer asks about prices, quote accurately based on the Rate Card below.`,
    `If a customer wants a quotation or measurement, offer to book a site measurement visit.`,
    `If a customer asks for a discount larger than 10%, asks to cancel an in-progress custom curtain order, or requests unlisted services, include [OWNER_ALERT: <brief reason>] at the very end of your reply so the store owner can intervene.`,
  ];

  if (persona) {
    parts.push(`STORE PERSONA & VOICE:\n${persona}`);
  }
  if (businessInfo) {
    parts.push(`BUSINESS DETAILS & WORKING INFO:\n${businessInfo}`);
  }
  if (menuPricing) {
    parts.push(`INTERIORS RATE CARD & PRICING:\n${menuPricing}`);
  }

  return parts.join('\n\n');
}

async function generateReply({ apiKey, model, persona, businessInfo, menuPricing, history, incomingText }) {
  const cleanKey = sanitizeApiKey(apiKey);
  const provider = detectProvider(cleanKey);

  if (!provider || provider === 'unknown') {
    throw new Error('Please enter a valid Anthropic, Google Gemini, or OpenAI API key.');
  }

  const system = buildSystemPrompt({ persona, businessInfo, menuPricing });
  const messages = [...(history || []), { role: 'user', content: incomingText }];

  let raw = '';
  if (provider === 'anthropic') {
    raw = await callAnthropic({ apiKey: cleanKey, model, system, messages });
  } else if (provider === 'google') {
    raw = await callGemini({ apiKey: cleanKey, model, system, messages });
  } else if (provider === 'openai') {
    raw = await callOpenAI({ apiKey: cleanKey, model, system, messages });
  }

  const ownerAlert = extractOwnerAlert(raw);
  const text = cleanReply(raw);

  return { text, ownerAlert };
}

async function extractOrderFromConversation({ apiKey, model, conversationText }) {
  const cleanKey = sanitizeApiKey(apiKey);
  const provider = detectProvider(cleanKey);
  if (!provider || provider === 'unknown') return null;

  const system = `You analyze WhatsApp conversations between customers and "INTERIORS WORD" (interior decoration store).
Determine if the customer has placed an order or requested a site visit/measurement.
Output STRICT JSON ONLY:
{
  "hasOrder": true/false,
  "summary": "Short 1-line description of items/order/site visit",
  "items": [{"name": "Curtains/Wallpaper/Blinds", "quantity": "e.g. 4 panels / 2 rolls", "rate": "e.g. 1200"}],
  "deliveryLocation": "City/Area/Site address if mentioned",
  "customerName": "Name if mentioned",
  "specialInstructions": "Any color, fabric, or date notes"
}`;

  const messages = [{ role: 'user', content: `Conversation:\n${conversationText}` }];

  let raw = '';
  try {
    if (provider === 'anthropic') {
      raw = await callAnthropic({ apiKey: cleanKey, model, system, messages });
    } else if (provider === 'google') {
      raw = await callGemini({ apiKey: cleanKey, model, system, messages });
    } else if (provider === 'openai') {
      raw = await callOpenAI({ apiKey: cleanKey, model, system, messages });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('Failed to extract order JSON:', err.message);
  }
  return null;
}

export {
  detectProvider,
  sanitizeApiKey,
  generateReply,
  extractOrderFromConversation,
  PROVIDER_NAMES,
  DEFAULT_MODELS,
};
