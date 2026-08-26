import { RECOMMENDED_CATEGORIES, CALCULATOR_CATEGORIES } from '@shared/recommendedCategories.js'

export const CATEGORIES = Object.fromEntries(
  RECOMMENDED_CATEGORIES.map((cat) => [cat.value, cat])
)

export { CALCULATOR_CATEGORIES }

export const GST_RATES = [5, 12, 18, 28]

export const STATE_CODES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Ladakh'
}

export const UNITS = ['pcs', 'roll', 'yard', 'meter', 'sqft', 'box', 'set']

export const FULLNESS_RATIOS = [
  { value: 1.5, label: '1.5x — Minimal' },
  { value: 2, label: '2x — Standard' },
  { value: 2.5, label: '2.5x — Generous' },
  { value: 3, label: '3x — Very Full' }
]

export const VOUCHER_TYPES = {
  SALES: 'sales',
  PURCHASE: 'purchase'
}

export const LEDGER_TYPES = {
  CUSTOMER: 'customer',
  VENDOR: 'vendor'
}
