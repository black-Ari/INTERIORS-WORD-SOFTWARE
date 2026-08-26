import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleFocusSearch() {
      inputRef.current?.focus();
      setIsOpen(true);
    }
    window.addEventListener('app:focus-search', handleFocusSearch);
    return () => window.removeEventListener('app:focus-search', handleFocusSearch);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const res = await window.api.globalSearch(query);
          setResults(res || []);
          setIsOpen(true);
        } catch (e) {
          console.error("Search failed", e);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  function handleSelect(item) {
    setIsOpen(false);
    setQuery('');
    
    if (item.category === 'vouchers') {
      if (item.type === 'sales') {
        navigate(`/sales-invoice?id=${item.id}`);
      } else {
        navigate(`/purchase-entry?id=${item.id}`);
      }
    } else if (item.category === 'ledgers') {
      navigate('/ledgers');
    } else if (item.category === 'items') {
      navigate('/items');
    }
  }

  return (
    <div ref={wrapperRef} className="relative flex items-center">
      <div className={`flex items-center transition-all duration-300 ${isOpen || query ? 'w-64' : 'w-48'} bg-slate-100 rounded-full border border-slate-200 px-3 py-1.5 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 focus-within:bg-white shadow-inner`}>
        <svg className="w-4 h-4 text-slate-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder="Search everything... (Ctrl+K)"
          className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
        />
        {loading && <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin ml-2" />}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-pop-in">
          <div className="p-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search Results</span>
            <span className="text-xs text-slate-400">{results.length} found</span>
          </div>
          <ul className="max-h-80 overflow-y-auto p-2 space-y-1">
            {results.map((r, idx) => (
              <li 
                key={`${r.category}-${r.id}-${idx}`}
                onClick={() => handleSelect(r)}
                className="p-2 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors group flex items-start gap-3 animate-slide-in-up"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={`mt-0.5 p-1.5 rounded-md ${
                  r.type === 'Ledger' ? 'bg-blue-100 text-blue-600' : 
                  r.type === 'Item' ? 'bg-amber-100 text-amber-600' :
                  r.category === 'vouchers' && r.type === 'sales' ? 'bg-green-100 text-green-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {r.type === 'Ledger' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                  {r.type === 'Item' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                  {r.category === 'vouchers' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-teal-700">{r.title}</p>
                  <p className="text-xs text-slate-500">{r.type} {r.subtitle ? `• ${r.subtitle}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
