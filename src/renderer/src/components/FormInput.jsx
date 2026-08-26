import React from 'react'

/**
 * Styled form input with dark theme, amber focus ring, prefix/suffix support, and error state.
 *
 * Props:
 *  - label: string
 *  - type: string (default 'text')
 *  - value: string | number
 *  - onChange: (e) => void
 *  - placeholder: string
 *  - required: boolean
 *  - error: string (error message)
 *  - suffix: string (e.g. 'cm', 'sqft')
 *  - prefix: string (e.g. '₹')
 *  - disabled: boolean
 *  - className: string
 *  - inputRef: ref
 *  - ...rest: passed to <input>
 */
export default function FormInput({
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder = '',
  required = false,
  error,
  suffix,
  prefix,
  disabled = false,
  className = '',
  inputRef,
  name,
  min,
  max,
  step,
  autoFocus,
  onKeyDown,
  id
}) {
  const inputId = id || name || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={`${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-stretch">
        {/* Prefix */}
        {prefix && (
          <span className="inline-flex items-center px-2.5 rounded-l-md border border-r-0
                           border-slate-300 bg-slate-50 text-slate-500 text-sm font-medium">
            {prefix}
          </span>
        )}

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          min={min}
          max={max}
          step={step}
          className={`
            w-full px-3 py-2 text-sm text-slate-900 placeholder-slate-400
            bg-white border border-slate-300
            ${prefix ? 'rounded-l-none' : 'rounded-l-md'}
            ${suffix ? 'rounded-r-none' : 'rounded-r-md'}
            ${error ? '!border-red-500/60 !shadow-[0_0_0_1px_rgba(239,68,68,0.3)]' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
            focus:border-teal-500 focus:shadow-[0_0_0_2px_rgba(13,148,136,0.2)]
            transition-all duration-150
          `}
        />

        {/* Suffix */}
        {suffix && (
          <span className="inline-flex items-center px-2.5 rounded-r-md border border-l-0
                           border-slate-300 bg-slate-50 text-slate-500 text-sm">
            {suffix}
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
