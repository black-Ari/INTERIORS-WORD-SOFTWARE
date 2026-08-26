/**
 * Recommended interior-decoration product categories (systems).
 * Seeded into the database on startup — missing entries are added automatically.
 */

export const RECOMMENDED_CATEGORIES = [
  { value: 'wallpaper', label: 'Wallpaper', hsn: '4814', gstRate: 18, defaultUnit: 'roll', icon: '🎨' },
  { value: 'curtain', label: 'Curtain', hsn: '6303', gstRate: 5, defaultUnit: 'meter', icon: '🪟' },
  { value: 'pvc_plank', label: 'PVC Plank', hsn: '3918', gstRate: 18, defaultUnit: 'box', icon: '🏗️' },
  { value: 'blinds', label: 'Blinds', hsn: '6303', gstRate: 12, defaultUnit: 'sqft', icon: '🪟' },
  { value: 'zebra_blinds', label: 'Zebra Blinds', hsn: '6303', gstRate: 12, defaultUnit: 'sqft', icon: '🦓' },
  { value: 'roller_blinds', label: 'Roller Blinds', hsn: '6303', gstRate: 12, defaultUnit: 'sqft', icon: '🔄' },
  { value: 'vertical_blinds', label: 'Vertical Blinds', hsn: '6303', gstRate: 12, defaultUnit: 'sqft', icon: '📐' },
  { value: 'laminate', label: 'Laminate Flooring', hsn: '4412', gstRate: 18, defaultUnit: 'box', icon: '🪵' },
  { value: 'wooden_flooring', label: 'Wooden Flooring', hsn: '4418', gstRate: 18, defaultUnit: 'sqft', icon: '🌳' },
  { value: 'wpc_flooring', label: 'WPC Flooring', hsn: '3918', gstRate: 18, defaultUnit: 'box', icon: '📦' },
  { value: 'spc_flooring', label: 'SPC Flooring', hsn: '3918', gstRate: 18, defaultUnit: 'box', icon: '📦' },
  { value: 'carpet', label: 'Carpet', hsn: '5703', gstRate: 12, defaultUnit: 'sqft', icon: '🧶' },
  { value: 'artificial_grass', label: 'Artificial Grass', hsn: '5603', gstRate: 12, defaultUnit: 'sqft', icon: '🌿' },
  { value: 'upholstery', label: 'Upholstery Fabric', hsn: '6307', gstRate: 5, defaultUnit: 'meter', icon: '🛋️' },
  { value: 'mattress', label: 'Mattress', hsn: '9404', gstRate: 18, defaultUnit: 'pcs', icon: '🛏️' },
  { value: 'sofa', label: 'Sofa / Furniture', hsn: '9403', gstRate: 18, defaultUnit: 'set', icon: '🛋️' },
  { value: 'false_ceiling', label: 'False Ceiling', hsn: '3925', gstRate: 18, defaultUnit: 'sqft', icon: '⬜' },
  { value: 'gypsum_board', label: 'Gypsum Board', hsn: '6809', gstRate: 18, defaultUnit: 'pcs', icon: '📋' },
  { value: 'glass_mirror', label: 'Glass & Mirror', hsn: '7009', gstRate: 18, defaultUnit: 'sqft', icon: '🪞' },
  { value: 'veneer', label: 'Veneer', hsn: '4408', gstRate: 18, defaultUnit: 'sqft', icon: '🪵' },
  { value: 'wall_panel', label: 'Wall Panel', hsn: '4418', gstRate: 18, defaultUnit: 'pcs', icon: '🧱' },
  { value: 'modular_kitchen', label: 'Modular Kitchen', hsn: '9403', gstRate: 18, defaultUnit: 'set', icon: '🍳' },
  { value: 'hardware', label: 'Hardware & Fittings', hsn: '8302', gstRate: 18, defaultUnit: 'pcs', icon: '🔩' },
  { value: 'curtain_rod', label: 'Curtain Rod & Track', hsn: '7326', gstRate: 18, defaultUnit: 'pcs', icon: '📏' },
  { value: 'motorized_curtain', label: 'Motorized Curtain', hsn: '8501', gstRate: 18, defaultUnit: 'set', icon: '⚡' },
  { value: 'mosquito_net', label: 'Mosquito Net', hsn: '5608', gstRate: 5, defaultUnit: 'sqft', icon: '🦟' },
  { value: 'paint', label: 'Paint', hsn: '3208', gstRate: 28, defaultUnit: 'pcs', icon: '🎨' },
  { value: 'foam', label: 'Foam / Cushion', hsn: '9404', gstRate: 18, defaultUnit: 'pcs', icon: '🧽' },
  { value: 'accessories', label: 'Accessories', hsn: '6307', gstRate: 12, defaultUnit: 'pcs', icon: '✨' }
]

/** Categories with built-in quantity calculators on Sales Invoice */
export const CALCULATOR_CATEGORIES = ['wallpaper', 'curtain', 'pvc_plank', 'curtain_rod']
