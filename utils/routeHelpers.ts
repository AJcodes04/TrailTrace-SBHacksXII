import type { Route, Coordinate } from '@/types/route'

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
    return { lat: 34.0522, lng: -118.2437 } // Default to LA
  }

  const sumLat = route.coordinates.reduce((sum, coord) => sum + coord.lat, 0)
  const sumLng = route.coordinates.reduce((sum, coord) => sum + coord.lng, 0)

  return {
    lat: sumLat / route.coordinates.length,
    lng: sumLng / route.coordinates.length,
  }
}

