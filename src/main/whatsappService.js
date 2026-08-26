'use strict';

import { shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Open the generated PDF in Explorer, copy it to clipboard, launch WhatsApp Desktop,
 * and automatically paste & send the PDF file.
 *
 * @param {string} pdfPath  - Absolute path to the PDF file
 * @param {string} phoneNumber - 10-digit Indian mobile number
 */
async function sendToWhatsApp(pdfPath, phoneNumber) {
  // Sanitize phone: keep only digits
  const digits = String(phoneNumber).replace(/\D/g, '');

  // Ensure it's 10 digits – take the last 10 if longer (e.g. 91xxxxxxxxxx)
  const phone10 = digits.length > 10 ? digits.slice(-10) : digits;

  if (phone10.length !== 10) {
    throw new Error(`Invalid phone number: expected 10 digits, got "${phoneNumber}"`);
  }

  // Show the PDF file in File Explorer (selected)
  shell.showItemInFolder(pdfPath);

  // 1. Copy the bill PDF file to Windows clipboard so it can be pasted into WhatsApp
  const psCopy = `powershell -NoProfile -Command "Set-Clipboard -Path '${pdfPath.replace(/'/g, "''")}'"`;
  try {
    await execAsync(psCopy);
  } catch (e) {
    console.error('Failed to copy file to clipboard:', e);
  }

  // 2. Open WhatsApp Desktop app with the number pre-filled
  const desktopUrl = `whatsapp://send?phone=91${phone10}`;
  try {
    await shell.openExternal(desktopUrl);
    // 3. Automatically paste (Ctrl+V) and send (Enter) after 3 seconds in WhatsApp Desktop
    const psPasteSend = `powershell -NoProfile -Command "Start-Sleep -Seconds 3; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 2500; [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')"`;
    exec(psPasteSend, (err) => {
      if (err) console.error('Auto-paste failed:', err);
    });
  } catch (err) {
    // Fallback to WhatsApp Web if Desktop app is not installed
    const waUrl = `https://web.whatsapp.com/send?phone=91${phone10}`;
    await shell.openExternal(waUrl);
  }

  return { success: true, phone: `91${phone10}` };
}

export { sendToWhatsApp };
