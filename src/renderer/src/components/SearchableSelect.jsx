import React, { useState, useRef, useEffect, useMemo } from 'react'

/**
 * Searchable dropdown — type to filter, click to select.
 * Easier than native <select> for long lists.
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Search...',
  emptyLabel = '-- Select --',
  getOptionLabel = (o) => o.label ?? o.name ?? String(o),
  getOptionValue = (o) => o.value ?? o.id,
  getOptionSub = (o) => o.subtitle ?? o.phone ?? o.brand ?? '',
  className = ''
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  const selected = options.find(o => String(getOptionValue(o)) === String(value))

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(o => {
      const label = getOptionLabel(o).toLowerCase()
      const sub = (getOptionSub(o) || '').toLowerCase()
      return label.includes(q) || sub.includes(q)
    })
  }, [options, query, getOptionLabel, getOptionSub])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(option) {
    onChange(getOptionValue(option))
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        className={`flex items-center w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm cursor-text transition-all
          ${open ? 'border-teal-500 ring-2 ring-teal-500/20 bg-white' : 'border-slate-200 hover:border-slate-300'}`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected ? getOptionLabel(selected) : '')}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selected && !open ? getOptionLabel(selected) : emptyLabel}
          className="flex-1 bg-transparent outline-none text-slate-800 placeholder:text-slate-400 min-w-0"
        />
        {selected && !open && getOptionSub(selected) && (
          <span className="text-xs text-slate-400 ml-2 shrink-0 hidden sm:inline">{getOptionSub(selected)}</span>
        )}
        <svg className={`w-4 h-4 text-slate-400 shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg animate-pop-in">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-400 text-center">No matches found</li>
          ) : filtered.map(option => {
            const optVal = getOptionValue(option)
            const isSelected = String(optVal) === String(value)
            return (
              <li
                key={optVal}
                onClick={() => handleSelect(option)}
                className={`px-3 py-2 cursor-pointer text-sm transition-colors flex justify-between items-center
                  ${isSelected ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span>{getOptionLabel(option)}</span>
                {getOptionSub(option) && (
                  <span className="text-xs text-slate-400 ml-2">{getOptionSub(option)}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
