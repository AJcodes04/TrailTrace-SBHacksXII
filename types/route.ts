/**
 * Represents a geographic coordinate point (latitude, longitude)
 */
export interface Coordinate {
  lat: number
  lng: number
}

/**
 * Represents a running route as a collection of coordinates
 */
export interface Route {
  id?: string
  name?: string
  coordinates: Coordinate[]
  color?: string
  weight?: number
  opacity?: number
}

/**
 * Props for the RouteMap component
 */
export interface RouteMapProps {
  routes?: Route[]
  center?: Coordinate
  zoom?: number
  onRouteClick?: (route: Route) => void
}

