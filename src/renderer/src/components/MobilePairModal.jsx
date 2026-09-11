import React, { useState, useEffect } from 'react';

export default function MobilePairModal({ isOpen, onClose }) {
  const [pairingInfo, setPairingInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      window.api?.getMobilePairingInfo?.()
        .then((info) => {
          setPairingInfo(info);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to get mobile pairing info:', err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (pairingInfo?.serverUrl) {
      navigator.clipboard.writeText(pairingInfo.serverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        style={{ color: 'var(--text-primary)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Connect Mobile App</h3>
              <p className="text-blue-200 text-xs mt-0.5">Two-way live billing & sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          {loading ? (
            <div className="py-12 flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-xs text-slate-500">Generating pairing QR Code...</p>
            </div>
          ) : pairingInfo?.qrDataUri ? (
            <>
              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-xl shadow-md border-2 border-dashed border-blue-400 mb-4 inline-block">
                <img
                  src={pairingInfo.qrDataUri}
                  alt="Pairing QR Code"
                  className="w-48 h-48 block"
                />
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  PC Server Ready
                </span>
                <span className="text-xs text-slate-500">
                  Port: <strong>{pairingInfo.port}</strong>
                </span>
              </div>

              {/* IP / URL Copy Box */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex items-center justify-between mb-4">
                <div className="text-left overflow-hidden mr-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Server IP Address</div>
                  <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 truncate">
                    {pairingInfo.serverUrl}
                  </div>
                </div>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors shrink-0"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              {/* Step Instructions */}
              <div className="w-full text-left bg-blue-50/70 dark:bg-blue-950/40 rounded-xl p-3.5 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                <div className="font-bold text-blue-900 dark:text-blue-300 mb-1">How to connect in 3 steps:</div>
                <div>1. Make sure your Phone and PC are on the <strong>same Wi-Fi</strong>.</div>
                <div>2. Open <strong>INTERIORS WORD Mobile App</strong> on your phone.</div>
                <div>3. Go to <strong>Sync PC</strong> tab and enter IP <strong>{pairingInfo.ip}:{pairingInfo.port}</strong> (or scan).</div>
              </div>
            </>
          ) : (
            <div className="py-8 text-sm text-red-500">
              Could not generate local network pairing details. Please ensure Wi-Fi is connected.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

