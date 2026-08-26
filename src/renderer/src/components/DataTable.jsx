import React, { useRef, useEffect, useCallback, useState } from 'react'

/**
 * Keyboard-navigable data table with Tally-style density.
 *
 * Props:
 *  - columns: Array<{ key: string, label: string, width?: string, align?: 'left'|'center'|'right', render?: (value, row, index) => ReactNode }>
 *  - data: Array<Object>
 *  - onRowClick?: (row, index) => void
 *  - onRowDoubleClick?: (row, index) => void
 *  - selectedRow?: number (index)
 *  - emptyMessage?: string
 *  - maxHeight?: string
 */
export default function DataTable({
  columns = [],
  data = [],
  onRowClick,
  onRowDoubleClick,
  selectedRow: externalSelected,
  emptyMessage = 'No records found',
  maxHeight = '400px'
}) {
  const [internalSelected, setInternalSelected] = useState(-1)
  const tbodyRef = useRef(null)
  const selected = externalSelected !== undefined ? externalSelected : internalSelected

  const alignClass = (align) => {
    if (align === 'right') return 'text-right'
    if (align === 'center') return 'text-center'
    return 'text-left'
  }

  const handleKeyDown = useCallback(
    (e) => {
      if (data.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min((selected < 0 ? -1 : selected) + 1, data.length - 1)
        setInternalSelected(next)
        onRowClick?.(data[next], next)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = Math.max((selected < 0 ? 1 : selected) - 1, 0)
        setInternalSelected(prev)
        onRowClick?.(data[prev], prev)
      } else if (e.key === 'Enter' && selected >= 0) {
        e.preventDefault()
        onRowDoubleClick?.(data[selected], selected)
      }
    },
    [data, selected, onRowClick, onRowDoubleClick]
  )

  // Scroll selected row into view
  useEffect(() => {
    if (selected >= 0 && tbodyRef.current) {
      const rows = tbodyRef.current.querySelectorAll('tr')
      rows[selected]?.scrollIntoView({ block: 'nearest' })
    }
  }, [selected])

  return (
    <div
      className="glass-panel-sm overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          {/* Sticky Header */}
          <thead>
            <tr className="bg-slate-100/90 sticky top-0 z-10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider
                              border-b border-slate-200 ${alignClass(col.align)}`}
                  style={col.width ? { width: col.width, minWidth: col.width } : {}}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-500 text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  style={{ animationDelay: `${Math.min(rowIndex * 30, 400)}ms` }}
                  className={`
                    animate-slide-in-up data-table-row cursor-pointer border-b border-slate-100
                    ${rowIndex % 2 === 1 ? 'bg-slate-50/50' : ''}
                    ${selected === rowIndex ? 'selected !bg-teal-50 !border-l-2 !border-l-teal-500' : ''}
                  `}
                  onClick={() => {
                    setInternalSelected(rowIndex)
                    onRowClick?.(row, rowIndex)
                  }}
                  onDoubleClick={() => onRowDoubleClick?.(row, rowIndex)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-1.5 text-[13px] text-slate-700 ${alignClass(col.align)}`}
                    >
                      {col.render
                        ? col.render(row[col.key], row, rowIndex)
                        : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer status */}
      {data.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {data.length} record{data.length !== 1 ? 's' : ''}
          </span>
          {selected >= 0 && (
            <span className="text-[11px] text-slate-500">
              Row {selected + 1} of {data.length}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
