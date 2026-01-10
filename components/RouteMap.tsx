'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Route, Coordinate } from '@/types/route'

// Fix for default marker icons in Next.js/SSR
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

interface RouteMapProps {
  routes?: Route[]
  center?: Coordinate
  zoom?: number
  onRouteClick?: (route: Route) => void
}

/**
 * Component to handle map bounds updates when routes change
 */
function MapBoundsController({ routes }: { routes?: Route[] }) {
  const map = useMap()

  useEffect(() => {
    if (routes && routes.length > 0) {
      const allCoordinates: [number, number][] = routes.flatMap(route =>
        route.coordinates.map(coord => [coord.lat, coord.lng] as [number, number])
      )

      if (allCoordinates.length > 0) {
        const bounds = L.latLngBounds(allCoordinates)
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [routes, map])

  return null
}

/**
 * Interactive map component for rendering running routes in Southern California
 * 
 * Features:
 * - OpenStreetMap tile rendering
 * - Polyline route overlays
 * - Zoom and pan controls
 * - Auto-fit bounds when routes are provided
 * 
 * @param routes - Array of routes to display as polylines
 * @param center - Initial map center (defaults to Los Angeles area)
 * @param zoom - Initial zoom level (defaults to 10)
 * @param onRouteClick - Optional callback when a route is clicked
 */
export default function RouteMap({
  routes = [],
  center = { lat: 34.0522, lng: -118.2437 }, // Los Angeles area - center of Southern California
  zoom = 10,
  onRouteClick,
}: RouteMapProps) {
  // Default route color and style
  const defaultRouteStyle = {
    color: '#3b82f6', // Blue
    weight: 5,
    opacity: 0.8,
  }

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Render all routes as polylines */}
      {routes.map((route, index) => {
        const positions: [number, number][] = route.coordinates.map(coord => [coord.lat, coord.lng])
        
        return (
          <Polyline
            key={route.id || `route-${index}`}
            positions={positions}
            pathOptions={{
              color: route.color || defaultRouteStyle.color,
              weight: route.weight || defaultRouteStyle.weight,
              opacity: route.opacity || defaultRouteStyle.opacity,
            }}
            eventHandlers={{
              click: () => {
                if (onRouteClick) {
                  onRouteClick(route)
                }
              },
            }}
          />
        )
      })}

      {/* Auto-fit bounds when routes are provided */}
      {routes && routes.length > 0 && <MapBoundsController routes={routes} />}
    </MapContainer>
  )
}

