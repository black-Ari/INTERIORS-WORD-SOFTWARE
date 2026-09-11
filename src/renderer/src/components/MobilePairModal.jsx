import React, { useState, useEffect } from 'react';

export default function MobilePairModal({ isOpen, onClose }) {
  const [cloudConfig, setCloudConfig] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      window.api?.getCloudConfig?.()
        .then((cConfig) => {
          setCloudConfig(cConfig);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load cloud config:', err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    setSyncMsg('Generating new unique sync code...');
    try {
      const res = await window.api?.regenerateSyncCodeCloud?.();
      if (res?.success) {
        setSyncMsg('✅ Naya Unique Sync Code generate ho gaya!');
        const updated = await window.api?.getCloudConfig?.();
        setCloudConfig(updated);
      } else {
        setSyncMsg('❌ ' + (res?.error || 'Failed to regenerate code'));
      }
    } catch (err) {
      setSyncMsg('❌ ' + err.message);
    } finally {
      setRegenerating(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  const syncCode = cloudConfig?.syncId || 'Loading...';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(syncCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCloudSyncNow = async () => {
    setSyncingCloud(true);
    setSyncMsg('');
    try {
      const res = await window.api?.syncNowCloud?.();
      if (res?.success) {
        setSyncMsg('✅ ' + (res.message || 'Data uploaded to Cloud successfully!'));
        const updated = await window.api?.getCloudConfig?.();
        setCloudConfig(updated);
      } else {
        setSyncMsg('❌ ' + (res?.error || res?.message || 'Sync failed'));
      }
    } catch (err) {
      setSyncMsg('❌ ' + err.message);
    } finally {
      setSyncingCloud(false);
      setTimeout(() => setSyncMsg(''), 4000);
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
              <p className="text-blue-200 text-xs mt-0.5">24/7 Cloud Sync (4G / 5G / Internet)</p>
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
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-xs text-slate-500">Loading cloud sync details...</p>
            </div>
          ) : (
            <>
              {/* Status Badge */}
              <div className="w-full flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    Google Firebase Cloud
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Active 24/7
                </span>
              </div>

              {/* Business Sync Code Card - Guaranteed High Contrast */}
              <div className="w-full bg-slate-950 rounded-2xl p-4 border-2 border-blue-500 text-center shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1.5">
                    <span>🔑</span> Unique Sync Code
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-700">
                    🔒 HID Hardware Bound
                  </span>
                </div>

                {/* Inner Glow Display Box */}
                <div className="bg-slate-900 border border-slate-700/80 rounded-xl py-3 px-3 my-2.5 shadow-inner flex items-center justify-center">
                  <span
                    className="text-3xl font-mono font-black tracking-widest select-all"
                    style={{ color: '#34d399', textShadow: '0 0 12px rgba(52, 211, 153, 0.45)' }}
                  >
                    {syncCode}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1">
                  Enter this code in your phone to connect your shop
                </p>
                <div className="flex items-center justify-center gap-2 mt-2.5">
                  <button
                    onClick={handleCopyCode}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    {codeCopied ? '✓ Code Copied' : '📋 Copy Code'}
                  </button>
                  <button
                    onClick={handleRegenerateCode}
                    disabled={regenerating}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                    title="Generate a brand new random unguessable code"
                  >
                    {regenerating ? 'Generating...' : '🔄 New Code'}
                  </button>
                </div>
              </div>

              {/* Sync Now Button */}
              <div className="w-full">
                <button
                  onClick={handleCloudSyncNow}
                  disabled={syncingCloud}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {syncingCloud ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading PC Data to Cloud...</span>
                    </>
                  ) : (
                    <>
                      <span>☁️</span>
                      <span>Sync Now (Upload PC Data to Cloud)</span>
                    </>
                  )}
                </button>
                {syncMsg && (
                  <div className="text-xs text-center font-bold mt-2 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200">
                    {syncMsg}
                  </div>
                )}
                {cloudConfig?.lastSyncedAt && !syncMsg && (
                  <div className="text-[10px] text-slate-400 mt-1.5">
                    Last Synced: {new Date(cloudConfig.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Step Instructions */}
              <div className="w-full text-left bg-blue-50/70 dark:bg-blue-950/40 rounded-xl p-3.5 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                <div className="font-bold text-blue-900 dark:text-blue-300 mb-1">
                  How any user can connect their Mobile App:
                </div>
                <div>1. Open <strong>INTERIORS WORD Mobile App</strong> on your phone.</div>
                <div>2. Go to <strong>Sync</strong> tab, enter your Sync Code: <strong className="font-mono text-emerald-500 dark:text-emerald-400 font-bold tracking-wider">{syncCode}</strong>.</div>
                <div>3. Tap <strong>Connect to Business</strong> — Done! Live 4G/5G billing starts immediately.</div>
              </div>
            </>
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
