import React, { useEffect, useRef } from 'react'

/**
 * MiniChart — pure SVG/Canvas bar chart, zero external dependencies.
 *
 * Props:
 *  data:   Array<{ label: string, value: number }>
 *  height: number (default 100)
 *  color:  string hex (default '#0d9488')
 *  title:  string
 */
export default function MiniChart({ data = [], height = 110, color = '#0d9488', title = '' }) {
  const canvasRef = useRef(null)

  const maxVal   = Math.max(...data.map(d => d.value), 1)
  const barCount = data.length || 1

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const W   = canvas.offsetWidth
    const H   = height

    canvas.width  = W * dpr
    canvas.height = H * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const padding   = { top: 8, bottom: 28, left: 6, right: 6 }
    const chartW    = W - padding.left - padding.right
    const chartH    = H - padding.top - padding.bottom
    const barGap    = 4
    const barW      = (chartW - barGap * (barCount - 1)) / barCount

    // Draw bars
    data.forEach((d, i) => {
      const barH = (d.value / maxVal) * chartH
      const x    = padding.left + i * (barW + barGap)
      const y    = padding.top + chartH - barH

      // Bar background (track)
      ctx.fillStyle = 'rgba(203,213,225,0.25)'
      ctx.beginPath()
      ctx.roundRect(x, padding.top, barW, chartH, [3])
      ctx.fill()

      // Bar fill with gradient
      if (d.value > 0) {
        const grad = ctx.createLinearGradient(0, y, 0, padding.top + chartH)
        grad.addColorStop(0, color)
        grad.addColorStop(1, color + '55')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(x, y, barW, barH, barH > 4 ? [3, 3, 0, 0] : [2])
        ctx.fill()
      }

      // Label
      ctx.fillStyle = '#94a3b8'
      ctx.font      = `10px Inter, ui-sans-serif, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(d.label, x + barW / 2, H - 8)
    })

    // Value on tallest bar
    const maxIdx = data.reduce((best, d, i) => d.value > data[best].value ? i : best, 0)
    if (data[maxIdx]?.value > 0) {
      const i    = maxIdx
      const d    = data[i]
      const barH = (d.value / maxVal) * chartH
      const x    = padding.left + i * (barW + barGap) + barW / 2
      const y    = padding.top + chartH - barH - 4

      ctx.fillStyle = color
      ctx.font      = `bold 10px Inter, ui-sans-serif, sans-serif`
      ctx.textAlign = 'center'
      const label = d.value >= 100000
        ? `₹${(d.value / 100000).toFixed(1)}L`
        : d.value >= 1000
        ? `₹${(d.value / 1000).toFixed(0)}K`
        : `₹${d.value}`
      ctx.fillText(label, x, y)
    }
  }, [data, height, color, barCount, maxVal])

  if (data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl"
        style={{ height, border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}
      >
        <svg className="w-6 h-6 mb-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-xs">No data yet</span>
      </div>
    )
  }

  return (
    <div className="w-full">
      {title && (
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{title}</p>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, display: 'block' }}
      />
    </div>
  )
}
