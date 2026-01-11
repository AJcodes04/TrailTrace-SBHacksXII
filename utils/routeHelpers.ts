import type { Route, Coordinate } from '@/types/route'

// OSRM server configuration
// Using custom VPS instance for Southern California area
const OSRM_BASE_URL = 'http://178.128.70.119:5000'

/**
 * Creates a route object with default styling
 */
export function createRoute(
  coordinates: Coordinate[],
  options?: {
    id?: string
    name?: string
    color?: string
    weight?: number
    opacity?: number
  }
): Route {
  return {
    id: options?.id || `route-${Date.now()}`,
    name: options?.name,
    coordinates,
    color: options?.color || '#3b82f6',
    weight: options?.weight || 5,
    opacity: options?.opacity || 0.8,
  }
}

/**
 * Calculates the distance between two coordinates in kilometers (Haversine formula)
 */
function distance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371 // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculates the perpendicular distance from a point to a line segment
 * Used to detect protrusions in the path
 */
function perpendicularDistance(
  point: Coordinate,
  lineStart: Coordinate,
  lineEnd: Coordinate
): number {
  // Calculate the distance from point to the line segment
  const A = point.lat - lineStart.lat
  const B = point.lng - lineStart.lng
  const C = lineEnd.lat - lineStart.lat
  const D = lineEnd.lng - lineStart.lng
  
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  
  if (lenSq !== 0) {
    param = dot / lenSq
  }
  
  let xx: number, yy: number
  
  if (param < 0) {
    xx = lineStart.lat
    yy = lineStart.lng
  } else if (param > 1) {
    xx = lineEnd.lat
    yy = lineEnd.lng
  } else {
    xx = lineStart.lat + param * C
    yy = lineStart.lng + param * D
  }
  
  const dx = point.lat - xx
  const dy = point.lng - yy
  return Math.sqrt(dx * dx + dy * dy) * 111 // Convert to approximate km (1 degree ≈ 111 km)
}

/**
 * Smooths a path by removing points that create sharp angles and preferring straight lines
 * More aggressive smoothing that:
 * - Removes points with sharp angles (< 135 degrees = sharp turn)
 * - Prefers straight lines by removing points with small perpendicular deviation
 * - Uses a combined score to decide which points to keep
 * 
 * @param coordinates - Array of coordinates to smooth
 * @param maxDeviation - Maximum allowed deviation in km before removing a point (default: 0.03km = 30m)
 * @param minAngle - Minimum angle (in degrees) to keep a point - lower values remove more sharp points (default: 135°)
 * @returns Smoothed array of coordinates
 */
function smoothPath(
  coordinates: Coordinate[],
  maxDeviation: number = 0.03, // 30 meters - increased for better straight line preference
  minAngle: number = 135 // 135 degrees - removes points creating angles sharper than this
): Coordinate[] {
  if (coordinates.length <= 2) {
    return coordinates
  }
  
  const smoothed: Coordinate[] = [coordinates[0]] // Always keep first point
  
  for (let i = 1; i < coordinates.length - 1; i++) {
    const prev = smoothed[smoothed.length - 1]
    const current = coordinates[i]
    const next = coordinates[i + 1]
    
    // Calculate perpendicular distance from current point to line from prev to next
    // This measures how much the point deviates from a straight line
    const deviation = perpendicularDistance(current, prev, next)
    
    // Calculate the angle at the current point (angle between prev->current and current->next)
    const angle = calculateAngle(prev, current, next)
    
    // Prefer straight lines: remove points with small deviation (they're close to the straight line)
    const isNearlyStraight = deviation < maxDeviation
    
    // Avoid sharp points: remove points that create sharp angles
    // Lower angles = sharper turns (0° = 180° turn, 180° = straight line)
    const isSharpPoint = angle < minAngle
    
    // Remove the point if:
    // 1. It's nearly on a straight line (small deviation) OR
    // 2. It creates a sharp angle (sharp turn)
    // This prefers straight lines and avoids sharp points
    if (isNearlyStraight || isSharpPoint) {
      continue
    }
    
    // Keep the point - it contributes to a smooth, non-straight path (like a gentle curve)
    smoothed.push(current)
  }
  
  // Always keep last point
  smoothed.push(coordinates[coordinates.length - 1])
  
  return smoothed
}

/**
 * Checks if two coordinates are close enough to be considered the same point
 * Used to detect when the route loops back to a previously visited location
 */
function areCoordinatesClose(coord1: Coordinate, coord2: Coordinate, threshold: number = 0.001): boolean {
  // threshold is in degrees, ~0.001 degrees ≈ 111 meters
  return Math.abs(coord1.lat - coord2.lat) < threshold && Math.abs(coord1.lng - coord2.lng) < threshold
}

/**
 * Removes redundant loops where the path leads back to itself without progressing
 * Detects when a coordinate appears multiple times and removes the redundant cycle
 * 
 * @param coordinates - Array of coordinates representing the route
 * @param threshold - Distance threshold for considering coordinates the same (in degrees, default: 0.001 ≈ 111m)
 * @returns Array of coordinates with redundant loops removed
 */
function removeRedundantLoops(
  coordinates: Coordinate[],
  threshold: number = 0.001 // ~111 meters
): Coordinate[] {
  if (coordinates.length <= 2) {
    return coordinates
  }

  const cleaned: Coordinate[] = []
  const visitedIndices = new Map<string, number>() // Map coordinate key to first occurrence index
  
  for (let i = 0; i < coordinates.length; i++) {
    const current = coordinates[i]
    const coordKey = `${Math.round(current.lat / threshold)}_${Math.round(current.lng / threshold)}`
    
    // Check if we've seen a coordinate close to this one before
    let isRedundantLoop = false
    for (const [key, firstIndex] of visitedIndices.entries()) {
      const [firstLat, firstLng] = key.split('_').map(Number)
      const prevCoord: Coordinate = {
        lat: firstLat * threshold,
        lng: firstLng * threshold,
      }
      
      if (areCoordinatesClose(current, prevCoord, threshold)) {
        // Found a loop - check if removing it would be beneficial
        // Remove the segment from firstIndex+1 to i-1 (the loop segment)
        isRedundantLoop = true
        break
      }
    }
    
    if (!isRedundantLoop) {
      // Add coordinate to cleaned route
      cleaned.push(current)
      
      // Record this coordinate as visited
      visitedIndices.set(coordKey, cleaned.length - 1)
    } else {
      // Skip this coordinate (it's part of a redundant loop)
      // The coordinate at firstIndex is already in cleaned, so we just skip the loop
    }
  }
  
  return cleaned.length >= 2 ? cleaned : coordinates
}

/**
 * Advanced loop removal that detects cycles more intelligently
 * Looks for sequences where the route returns to a previously visited point
 * and removes the redundant cycle segment by merging the edges
 */
function mergeRedundantEdges(
  coordinates: Coordinate[],
  threshold: number = 0.001 // ~111 meters
): Coordinate[] {
  if (coordinates.length <= 3) {
    return coordinates
  }

  const coordinateHash = (coord: Coordinate): string => {
    // Create a hash key by rounding coordinates to threshold precision
    return `${Math.round(coord.lat / threshold)}_${Math.round(coord.lng / threshold)}`
  }
  
  // Track the last occurrence index in the result array for each coordinate hash
  const lastOccurrenceInResult = new Map<string, number>()
  const result: Coordinate[] = []
  
  for (let i = 0; i < coordinates.length; i++) {
    const current = coordinates[i]
    const key = coordinateHash(current)
    
    // Special case: Check for length-2 cycles (A -> B -> A pattern)
    // This happens when current matches the point 2 positions back
    if (result.length >= 2) {
      const twoBack = result[result.length - 2]
      if (areCoordinatesClose(current, twoBack, threshold)) {
        // Found a length-2 cycle: remove the middle point (the point we just added)
        const removedPoint = result.pop()! // Remove the middle point (B in A -> B -> A)
        // Don't add current (A) again since twoBack (A) is already in result
        // Update the map: remove the removed point's entry and update twoBack's entry
        const removedKey = coordinateHash(removedPoint)
        lastOccurrenceInResult.delete(removedKey)
        const twoBackKey = coordinateHash(twoBack)
        lastOccurrenceInResult.set(twoBackKey, result.length - 1) // twoBack is now at the end
        continue
      }
    }
    
    if (lastOccurrenceInResult.has(key)) {
      // We've seen this coordinate before in the result
      const prevResultIndex = lastOccurrenceInResult.get(key)!
      
      // Check if removing the loop segment makes sense
      // Calculate progress: distance from loop start to route end vs distance from loop end to route end
      const routeEnd = coordinates[coordinates.length - 1]
      const loopStartCoord = result[prevResultIndex]
      const distFromLoopStart = distance(loopStartCoord, routeEnd)
      const distFromLoopEnd = distance(current, routeEnd)
      
      // If we're not significantly closer to the end after the loop, the loop is redundant
      // Allow 5% tolerance to account for measurement errors
      if (distFromLoopEnd >= distFromLoopStart * 0.95) {
        // Remove the redundant loop segment from result
        // Remove all points between prevResultIndex+1 and the end of result
        // This merges the edges by removing the loop
        result.splice(prevResultIndex + 1)
        
        // Update the lastOccurrence map to remove entries for deleted points
        // We need to rebuild the map for remaining points
        lastOccurrenceInResult.clear()
        for (let j = 0; j < result.length; j++) {
          const coordKey = coordinateHash(result[j])
          lastOccurrenceInResult.set(coordKey, j)
        }
        
        // Continue from this point (don't add current again, we're merging with prevResultIndex)
        // But we need to update the map to point to the merged location
        lastOccurrenceInResult.set(key, prevResultIndex)
        continue
      }
    }
    
    // Add coordinate to result
    result.push(current)
    lastOccurrenceInResult.set(key, result.length - 1)
  }
  
  // Ensure we always have at least the start and end points
  if (result.length < 2) {
    return coordinates
  }
  
  // Make sure the last point is preserved (if it's not already there)
  const lastOriginal = coordinates[coordinates.length - 1]
  const lastResult = result[result.length - 1]
  if (!areCoordinatesClose(lastResult, lastOriginal, threshold)) {
    result.push(lastOriginal)
  }
  
  return result
}

/**
 * Calculates bearing (direction) from coord1 to coord2 in degrees
 * 0° = North, 90° = East, 180° = South, 270° = West
 */
function calculateBearing(coord1: Coordinate, coord2: Coordinate): number {
  const lat1 = coord1.lat * Math.PI / 180
  const lat2 = coord2.lat * Math.PI / 180
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180
  
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI
  return (bearing + 360) % 360 // Normalize to 0-360
}

/**
 * Removes points that have edges with bearing difference of ~180 degrees (backtracking)
 * Single pass filter that removes points where the incoming and outgoing edges
 * are nearly opposite directions, indicating a backtrack pattern
 * 
 * @param coordinates - Array of coordinates representing the route
 * @param tolerance - Tolerance in degrees for 180-degree check (default: 20 degrees, so 160-200 degrees range)
 * @returns Array of coordinates with backtracking points removed
 */
function removeBacktrackPoints(coordinates: Coordinate[], tolerance: number = 20): Coordinate[] {
  if (coordinates.length <= 3) {
    // Need at least 3 points to check bearing difference
    return coordinates
  }

  const result: Coordinate[] = [coordinates[0]] // Always keep first point
  
  // Check each middle point (skip first and last)
  for (let i = 1; i < coordinates.length - 1; i++) {
    const prev = coordinates[i - 1]
    const current = coordinates[i]
    const next = coordinates[i + 1]
    
    // Calculate bearings for the two edges
    const bearingIn = calculateBearing(prev, current) // Bearing of incoming edge
    const bearingOut = calculateBearing(current, next) // Bearing of outgoing edge
    
    // Calculate the absolute difference in bearings
    let bearingDiff = Math.abs(bearingOut - bearingIn)
    
    // Account for wrapping around 360 degrees (e.g., 350° and 10° difference is 20°, not 340°)
    if (bearingDiff > 180) {
      bearingDiff = 360 - bearingDiff
    }
    
    // Check if the bearing difference is approximately 180 degrees (backtracking)
    // Allow tolerance on both sides of 180 degrees
    const minBacktrackAngle = 180 - tolerance
    const maxBacktrackAngle = 180 + tolerance
    
    if (bearingDiff >= minBacktrackAngle && bearingDiff <= maxBacktrackAngle) {
      // This point creates a backtrack - skip it
      continue
    }
    
    // Keep the point - it doesn't create a backtrack
    result.push(current)
  }
  
  // Always keep last point (target)
  result.push(coordinates[coordinates.length - 1])
  
  return result.length >= 2 ? result : coordinates
}

/**
 * Calculates the angle between three points (in degrees)
 * Returns the angle at the middle point
 */
function calculateAngle(
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate
): number {
  // Calculate vectors
  const v1x = p1.lat - p2.lat
  const v1y = p1.lng - p2.lng
  const v2x = p3.lat - p2.lat
  const v2y = p3.lng - p2.lng
  
  // Calculate dot product and magnitudes
  const dot = v1x * v2x + v1y * v2y
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y)
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y)
  
  if (mag1 === 0 || mag2 === 0) {
    return 180
  }
  
  // Calculate angle in radians, then convert to degrees
  const cosAngle = dot / (mag1 * mag2)
  const clamped = Math.max(-1, Math.min(1, cosAngle)) // Clamp to avoid NaN
  const angleRad = Math.acos(clamped)
  return angleRad * (180 / Math.PI)
}

// Cache for snapped coordinates to avoid redundant API calls
const snapCache = new Map<string, Coordinate>()

/**
 * Generates a cache key for a coordinate
 */
function getCacheKey(coord: Coordinate, profile: string): string {
  // Round to 5 decimal places (~1 meter precision) for cache key
  const lat = Math.round(coord.lat * 100000) / 100000
  const lng = Math.round(coord.lng * 100000) / 100000
  return `${profile}_${lat}_${lng}`
}

/**
 * Checks if a coordinate is already close to a road (within ~10 meters)
 * If so, we can skip snapping to save API calls
 */
function isCloseToRoad(coord: Coordinate, snapped: Coordinate): boolean {
  const dist = distance(coord, snapped)
  return dist < 0.01 // 10 meters
}

/**
 * Snaps a coordinate to the nearest point on the road network using OSRM's nearest service
 * This finds the closest intersection or road point, making waypoints align with actual roads
 * 
 * Optimizations:
 * - Caching to avoid redundant API calls
 * - Skip snapping if already close to road
 * 
 * @param coordinate - The coordinate to snap
 * @param profile - OSRM profile to use ('driving', 'walking', 'cycling'). Defaults to 'walking'
 * @param useCache - Whether to use cached results (default: true)
 * @returns Promise resolving to the snapped coordinate, or original coordinate if snapping fails
 */
export async function snapToNearestRoad(
  coordinate: Coordinate,
  profile: 'driving' | 'walking' | 'cycling' = 'walking',
  useCache: boolean = true
): Promise<Coordinate> {
  // Check cache first
  if (useCache) {
    const cacheKey = getCacheKey(coordinate, profile)
    const cached = snapCache.get(cacheKey)
    if (cached) {
      return cached
    }
  }
  
  try {
    const osrmUrl = `${OSRM_BASE_URL}/nearest/v1/${profile}/${coordinate.lng},${coordinate.lat}?number=1`
    
    const response = await fetch(osrmUrl)
    
    if (!response.ok) {
      // If nearest service fails, return original coordinate
      if (response.status === 429) {
        console.warn('OSRM rate limit reached, returning original coordinate')
      } else {
        console.warn(`OSRM nearest API error (${response.status}): ${response.statusText}`)
      }
      return coordinate
    }
    
    const data = await response.json()
    console.log(data);
    
    if (data.code !== 'Ok' || !data.waypoints || data.waypoints.length === 0) {
      console.warn('OSRM nearest service failed, returning original coordinate')
      return coordinate
    }
    
    // Extract the snapped coordinate from the nearest waypoint
    const snappedWaypoint = data.waypoints[0]
    if (snappedWaypoint.location) {
      // OSRM returns coordinates as [lng, lat]
      const snapped: Coordinate = {
        lat: snappedWaypoint.location[1],
        lng: snappedWaypoint.location[0],
      }
      
      // Cache the result
      if (useCache) {
        const cacheKey = getCacheKey(coordinate, profile)
        snapCache.set(cacheKey, snapped)
        
      // Limit cache size to prevent memory issues (keep last 1000 entries)
      if (snapCache.size > 1000) {
        const firstKey = snapCache.keys().next().value
        if (firstKey) {
          snapCache.delete(firstKey)
        }
      }
      }
      
      // If already very close to road, return original to avoid unnecessary movement
      if (isCloseToRoad(coordinate, snapped)) {
        return coordinate
      }
      
      return snapped
    }
    
    return coordinate
  } catch (error) {
    console.error('Error snapping to nearest road:', error)
    return coordinate
  }
}

/**
 * Snaps multiple coordinates to nearest roads in parallel
 * More efficient than calling snapToNearestRoad multiple times
 * 
 * @param coordinates - Array of coordinates to snap
 * @param profile - OSRM profile to use
 * @param batchSize - Number of coordinates to process in parallel (default: 10)
 * @returns Promise resolving to array of snapped coordinates
 */
export async function snapMultipleToNearestRoad(
  coordinates: Coordinate[],
  profile: 'driving' | 'walking' | 'cycling' = 'walking',
  batchSize: number = 10
): Promise<Coordinate[]> {
  // Process in batches to avoid overwhelming the API
  const results: Coordinate[] = []
  
  for (let i = 0; i < coordinates.length; i += batchSize) {
    const batch = coordinates.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(coord => snapToNearestRoad(coord, profile, true))
    )
    results.push(...batchResults)
    
    // Small delay between batches to avoid rate limiting (only if not last batch)
    if (i + batchSize < coordinates.length) {
      await new Promise(resolve => setTimeout(resolve, 50)) // Reduced from 100ms
    }
  }
  
  return results
}

/**
 * Adds intermediate points along a line segment to preserve shape better
 * @param start - Start coordinate
 * @param end - End coordinate
 * @param maxSegmentLength - Maximum length of each segment in km (default: 0.1km = 100m)
 * @returns Array of coordinates including intermediate points
 */
function addIntermediatePoints(
  start: Coordinate,
  end: Coordinate,
  maxSegmentLength: number = 0.4
): Coordinate[] {
  const dist = distance(start, end)
  if (dist <= maxSegmentLength) {
    return [start, end]
  }
  
  const numSegments = Math.ceil(dist / maxSegmentLength)
  const points: Coordinate[] = [start]
  
  for (let i = 1; i < numSegments; i++) {
    const ratio = i / numSegments
    points.push({
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio,
    })
  }
  
  points.push(end)
  return points
}

/**
 * Calculates the straightness ratio of a route
 * Returns a value between 0 and 1, where 1 is perfectly straight
 * (straight-line distance / actual route distance)
 */
function calculateStraightness(route: Coordinate[], start: Coordinate, end: Coordinate): number {
  if (route.length < 2) return 0
  
  const straightDistance = distance(start, end)
  if (straightDistance === 0) return 1
  
  // Calculate total route distance
  let routeDistance = 0
  for (let i = 0; i < route.length - 1; i++) {
    routeDistance += distance(route[i], route[i + 1])
  }
  
  if (routeDistance === 0) return 1
  return straightDistance / routeDistance
}

/**
 * Calculates the proportion of highway distance in a route (0.0 to 1.0)
 * Returns the fraction of the route that uses highways
 * Highways include: motorway, motorway_link, trunk, trunk_link
 * Also checks for common highway indicators in road names
 */
function calculateHighwayProportion(route: {
  distance?: number
  legs?: Array<{
    steps?: Array<{
      distance?: number
      name?: string
      driving_side?: string
      mode?: string
      ref?: string
    }>
  }>
}): number {
  if (!route.legs || !Array.isArray(route.legs)) {
    return 0 // Can't determine without steps, assume no highways
  }
  
  const totalDistance = route.distance || 0
  if (totalDistance === 0) {
    return 0
  }
  
  // Highway type keywords
  const highwayTypes = ['motorway', 'motorway_link', 'trunk', 'trunk_link']
  
  // Common highway indicators in road names
  const highwayIndicators = [
    'highway', 'freeway', 'interstate', 'i-', 'i ', 'us-', 'us ', 
    'state route', 'sr-', 'parkway', 'expressway', 'turnpike'
  ]
  
  let highwayDistance = 0
  
  for (const leg of route.legs) {
    if (leg.steps && Array.isArray(leg.steps)) {
      for (const step of leg.steps) {
        const name = (step.name || '').toLowerCase()
        const ref = (step.ref || '').toLowerCase()
        const combined = `${name} ${ref}`
        const stepDistance = step.distance || 0
        
        // Check if this step is on a highway
        let isHighway = false
        
        // Check for highway type keywords
        if (highwayTypes.some(type => combined.includes(type))) {
          isHighway = true
        }
        
        // Check for highway indicators in names/refs
        // Interstate highways (I-5, I-10, etc.)
        if (/^i-?\d+/.test(ref) || /^i-?\d+/.test(name)) {
          isHighway = true
        }
        
        // US highways (US-101, US 101, etc.)
        if (/^us-?\d+/.test(ref) || /^us-?\d+/.test(name)) {
          isHighway = true
        }
        
        // Check for other highway indicators
        if (highwayIndicators.some(indicator => combined.includes(indicator))) {
          isHighway = true
        }
        
        if (isHighway) {
          highwayDistance += stepDistance
        }
      }
    }
  }
  
  return highwayDistance / totalDistance
}

/**
 * Calculates the total highway distance and number of highway segments
 * Prefers routes that cross freeways quickly (fewer segments, shorter total distance)
 * Returns an object with highwayDistance (in meters) and highwaySegmentCount
 */
function calculateHighwayMetrics(route: {
  distance?: number
  legs?: Array<{
    steps?: Array<{
      distance?: number
      name?: string
      driving_side?: string
      mode?: string
      ref?: string
    }>
  }>
}): { highwayDistance: number; highwaySegmentCount: number } {
  if (!route.legs || !Array.isArray(route.legs)) {
    return { highwayDistance: 0, highwaySegmentCount: 0 }
  }
  
  // Highway type keywords
  const highwayTypes = ['motorway', 'motorway_link', 'trunk', 'trunk_link']
  
  // Common highway indicators in road names
  const highwayIndicators = [
    'highway', 'freeway', 'interstate', 'i-', 'i ', 'us-', 'us ', 
    'state route', 'sr-', 'parkway', 'expressway', 'turnpike'
  ]
  
  let highwayDistance = 0
  let highwaySegmentCount = 0
  let inHighwaySegment = false
  
  for (const leg of route.legs) {
    if (leg.steps && Array.isArray(leg.steps)) {
      for (const step of leg.steps) {
        const name = (step.name || '').toLowerCase()
        const ref = (step.ref || '').toLowerCase()
        const combined = `${name} ${ref}`
        const stepDistance = step.distance || 0
        
        // Check if this step is on a highway
        let isHighway = false
        
        // Check for highway type keywords
        if (highwayTypes.some(type => combined.includes(type))) {
          isHighway = true
        }
        
        // Check for highway indicators in names/refs
        // Interstate highways (I-5, I-10, etc.)
        if (/^i-?\d+/.test(ref) || /^i-?\d+/.test(name)) {
          isHighway = true
        }
        
        // US highways (US-101, US 101, etc.)
        if (/^us-?\d+/.test(ref) || /^us-?\d+/.test(name)) {
          isHighway = true
        }
        
        // Check for other highway indicators
        if (highwayIndicators.some(indicator => combined.includes(indicator))) {
          isHighway = true
        }
        
        if (isHighway) {
          highwayDistance += stepDistance
          // Count new highway segments (when entering a highway)
          if (!inHighwaySegment) {
            highwaySegmentCount++
            inHighwaySegment = true
          }
        } else {
          inHighwaySegment = false
        }
      }
    }
  }
  
  return { highwayDistance, highwaySegmentCount }
}

/**
 * Routes between two coordinates using OSRM, preferring straighter paths
 * For running routes, we want more direct paths and minimize highway travel
 */
async function routeBetweenPoints(
  start: Coordinate,
  end: Coordinate,
  profile: 'driving' | 'walking' | 'cycling',
  preferStraight: boolean = true,
  avoidHighways: boolean = true,
): Promise<Coordinate[]> {
  try {
    const waypoints = `${start.lng},${start.lat};${end.lng},${end.lat}`
    
    // For running routes, prefer straighter paths by:
    // 1. Requesting alternative routes
    // 2. Choosing the route with the best straightness ratio
    // 3. Using overview=simplified for faster, more direct routes
    // 4. Requesting steps if we need to check for highways
    const alternatives = preferStraight ? '&alternatives=3' : ''
    const overview = preferStraight ? 'simplified' : 'full' // Simplified gives fewer points, more direct
    const steps = avoidHighways ? 'true' : 'false' // Need steps to check for highways
    
    const osrmUrl = `${OSRM_BASE_URL}/route/v1/${profile}/${waypoints}?overview=${overview}&geometries=geojson&steps=${steps}${alternatives}`
    
    const response = await fetch(osrmUrl)
    
    if (!response.ok) {
      // If routing fails, return straight line
      return [start, end]
    }
    
    const data = await response.json()
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return [start, end]
    }
    
    // Select the best route based on straightness and highway minimization
    let bestRoute = data.routes[0]
    if (preferStraight && data.routes.length > 1) {
      let bestScore = -Infinity
      
      for (const route of data.routes) {
        if (route.geometry && route.geometry.type === 'LineString' && route.geometry.coordinates) {
          const routeCoords = route.geometry.coordinates.map((coord: [number, number]) => ({
            lat: coord[1],
            lng: coord[0],
          }))
          const routeStraightness = calculateStraightness(routeCoords, start, end)
          
          // Prefer routes that are straighter (higher ratio)
          // Also slightly prefer shorter routes for the same straightness
          // Minimize highway usage if avoidHighways is true
          // Prefer routes that cross freeways quickly (minimize highway distance and segments)
          const routeDistance = route.distance || Infinity
          let highwayPenalty = 1.0
          if (avoidHighways) {
            const highwayMetrics = calculateHighwayMetrics(route)
            const highwayDistanceKm = highwayMetrics.highwayDistance / 1000 // Convert to km
            
            // Penalize based on:
            // 1. Total highway distance (prefer shorter highway segments = quick crossings)
            // 2. Number of highway segments (prefer fewer crossings = more efficient)
            // Maximum penalty for long highway travel or many segments
            const distancePenalty = Math.min(1.0, 1.0 - (highwayDistanceKm * 0.5)) // 0.5 penalty per km of highway
            const segmentPenalty = Math.min(1.0, 1.0 - (highwayMetrics.highwaySegmentCount * 0.1)) // 0.1 penalty per segment
            highwayPenalty = Math.max(0.2, distancePenalty * segmentPenalty) // Combined penalty, minimum 0.2
          }
          const score = routeStraightness * (1 + 1 / (routeDistance / 1000 + 1)) * highwayPenalty
          
          if (score > bestScore) {
            bestScore = score
            bestRoute = route
          }
        }
      }
    }
    
    const geometry = bestRoute.geometry
    if (geometry.type === 'LineString' && geometry.coordinates) {
      const routeCoords = geometry.coordinates.map((coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0],
      }))
      // Remove redundant loops
      const loopFreeCoords = mergeRedundantEdges(routeCoords, 0.001)
      // Remove backtracking points (edges with ~180 degree bearing difference)
      const backtrackFreeCoords = removeBacktrackPoints(loopFreeCoords, 20)
      return backtrackFreeCoords
    }
    
    return [start, end]
  } catch (error) {
    console.error('Error routing between points:', error)
    return [start, end]
  }
}

/**
 * Optimizes waypoint order using Dijkstra's-like shortest path approach
 * Finds the optimal order to visit waypoints that minimizes total distance
 * Uses a nearest-neighbor heuristic with OSRM distance calculations
 * 
 * @param coordinates - Array of waypoint coordinates
 * @param profile - OSRM profile to use
 * @returns Promise resolving to optimized array of coordinates
 */
export async function optimizeWaypointOrder(
  coordinates: Coordinate[],
  profile: 'driving' | 'walking' | 'cycling' = 'walking'
): Promise<Coordinate[]> {
  if (coordinates.length <= 2) {
    return coordinates
  }
  
  try {
    // Calculate distances between all pairs using OSRM
    const distanceMatrix: number[][] = []
    const distances = new Map<string, number>()
    
    // Build distance matrix (cache distances)
    for (let i = 0; i < coordinates.length; i++) {
      distanceMatrix[i] = []
      for (let j = 0; j < coordinates.length; j++) {
        if (i === j) {
          distanceMatrix[i][j] = 0
        } else {
          const key = `${i}-${j}`
          const reverseKey = `${j}-${i}`
          
          if (distances.has(key)) {
            distanceMatrix[i][j] = distances.get(key)!
          } else if (distances.has(reverseKey)) {
            distanceMatrix[i][j] = distances.get(reverseKey)!
          } else {
            // Get route distance from OSRM
            const waypoints = `${coordinates[i].lng},${coordinates[i].lat};${coordinates[j].lng},${coordinates[j].lat}`
            const osrmUrl = `${OSRM_BASE_URL}/route/v1/${profile}/${waypoints}?overview=false&geometries=geojson&steps=false`
            
            try {
              const response = await fetch(osrmUrl)
              if (response.ok) {
                const data = await response.json()
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                  const dist = (data.routes[0].distance || 0) / 1000 // Convert to km
                  distanceMatrix[i][j] = dist
                  distances.set(key, dist)
                } else {
                  // Fallback to straight-line distance
                  distanceMatrix[i][j] = distance(coordinates[i], coordinates[j])
                }
              } else {
                distanceMatrix[i][j] = distance(coordinates[i], coordinates[j])
              }
            } catch {
              distanceMatrix[i][j] = distance(coordinates[i], coordinates[j])
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        }
      }
    }
    
    // Use nearest-neighbor heuristic (greedy approach like Dijkstra's)
    // Start with first waypoint
    const visited = new Set<number>([0])
    const optimizedOrder: number[] = [0]
    let current = 0
    
    // Find nearest unvisited neighbor for each step
    while (visited.size < coordinates.length) {
      let nearest = -1
      let minDist = Infinity
      
      for (let i = 0; i < coordinates.length; i++) {
        if (!visited.has(i)) {
          const dist = distanceMatrix[current][i]
          if (dist < minDist) {
            minDist = dist
            nearest = i
          }
        }
      }
      
      if (nearest !== -1) {
        optimizedOrder.push(nearest)
        visited.add(nearest)
        current = nearest
      } else {
        break
      }
    }
    
    // Return coordinates in optimized order
    return optimizedOrder.map(index => coordinates[index])
  } catch (error) {
    console.error('Error optimizing waypoint order:', error)
    return coordinates
  }
}

/**
 * Snaps coordinates to roads using OSRM routing service
 * Returns road-aligned coordinates that follow actual road paths
 * 
 * This function preserves the shape better by:
 * 1. Adding intermediate waypoints along long edges
 * 2. Routing between consecutive waypoints segment by segment
 * 3. Combining all segments to maintain the original polygon shape
 * 
 * Note: Uses the public OSRM demo server which is rate-limited.
 * For production use, consider hosting your own OSRM instance or using
 * a commercial routing service.
 * 
 * @param coordinates - Array of waypoint coordinates to snap to roads
 * @param profile - OSRM profile to use ('driving', 'walking', 'cycling'). Defaults to 'walking' for running routes
 * @param preserveShape - If true, adds intermediate points and routes segment-by-segment to better preserve shape
 * @returns Promise resolving to array of coordinates aligned with roads
 */
export async function snapToRoads(
  coordinates: Coordinate[],
  profile: 'driving' | 'walking' | 'cycling' = 'walking',
  preserveShape: boolean = true,
  avoidHighways: boolean = true,
  optimizeOrder: boolean = false
): Promise<Coordinate[]> {
  if (coordinates.length < 2) {
    return coordinates
  }

  // Step 1: Optimize waypoint order using Dijkstra's-like approach (if requested)
  let optimizedCoordinates = coordinates
  if (optimizeOrder && coordinates.length > 2) {
    try {
      optimizedCoordinates = await optimizeWaypointOrder(coordinates, profile)
    } catch (error) {
      console.warn('Waypoint order optimization failed, using original order:', error)
      optimizedCoordinates = coordinates
    }
  }

  // If preserveShape is false, use simple routing but still prefer straight paths
  if (!preserveShape) {
    try {
      const waypoints = optimizedCoordinates.map(coord => `${coord.lng},${coord.lat}`).join(';')
      // Use simplified overview and request alternatives for straighter paths
      // Request steps if we need to check for highways
      const steps = avoidHighways ? 'true' : 'false'
      const osrmUrl = `${OSRM_BASE_URL}/route/v1/${profile}/${waypoints}?overview=simplified&geometries=geojson&steps=${steps}&alternatives=3`
      
      const response = await fetch(osrmUrl)
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn('OSRM rate limit reached, returning original coordinates')
        } else {
          console.warn(`OSRM API error (${response.status}): ${response.statusText}`)
        }
        return coordinates
      }
      
      const data = await response.json()
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.warn('OSRM routing failed, returning original coordinates')
        return coordinates
      }
      
      // Choose the best route based on straightness and highway minimization
      let bestRoute = data.routes[0]
      if (data.routes.length > 1) {
        let bestScore = -Infinity
        const start = coordinates[0]
        const end = coordinates[coordinates.length - 1]
        
        for (const route of data.routes) {
          if (route.geometry && route.geometry.type === 'LineString' && route.geometry.coordinates) {
            const routeCoords = route.geometry.coordinates.map((coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0],
            }))
            const routeStraightness = calculateStraightness(routeCoords, start, end)
            const routeDistance = route.distance || Infinity
            let highwayPenalty = 1.0
            if (avoidHighways) {
              const highwayMetrics = calculateHighwayMetrics(route)
              const highwayDistanceKm = highwayMetrics.highwayDistance / 1000 // Convert to km
              
              // Penalize based on:
              // 1. Total highway distance (prefer shorter highway segments = quick crossings)
              // 2. Number of highway segments (prefer fewer crossings = more efficient)
              // Maximum penalty for long highway travel or many segments
              const distancePenalty = Math.min(1.0, 1.0 - (highwayDistanceKm * 0.5)) // 0.5 penalty per km of highway
              const segmentPenalty = Math.min(1.0, 1.0 - (highwayMetrics.highwaySegmentCount * 0.1)) // 0.1 penalty per segment
              highwayPenalty = Math.max(0.2, distancePenalty * segmentPenalty) // Combined penalty, minimum 0.2
            }
            const score = routeStraightness * (1 + 1 / (routeDistance / 1000 + 1)) * highwayPenalty
            
            if (score > bestScore) {
              bestScore = score
              bestRoute = route
            }
          }
        }
      }
      
      const geometry = bestRoute.geometry
      if (geometry.type === 'LineString' && geometry.coordinates) {
        const routeCoords = geometry.coordinates.map((coord: [number, number]) => ({
          lat: coord[1],
          lng: coord[0],
        }))
        // Remove redundant loops
        const loopFreeCoords = mergeRedundantEdges(routeCoords, 0.001)
        // Remove backtracking points (edges with ~180 degree bearing difference)
        const backtrackFreeCoords = removeBacktrackPoints(loopFreeCoords, 20)
        return backtrackFreeCoords
      }
      
      return optimizedCoordinates
    } catch (error) {
      console.error('Error snapping to roads:', error)
      return coordinates
    }
  }

  // Shape-preserving approach: route segment by segment
  // For running routes, we prefer straighter paths by using fewer intermediate points
  // and selecting the straightest route alternatives
  try {
    const allRoutePoints: Coordinate[] = []
    let consecutiveFailures = 0
    const maxFailures = 3
    
    // Process each edge of the polygon using optimized coordinates
    for (let i = 0; i < optimizedCoordinates.length; i++) {
      const start = optimizedCoordinates[i]
      const end = optimizedCoordinates[(i + 1) % optimizedCoordinates.length] // Wrap around for closed polygons
      
      // Calculate distance to determine if we need intermediate points
      const segmentDistance = distance(start, end)
      
      // Route directly between waypoints without adding intermediate points
      let waypoints: Coordinate[] = [start, end]
      
      // Route between each pair of consecutive waypoints
      for (let j = 0; j < waypoints.length - 1; j++) {
        const segmentStart = waypoints[j]
        const segmentEnd = waypoints[j + 1]
        
        try {
          // Route this segment with preference for straight paths and avoiding highways
          const segmentRoute = await routeBetweenPoints(segmentStart, segmentEnd, profile, true, avoidHighways)
          
          // Check if routing actually returned a route (not just start/end)
          if (segmentRoute.length > 2 || segmentRoute.length === 2) {
            // Add route points (skip first point if not the first segment to avoid duplicates)
            if (j === 0 && i === 0) {
              // First point of first segment
              allRoutePoints.push(...segmentRoute)
            } else {
              // Skip first point to avoid duplicate
              allRoutePoints.push(...segmentRoute.slice(1))
            }
            consecutiveFailures = 0
          } else {
            // If routing failed, add straight line
            if (j === 0 && i === 0) {
              allRoutePoints.push(segmentStart, segmentEnd)
            } else {
              allRoutePoints.push(segmentEnd)
            }
            consecutiveFailures++
          }
          
          // Reduced delay to avoid rate limiting (only between segments, not for last one)
          // Only add delay if we're making multiple requests in quick succession
          if (j < waypoints.length - 2 && waypoints.length > 2) {
            await new Promise(resolve => setTimeout(resolve, 50)) // Reduced from 100ms
          }
        } catch (error) {
          console.warn(`Error routing segment ${j}:`, error)
          consecutiveFailures++
          
          // If too many failures, fall back to straight line
          if (consecutiveFailures >= maxFailures) {
            console.warn('Too many routing failures, using straight line for remaining segments')
            if (j === 0 && i === 0) {
              allRoutePoints.push(segmentStart, segmentEnd)
            } else {
              allRoutePoints.push(segmentEnd)
            }
            break
          }
        }
      }
      
      // Reduced delay between polygon edges to speed up routing
      // Only delay if we have many edges to process
      if (i < optimizedCoordinates.length - 1 && optimizedCoordinates.length > 3) {
        await new Promise(resolve => setTimeout(resolve, 50)) // Reduced from 100ms
      }
    }
    
    // Remove duplicate consecutive points
    const cleanedPoints: Coordinate[] = []
    for (let i = 0; i < allRoutePoints.length; i++) {
      const current = allRoutePoints[i]
      const prev = cleanedPoints[cleanedPoints.length - 1]
      
      if (!prev || 
          Math.abs(current.lat - prev.lat) > 0.00001 || 
          Math.abs(current.lng - prev.lng) > 0.00001) {
        cleanedPoints.push(current)
      }
    }
    
    // Step 2: Remove redundant loops (cycles that lead back to themselves)
    const loopFreePoints = mergeRedundantEdges(cleanedPoints, 0.001) // ~111m threshold
    
    // Step 3: Remove backtracking points (edges with ~180 degree bearing difference)
    const backtrackFreePoints = removeBacktrackPoints(loopFreePoints, 20)
    
    return backtrackFreePoints.length > 0 ? backtrackFreePoints : optimizedCoordinates
  } catch (error) {
    console.error('Error snapping to roads with shape preservation:', error)
    return coordinates
  }
}

/**
 * Creates a route with coordinates snapped to roads
 * 
 * @param coordinates - Array of waypoint coordinates
 * @param options - Route options including routing profile
 * @returns Promise resolving to a Route with road-aligned coordinates
 */
export async function createRoadAlignedRoute(
  coordinates: Coordinate[],
  options?: {
    id?: string
    name?: string
    color?: string
    weight?: number
    opacity?: number
    profile?: 'driving' | 'walking' | 'cycling'
  }
): Promise<Route> {
  const snappedCoordinates = await snapToRoads(
    coordinates,
    options?.profile || 'walking'
  )
  
  return createRoute(snappedCoordinates, options)
}

/**
 * Validates that a route has valid coordinates
 */
export function isValidRoute(route: Route): boolean {
  return (
    route.coordinates &&
    Array.isArray(route.coordinates) &&
    route.coordinates.length >= 2 &&
    route.coordinates.every(
      coord =>
        typeof coord.lat === 'number' &&
        typeof coord.lng === 'number' &&
        coord.lat >= -90 &&
        coord.lat <= 90 &&
        coord.lng >= -180 &&
        coord.lng <= 180
    )
  )
}

/**
 * Calculates the approximate center point of a route
 */
export function getRouteCenter(route: Route): Coordinate {
  if (route.coordinates.length === 0) {
    return { lat: 34.0522, lng: -118.2437 } // Default to Los Angeles
  }

  const sumLat = route.coordinates.reduce((sum, coord) => sum + coord.lat, 0)
  const sumLng = route.coordinates.reduce((sum, coord) => sum + coord.lng, 0)

  return {
    lat: sumLat / route.coordinates.length,
    lng: sumLng / route.coordinates.length,
  }
}

