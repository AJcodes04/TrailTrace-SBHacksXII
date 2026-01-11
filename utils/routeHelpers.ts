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
 * Smooths a path by removing small protrusions and unnecessary points
 * Removes points that create small deviations from the overall path direction
 * 
 * @param coordinates - Array of coordinates to smooth
 * @param maxDeviation - Maximum allowed deviation in km before removing a point (default: 0.02km = 20m)
 * @returns Smoothed array of coordinates
 */
function smoothPath(
  coordinates: Coordinate[],
  maxDeviation: number = 0.02 // 20 meters
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
    const deviation = perpendicularDistance(current, prev, next)
    
    // If deviation is small, skip this point (it's a small protrusion)
    if (deviation < maxDeviation) {
      continue
    }
    
    // Check if the angle is too sharp (indicates a protrusion)
    const angle = calculateAngle(prev, current, next)
    
    // If angle is very sharp (< 30 degrees) and deviation is small, it's likely a protrusion
    if (angle < 30 && deviation < maxDeviation * 2) {
      continue
    }
    
    smoothed.push(current)
  }
  
  // Always keep last point
  smoothed.push(coordinates[coordinates.length - 1])
  
  return smoothed
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
  maxSegmentLength: number = 0.1
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
 * Checks if a route contains highways by examining route steps
 * Highways include: motorway, motorway_link, trunk, trunk_link
 * Also checks for common highway indicators in road names
 */
function routeContainsHighways(route: {
  legs?: Array<{
    steps?: Array<{
      name?: string
      driving_side?: string
      mode?: string
      ref?: string
    }>
  }>
}): boolean {
  if (!route.legs || !Array.isArray(route.legs)) {
    return false // Can't determine without steps
  }
  
  // Highway type keywords
  const highwayTypes = ['motorway', 'motorway_link', 'trunk', 'trunk_link']
  
  // Common highway indicators in road names
  const highwayIndicators = [
    'highway', 'freeway', 'interstate', 'i-', 'i ', 'us-', 'us ', 
    'state route', 'sr-', 'parkway', 'expressway', 'turnpike'
  ]
  
  for (const leg of route.legs) {
    if (leg.steps && Array.isArray(leg.steps)) {
      for (const step of leg.steps) {
        const name = (step.name || '').toLowerCase()
        const ref = (step.ref || '').toLowerCase()
        const combined = `${name} ${ref}`
        
        // Check for highway type keywords
        if (highwayTypes.some(type => combined.includes(type))) {
          return true
        }
        
        // Check for highway indicators in names/refs
        // Interstate highways (I-5, I-10, etc.)
        if (/^i-?\d+/.test(ref) || /^i-?\d+/.test(name)) {
          return true
        }
        
        // US highways (US-101, US 101, etc.)
        if (/^us-?\d+/.test(ref) || /^us-?\d+/.test(name)) {
          return true
        }
        
        // Check for other highway indicators
        if (highwayIndicators.some(indicator => combined.includes(indicator))) {
          return true
        }
      }
    }
  }
  
  return false
}

/**
 * Routes between two coordinates using OSRM, preferring straighter paths
 * For running routes, we want more direct paths and avoid highways
 */
async function routeBetweenPoints(
  start: Coordinate,
  end: Coordinate,
  profile: 'driving' | 'walking' | 'cycling',
  preferStraight: boolean = true,
  avoidHighways: boolean = true
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
    
    // Filter and select the best route
    // First, filter out routes with highways if avoidHighways is true
    let candidateRoutes = data.routes
    if (avoidHighways) {
      candidateRoutes = candidateRoutes.filter((route: any) => !routeContainsHighways(route))
      // If all routes contain highways, fall back to all routes (better than no route)
      if (candidateRoutes.length === 0) {
        console.warn('All routes contain highways, using best available route')
        candidateRoutes = data.routes
      }
    }
    
    // If we have multiple routes, choose the best one based on straightness
    let bestRoute = candidateRoutes[0]
    if (preferStraight && candidateRoutes.length > 1) {
      let bestScore = 0
      
      for (const route of candidateRoutes) {
        if (route.geometry && route.geometry.type === 'LineString' && route.geometry.coordinates) {
          const routeCoords = route.geometry.coordinates.map((coord: [number, number]) => ({
            lat: coord[1],
            lng: coord[0],
          }))
          const routeStraightness = calculateStraightness(routeCoords, start, end)
          
          // Prefer routes that are straighter (higher ratio)
          // Also slightly prefer shorter routes for the same straightness
          // Penalize routes with highways if avoidHighways is true
          const routeDistance = route.distance || Infinity
          const hasHighways = avoidHighways && routeContainsHighways(route)
          const highwayPenalty = hasHighways ? 0.5 : 1.0 // Heavy penalty for highways
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
      // Smooth the route to remove small protrusions
      return smoothPath(routeCoords)
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
      // Apply smoothing to waypoint positions after optimization
      optimizedCoordinates = smoothPath(optimizedCoordinates, 0.03) // 30m smoothing threshold
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
      
      // Filter out routes with highways if avoidHighways is true
      let candidateRoutes = data.routes
      if (avoidHighways) {
        candidateRoutes = candidateRoutes.filter((route: any) => !routeContainsHighways(route))
        if (candidateRoutes.length === 0) {
          console.warn('All routes contain highways, using best available route')
          candidateRoutes = data.routes
        }
      }
      
      // Choose the straightest route if multiple alternatives are available
      let bestRoute = candidateRoutes[0]
      if (candidateRoutes.length > 1) {
        let bestScore = 0
        const start = coordinates[0]
        const end = coordinates[coordinates.length - 1]
        
        for (const route of candidateRoutes) {
          if (route.geometry && route.geometry.type === 'LineString' && route.geometry.coordinates) {
            const routeCoords = route.geometry.coordinates.map((coord: [number, number]) => ({
              lat: coord[1],
              lng: coord[0],
            }))
            const routeStraightness = calculateStraightness(routeCoords, start, end)
            const routeDistance = route.distance || Infinity
            const hasHighways = avoidHighways && routeContainsHighways(route)
            const highwayPenalty = hasHighways ? 0.5 : 1.0
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
        // Apply smoothing after routing
        return smoothPath(routeCoords)
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
      
      // For running routes, use fewer intermediate points to allow for more direct routing
      // Only add intermediate points for very long segments
      let waypoints: Coordinate[]
      if (segmentDistance > 0.5) { // Only if segment is longer than 500m (increased threshold)
        waypoints = addIntermediatePoints(start, end, 0.3) // ~300m segments (longer segments)
      } else {
        waypoints = [start, end] // Route directly for shorter segments
      }
      
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
    
    // Step 2: Apply smoothing after Dijkstra's optimization and routing
    // This removes small protrusions and smooths the final path
    const smoothedPoints = smoothPath(cleanedPoints, 0.02) // 20m smoothing threshold
    
    return smoothedPoints.length > 0 ? smoothedPoints : optimizedCoordinates
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

