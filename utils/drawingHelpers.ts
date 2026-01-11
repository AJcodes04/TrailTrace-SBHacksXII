/**
 * Enhanced drawing-to-route conversion utilities
 * Improves shape preservation and waypoint selection
 */

export interface CanvasPoint {
  x: number
  y: number
}

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export interface GeographicBounds {
  north: number
  south: number
  east: number
  west: number
  center: { lat: number; lng: number }
}

/**
 * Calculate the bounding box of canvas points
 */
export function getBoundingBox(points: CanvasPoint[]): BoundingBox {
  if (points.length === 0) {
    throw new Error('Cannot calculate bounding box of empty point array')
  }

  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  const width = maxX - minX
  const height = maxY - minY

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  }
}

/**
 * Calculate the perpendicular distance from a point to a line segment
 */
function perpendicularDistance(
  point: CanvasPoint,
  lineStart: CanvasPoint,
  lineEnd: CanvasPoint
): number {
  const A = point.x - lineStart.x
  const B = point.y - lineStart.y
  const C = lineEnd.x - lineStart.x
  const D = lineEnd.y - lineStart.y

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1

  if (lenSq !== 0) {
    param = dot / lenSq
  }

  let xx: number
  let yy: number

  if (param < 0) {
    xx = lineStart.x
    yy = lineStart.y
  } else if (param > 1) {
    xx = lineEnd.x
    yy = lineEnd.y
  } else {
    xx = lineStart.x + param * C
    yy = lineStart.y + param * D
  }

  const dx = point.x - xx
  const dy = point.y - yy
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Douglas-Peucker algorithm for line simplification
 * Preserves important points while reducing total point count
 */
export function simplifyPoints(
  points: CanvasPoint[],
  tolerance: number = 2.0
): CanvasPoint[] {
  if (points.length <= 2) {
    return points
  }

  // Find the point with maximum distance from the line segment
  let maxDistance = 0
  let maxIndex = 0
  const end = points.length - 1

  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[end])
    if (distance > maxDistance) {
      maxIndex = i
      maxDistance = distance
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    // Recursive call
    const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPoints(points.slice(maxIndex), tolerance)

    // Combine results (remove duplicate point at join)
    return [...left.slice(0, -1), ...right]
  } else {
    // All points between start and end are within tolerance
    return [points[0], points[end]]
  }
}

/**
 * Detect if a path is closed (start and end points are close)
 */
export function isClosedPath(points: CanvasPoint[], threshold: number = 20): boolean {
  if (points.length < 3) return false

  const start = points[0]
  const end = points[points.length - 1]
  const distance = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
  )

  return distance < threshold
}

/**
 * Calculate curvature at a point (angle change rate)
 * Higher curvature means sharper turn, should preserve more points
 */
function calculateCurvature(
  prev: CanvasPoint,
  curr: CanvasPoint,
  next: CanvasPoint
): number {
  // Calculate vectors
  const v1x = curr.x - prev.x
  const v1y = curr.y - prev.y
  const v2x = next.x - curr.x
  const v2y = next.y - curr.y

  // Calculate angle between vectors
  const dot = v1x * v2x + v1y * v2y
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y)

  if (mag1 === 0 || mag2 === 0) return 0

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
  const angle = Math.acos(cosAngle)

  // Return angle in degrees (0-180, where 180 = sharp turn)
  return angle * (180 / Math.PI)
}

/**
 * Adaptive point sampling based on curvature
 * Preserves more points in high-curvature areas (turns, curves)
 * and fewer points in straight sections
 */
export function adaptiveSample(
  points: CanvasPoint[],
  minPoints: number = 4,
  maxPoints: number = 25,
  curvatureThreshold: number = 30 // degrees - points above this are considered high curvature
): CanvasPoint[] {
  if (points.length <= minPoints) {
    return points
  }

  if (points.length <= maxPoints) {
    // Use Douglas-Peucker with adaptive tolerance
    const boundingBox = getBoundingBox(points)
    const scale = Math.max(boundingBox.width, boundingBox.height)
    const tolerance = Math.max(1.0, scale * 0.01) // 1% of drawing size
    return simplifyPoints(points, tolerance)
  }

  // Calculate curvature for all points
  const curvatures: number[] = new Array(points.length).fill(0)
  for (let i = 1; i < points.length - 1; i++) {
    curvatures[i] = calculateCurvature(points[i - 1], points[i], points[i + 1])
  }

  // Always include first and last points
  const selected: boolean[] = new Array(points.length).fill(false)
  selected[0] = true
  selected[points.length - 1] = true

  // Select high-curvature points (sharp turns)
  const highCurvatureIndices: number[] = []
  for (let i = 1; i < points.length - 1; i++) {
    if (curvatures[i] > curvatureThreshold) {
      highCurvatureIndices.push(i)
    }
  }

  // Add high-curvature points
  highCurvatureIndices.forEach(idx => (selected[idx] = true))

  // If we still need more points, fill gaps with evenly spaced points
  const selectedCount = selected.filter(Boolean).length
  if (selectedCount < maxPoints) {
    const needed = maxPoints - selectedCount
    const step = Math.max(1, Math.floor(points.length / needed))
    
    for (let i = step; i < points.length - 1; i += step) {
      if (!selected[i] && selectedCount + selected.filter(Boolean).length - selectedCount < maxPoints) {
        selected[i] = true
      }
    }
  }

  // Build result array
  const result: CanvasPoint[] = []
  for (let i = 0; i < points.length; i++) {
    if (selected[i]) {
      result.push(points[i])
    }
  }

  return result.length >= minPoints ? result : points.slice(0, minPoints)
}

/**
 * Convert canvas coordinates to geographic coordinates with intelligent mapping
 * 
 * Improvements:
 * 1. Adapts to actual drawing bounds (not just canvas size)
 * 2. Preserves aspect ratio
 * 3. Centers the drawing within the geographic bounds
 * 4. Adds padding for better route generation
 */
export function canvasToGeographic(
  canvasPoints: CanvasPoint[],
  canvasWidth: number,
  canvasHeight: number,
  geographicBounds: GeographicBounds,
  padding: number = 0.1 // 10% padding on each side
): Array<{ lat: number; lng: number }> {
  if (canvasPoints.length === 0) {
    return []
  }

  // Calculate bounding box of the actual drawing
  const drawingBounds = getBoundingBox(canvasPoints)

  // Calculate aspect ratios
  const canvasAspect = canvasWidth / canvasHeight
  const drawingAspect = drawingBounds.width / drawingBounds.height
  const geoAspect =
    (geographicBounds.east - geographicBounds.west) /
    (geographicBounds.north - geographicBounds.south)

  // Calculate geographic ranges
  const geoLatRange = geographicBounds.north - geographicBounds.south
  const geoLngRange = geographicBounds.east - geographicBounds.west

  // Calculate scale factors with padding
  const paddedLatRange = geoLatRange * (1 - padding * 2)
  const paddedLngRange = geoLngRange * (1 - padding * 2)

  // Determine scaling to preserve aspect ratio
  // Use the dimension that requires less scaling to fit
  const scaleX = paddedLngRange / drawingBounds.width
  const scaleY = paddedLatRange / drawingBounds.height
  const scale = Math.min(scaleX, scaleY)

  // Calculate scaled dimensions
  const scaledWidth = drawingBounds.width * scale
  const scaledHeight = drawingBounds.height * scale

  // Center the scaled drawing in geographic bounds
  const centerLat = geographicBounds.center.lat
  const centerLng = geographicBounds.center.lng

  const offsetLng = centerLng - scaledWidth / 2
  const offsetLat = centerLat - scaledHeight / 2

  // Convert each point
  return canvasPoints.map(point => {
    // Translate to origin (relative to drawing bounds)
    const relativeX = point.x - drawingBounds.centerX
    const relativeY = point.y - drawingBounds.centerY

    // Scale
    const scaledX = relativeX * scale
    const scaledY = relativeY * scale

    // Translate to geographic center and convert to lat/lng
    // Note: Y is flipped because canvas Y increases downward
    const lng = offsetLng + scaledWidth / 2 + scaledX
    const lat = offsetLat + scaledHeight / 2 - scaledY // Negative for Y flip

    return { lat, lng }
  })
}

/**
 * Convert canvas coordinates to geographic coordinates relative to a start point
 * The first point of the drawing will be positioned at the selected start point
 * 
 * @param canvasPoints - Canvas drawing points
 * @param startPoint - Selected geographic start point where the first canvas point should be placed
 * @param scale - Scale factor for the route (km per pixel, default: ~0.1 km/pixel for reasonable route sizes)
 */
export function canvasToGeographicFromStartPoint(
  canvasPoints: CanvasPoint[],
  startPoint: { lat: number; lng: number },
  scale: number = 0.0001 // ~11 meters per pixel (for 400px canvas = ~4.4km max dimension)
): Array<{ lat: number; lng: number }> {
  if (canvasPoints.length === 0) {
    return []
  }

  const firstPoint = canvasPoints[0]

  return canvasPoints.map(point => {
    // Calculate offset from first point (in canvas pixels)
    const deltaX = point.x - firstPoint.x
    const deltaY = point.y - firstPoint.y

    // Convert pixel offset to geographic offset
    // Y is flipped (canvas Y increases downward, lat increases upward)
    // Rough conversion: 1 degree lat ≈ 111 km, 1 degree lng ≈ 111 km * cos(lat)
    const latOffset = -deltaY * scale // Negative because Y is flipped
    const lngOffset = deltaX * scale / Math.cos(startPoint.lat * Math.PI / 180) // Adjust for latitude

    return {
      lat: startPoint.lat + latOffset,
      lng: startPoint.lng + lngOffset,
    }
  })
}

/**
 * Enhanced waypoint selection pipeline
 * Combines multiple techniques for optimal waypoint selection
 */
export function selectOptimalWaypoints(
  points: CanvasPoint[],
  options: {
    minPoints?: number
    maxPoints?: number
    preserveCurves?: boolean
  } = {}
): CanvasPoint[] {
  const {
    minPoints = 4,
    maxPoints = 25,
    preserveCurves = true,
  } = options

  if (points.length <= minPoints) {
    return points
  }

  // Step 1: Remove very close points (distance-based filtering)
  const filtered = distanceFilter(points, 8) // 8px minimum distance

  // Step 2: Apply adaptive sampling if needed
  if (filtered.length > maxPoints) {
    if (preserveCurves) {
      return adaptiveSample(filtered, minPoints, maxPoints)
    } else {
      // Use Douglas-Peucker for simpler shapes
      const boundingBox = getBoundingBox(filtered)
      const scale = Math.max(boundingBox.width, boundingBox.height)
      const tolerance = Math.max(1.5, scale * 0.015)
      const simplified = simplifyPoints(filtered, tolerance)

      // Ensure we have enough points
      if (simplified.length < minPoints) {
        return filtered.slice(0, Math.min(maxPoints, filtered.length))
      }

      // If still too many, evenly sample
      if (simplified.length > maxPoints) {
        return evenlySample(simplified, maxPoints)
      }

      return simplified
    }
  }

  // Step 3: Final cleanup with Douglas-Peucker if we have many points
  if (filtered.length > maxPoints * 1.5) {
    const boundingBox = getBoundingBox(filtered)
    const scale = Math.max(boundingBox.width, boundingBox.height)
    const tolerance = Math.max(2.0, scale * 0.02)
    const simplified = simplifyPoints(filtered, tolerance)
    return simplified.length >= minPoints ? simplified : filtered
  }

  return filtered
}

/**
 * Distance-based filtering - removes points that are too close together
 */
function distanceFilter(
  points: CanvasPoint[],
  minDistance: number
): CanvasPoint[] {
  if (points.length <= 2) return points

  const filtered: CanvasPoint[] = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = filtered[filtered.length - 1]
    const curr = points[i]
    const distance = Math.sqrt(
      Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
    )

    if (distance >= minDistance) {
      filtered.push(curr)
    }
  }

  // Always include last point
  filtered.push(points[points.length - 1])
  return filtered
}

/**
 * Evenly sample points from an array
 */
function evenlySample(points: CanvasPoint[], count: number): CanvasPoint[] {
  if (points.length <= count) return points

  const result: CanvasPoint[] = [points[0]] // Always include first

  if (count <= 2) {
    result.push(points[points.length - 1])
    return result
  }

  const step = (points.length - 1) / (count - 1)

  for (let i = 1; i < count - 1; i++) {
    const index = Math.round(i * step)
    result.push(points[index])
  }

  result.push(points[points.length - 1]) // Always include last
  return result
}
