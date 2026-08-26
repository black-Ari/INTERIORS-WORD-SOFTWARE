/**
 * CalculationService — Category-specific quantity calculators
 * for Curtain fabric, Wallpaper rolls, and PVC Plank boxes.
 */

/**
 * Calculate curtain fabric requirements.
 * All dimensions in cm unless noted.
 *
 * @param {Object} params
 * @param {number} params.trackWidth       - Track/rod width in cm
 * @param {number} params.fullnessRatio    - Fabric fullness multiplier (1.5–3)
 * @param {number} params.fabricWidth      - Fabric bolt width in cm
 * @param {number} params.finishedDrop     - Desired finished drop in cm
 * @param {number} [params.headingAllowance=10] - Heading allowance in cm
 * @param {number} [params.hemAllowance=15]     - Hem allowance in cm
 * @param {number} [params.patternRepeat=0]     - Pattern repeat height in cm (0 = plain)
 * @returns {{ panels: number, cutLength: number, totalCm: number, totalMeters: number, totalYards: number }}
 */
export function calculateCurtainFabric({
  trackWidth,
  fullnessRatio,
  fabricWidth,
  finishedDrop,
  headingAllowance = 10,
  hemAllowance = 15,
  patternRepeat = 0
}) {
  const totalWidth = trackWidth * fullnessRatio
  const panels = Math.ceil(totalWidth / fabricWidth)

  let cutLength = finishedDrop + headingAllowance + hemAllowance
  if (patternRepeat > 0) {
    cutLength = Math.ceil(cutLength / patternRepeat) * patternRepeat
  }

  const totalFabricCm = panels * cutLength
  const totalMeters = Math.round((totalFabricCm / 100) * 100) / 100
  const totalYards = Math.round((totalFabricCm / 91.44) * 100) / 100

  return {
    panels,
    cutLength,
    totalCm: totalFabricCm,
    totalMeters,
    totalYards
  }
}

/**
 * Calculate wallpaper roll requirements.
 * Dimensions in cm.
 *
 * @param {Object} params
 * @param {number} params.wallWidth         - Wall width in cm
 * @param {number} params.wallHeight        - Wall height in cm
 * @param {number} [params.rollWidth=53]    - Roll width in cm
 * @param {number} [params.rollLength=1000] - Roll length in cm
 * @param {number} [params.patternRepeat=0] - Pattern repeat height in cm (0 = plain)
 * @param {number} [params.trimmingAllowance=10] - Extra per drop in cm
 * @param {number} [params.wastagePercent=10]    - Wastage percentage
 * @returns {{ numDrops: number, adjustedDrop: number, dropsPerRoll: number, rollsBeforeWastage: number, totalRolls: number }}
 */
export function calculateWallpaperRolls({
  wallWidth,
  wallHeight,
  rollWidth = 53,
  rollLength = 1000,
  patternRepeat = 0,
  trimmingAllowance = 10,
  wastagePercent = 10
}) {
  const numDrops = Math.ceil(wallWidth / rollWidth)

  let adjustedDrop = wallHeight + trimmingAllowance
  if (patternRepeat > 0) {
    adjustedDrop = Math.ceil(adjustedDrop / patternRepeat) * patternRepeat
  }

  const dropsPerRoll = Math.floor(rollLength / adjustedDrop)
  const rollsBeforeWastage = Math.ceil(numDrops / Math.max(dropsPerRoll, 1))
  const totalRolls = Math.ceil(rollsBeforeWastage * (1 + wastagePercent / 100))

  return {
    numDrops,
    adjustedDrop,
    dropsPerRoll,
    rollsBeforeWastage,
    totalRolls
  }
}

/**
 * Calculate PVC plank box requirements.
 * Dimensions in feet.
 *
 * @param {Object} params
 * @param {number} params.roomLength       - Room length in feet
 * @param {number} params.roomWidth        - Room width in feet
 * @param {number} params.boxCoverageSqFt  - Coverage per box in sq ft
 * @param {number} [params.wastagePercent=10] - Wastage percentage
 * @returns {{ roomArea: number, withWastage: number, boxes: number, totalCoverage: number }}
 */
export function calculatePVCBoxes({
  roomLength,
  roomWidth,
  boxCoverageSqFt,
  wastagePercent = 10
}) {
  const roomArea = roomLength * roomWidth
  const withWastage = roomArea * (1 + wastagePercent / 100)
  const boxes = Math.ceil(withWastage / boxCoverageSqFt)
  const totalCoverage = boxes * boxCoverageSqFt

  return {
    roomArea: Math.round(roomArea * 100) / 100,
    withWastage: Math.round(withWastage * 100) / 100,
    boxes,
    totalCoverage: Math.round(totalCoverage * 100) / 100
  }
}

/**
 * Calculate curtain rod / track hardware requirements.
 * Dimensions in cm.
 *
 * @param {Object} params
 * @param {number} params.windowWidth       - Window opening width in cm
 * @param {number} [params.numWindows=1]      - Number of windows
 * @param {number} [params.sideExtension=15] - Rod extension beyond window each side (cm)
 * @param {'single'|'double'} [params.trackType='single'] - Single or double track
 * @param {number} [params.bracketSpacing=150] - Bracket spacing in cm
 * @returns {{ rodLengthPerWindow, totalRodLength, totalRods, bracketsPerRod, totalBrackets, totalMeters }}
 */
export function calculateCurtainRod({
  windowWidth,
  numWindows = 1,
  sideExtension = 15,
  trackType = 'single',
  bracketSpacing = 150
}) {
  const rodLengthPerWindow = windowWidth + sideExtension * 2
  const tracksPerWindow = trackType === 'double' ? 2 : 1
  const totalRods = numWindows * tracksPerWindow
  const totalRodLength = rodLengthPerWindow * totalRods
  const bracketsPerRod = Math.max(2, Math.ceil(rodLengthPerWindow / bracketSpacing) + 1)
  const totalBrackets = bracketsPerRod * totalRods
  const totalMeters = Math.round((totalRodLength / 100) * 100) / 100

  return {
    rodLengthPerWindow: Math.round(rodLengthPerWindow * 100) / 100,
    totalRodLength: Math.round(totalRodLength * 100) / 100,
    totalRods,
    bracketsPerRod,
    totalBrackets,
    totalMeters
  }
}

/**
 * Get live preview result for any calculator category.
 */
export function getCalculatorPreview(category, data) {
  if (!data || !category) return null
  try {
    if (category === 'curtain') {
      const r = calculateCurtainFabric(data)
      const unit = data.unit === 'yard' ? 'yards' : 'meters'
      const qty = data.unit === 'yard' ? r.totalYards : r.totalMeters
      return { qty, unit, detail: `${r.panels} panels × ${r.cutLength}cm cut` }
    }
    if (category === 'wallpaper') {
      const r = calculateWallpaperRolls(data)
      return { qty: r.totalRolls, unit: 'rolls', detail: `${r.numDrops} drops, ${r.dropsPerRoll} drops/roll` }
    }
    if (category === 'pvc_plank') {
      const r = calculatePVCBoxes(data)
      return { qty: r.boxes, unit: 'boxes', detail: `${r.roomArea} sq ft room area` }
    }
    if (category === 'curtain_rod') {
      const r = calculateCurtainRod(data)
      return { qty: r.totalRods, unit: 'rods', detail: `${r.rodLengthPerWindow}cm each, ${r.totalBrackets} brackets` }
    }
  } catch {
    return null
  }
  return null
}
