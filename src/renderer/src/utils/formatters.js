/**
 * Format a number as Indian Rupee currency: ₹1,23,456.00
 * Uses the Indian numbering system (lakhs, crores)
 */
export function formatCurrency(num) {
  if (num === null || num === undefined || isNaN(num)) return '₹0.00'
  const n = Number(num)
  const isNegative = n < 0
  const abs = Math.abs(n)
  const [intPart, decPart] = abs.toFixed(2).split('.')

  // Indian grouping: last 3 digits, then groups of 2
  let result = ''
  const len = intPart.length
  if (len <= 3) {
    result = intPart
  } else {
    result = intPart.slice(-3)
    let remaining = intPart.slice(0, -3)
    while (remaining.length > 2) {
      result = remaining.slice(-2) + ',' + result
      remaining = remaining.slice(0, -2)
    }
    if (remaining.length > 0) {
      result = remaining + ',' + result
    }
  }

  return `${isNegative ? '-' : ''}₹${result}.${decPart}`
}

/**
 * Format a date string to '07 Jun 2026'
 */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(d.getDate()).padStart(2, '0')
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Format a date string to '07 Jun 2026, 5:30 PM'
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const datePart = formatDate(dateStr)
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  if (hours === 0) hours = 12
  return `${datePart}, ${hours}:${minutes} ${ampm}`
}

/**
 * Convert number to Indian English words.
 * Handles up to 99,99,99,999 (99 crore+)
 * e.g. 12500 → "Twelve Thousand Five Hundred"
 */
export function numberToWords(num) {
  if (num === 0) return 'Zero'
  if (num === null || num === undefined || isNaN(num)) return ''

  const n = Math.abs(Math.floor(Number(num)))

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ]
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ]

  function twoDigits(n) {
    if (n < 20) return ones[n]
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '')
  }

  function threeDigits(n) {
    if (n === 0) return ''
    const h = Math.floor(n / 100)
    const rest = n % 100
    let s = ''
    if (h > 0) s += ones[h] + ' Hundred'
    if (rest > 0) s += (h > 0 ? ' ' : '') + twoDigits(rest)
    return s
  }

  if (n === 0) return 'Zero'

  let remaining = n
  const parts = []

  // Crores (1,00,00,000)
  const crore = Math.floor(remaining / 10000000)
  if (crore > 0) {
    parts.push(twoDigits(crore) + ' Crore')
    remaining %= 10000000
  }

  // Lakhs (1,00,000)
  const lakh = Math.floor(remaining / 100000)
  if (lakh > 0) {
    parts.push(twoDigits(lakh) + ' Lakh')
    remaining %= 100000
  }

  // Thousands (1,000)
  const thousand = Math.floor(remaining / 1000)
  if (thousand > 0) {
    parts.push(twoDigits(thousand) + ' Thousand')
    remaining %= 1000
  }

  // Hundreds and below
  if (remaining > 0) {
    parts.push(threeDigits(remaining))
  }

  let result = parts.join(' ')
  if (Number(num) < 0) result = 'Minus ' + result

  // Add paise if decimal
  const decimal = Number(num) - Math.floor(Number(num))
  if (decimal > 0.001) {
    const paise = Math.round(decimal * 100)
    result += ' and ' + twoDigits(paise) + ' Paise'
  }

  return result + ' Only'
}
