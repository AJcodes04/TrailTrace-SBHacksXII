'use client'

import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Route, Coordinate } from '@/types/route'

/**
 * Calculate distance between two coordinates using Haversine formula (in kilometers)
 */
function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
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
 * Calculate bearing (direction) from coord1 to coord2 in degrees
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
  waypoints?: Coordinate[] // Original waypoints to display as markers
  center?: Coordinate
  zoom?: number
  onRouteClick?: (route: Route) => void
  showWaypoints?: boolean // Toggle to show/hide waypoint markers
  draggableMode?: boolean // Enable/disable waypoint dragging
  onWaypointMove?: (index: number, newPosition: Coordinate) => void // Callback when a waypoint is moved
  showDebugVertices?: boolean // Debug: Show all route vertices as small markers
  currentVertexIndex?: number | null // Index of currently selected vertex for navigation
}

/**
 * Component for draggable waypoint markers
 */
function DraggableWaypointMarker({
  waypoint,
  index,
  draggableMode,
  waypointIcon,
  draggableWaypointIcon,
  onWaypointMove,
}: {
  waypoint: Coordinate
  index: number
  draggableMode: boolean
  waypointIcon: L.DivIcon
  draggableWaypointIcon: L.DivIcon
  onWaypointMove?: (index: number, newPosition: Coordinate) => void
}) {
  const [position, setPosition] = useState<[number, number]>([waypoint.lat, waypoint.lng])

  useEffect(() => {
    setPosition([waypoint.lat, waypoint.lng])
  }, [waypoint])

  return (
    <Marker
      position={position}
      icon={draggableMode ? draggableWaypointIcon : waypointIcon}
      draggable={draggableMode}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target
          const newPosition = marker.getLatLng()
          const newCoord: Coordinate = {
            lat: newPosition.lat,
            lng: newPosition.lng,
          }
          setPosition([newCoord.lat, newCoord.lng])
          if (onWaypointMove) {
            onWaypointMove(index, newCoord)
          }
        },
      }}
    >
      <Popup>
        <div style={{ minWidth: '150px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            Waypoint {index + 1}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {waypoint.lat.toFixed(6)}, {waypoint.lng.toFixed(6)}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

/**
 * Component to handle map bounds updates when routes or waypoints change
 */
function MapBoundsController({ routes, waypoints }: { routes?: Route[], waypoints?: Coordinate[] }) {
  const map = useMap()

  useEffect(() => {
    const allCoordinates: [number, number][] = []
    
    // Add route coordinates
    if (routes && routes.length > 0) {
      routes.forEach(route => {
        route.coordinates.forEach(coord => {
          allCoordinates.push([coord.lat, coord.lng])
        })
      })
    }
    
    // Add waypoint coordinates
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach(waypoint => {
        allCoordinates.push([waypoint.lat, waypoint.lng])
      })
    }

    if (allCoordinates.length > 0) {
      const bounds = L.latLngBounds(allCoordinates)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [routes, waypoints, map])

  return null
}

/**
 * Component to zoom to a specific vertex when currentVertexIndex changes
 */
function VertexZoomController({ 
  routes, 
  currentVertexIndex 
}: { 
  routes?: Route[]
  currentVertexIndex: number | null 
}) {
  const map = useMap()

  useEffect(() => {
    if (currentVertexIndex !== null && currentVertexIndex !== undefined && routes && routes.length > 0) {
      const route = routes[0]
      if (currentVertexIndex >= 0 && currentVertexIndex < route.coordinates.length) {
        const vertex = route.coordinates[currentVertexIndex]
        map.setView([vertex.lat, vertex.lng], 16, { animate: true })
      }
    }
  }, [currentVertexIndex, routes, map])

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
  waypoints = [],
  center = { lat: 34.0522, lng: -118.2437 }, // Los Angeles area - center of Southern California
  zoom = 10,
  onRouteClick,
  showWaypoints = true,
  draggableMode = false,
  onWaypointMove,
  showDebugVertices = false,
  currentVertexIndex = null,
}: RouteMapProps) {
  
  // Default route color and style
  const defaultRouteStyle = {
    color: '#3b82f6', // Blue
    weight: 5,
    opacity: 0.8,
  }

  // Create custom icons for waypoints (normal and draggable states)
  const waypointIcon = L.divIcon({
    className: 'waypoint-marker',
    html: `<div style="
      width: 16px;
      height: 16px;
      background: #ef4444;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: move;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

  const draggableWaypointIcon = L.divIcon({
    className: 'waypoint-marker-draggable',
    html: `<div style="
      width: 18px;
      height: 18px;
      background: #dc2626;
      border: 3px solid #fbbf24;
      border-radius: 50%;
      box-shadow: 0 3px 6px rgba(0,0,0,0.4);
      cursor: move;
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

  // Debug: Small icon for route vertices
  const debugVertexIcon = L.divIcon({
    className: 'debug-vertex-marker',
    html: `<div style="
      width: 4px;
      height: 4px;
      background: #10b981;
      border: 1px solid white;
      border-radius: 50%;
    "></div>`,
    iconSize: [4, 4],
    iconAnchor: [2, 2],
  })

  // Highlighted vertex icon (larger, different color)
  const highlightedVertexIcon = L.divIcon({
    className: 'highlighted-vertex-marker',
    html: `<div style="
      width: 16px;
      height: 16px;
      background: #f59e0b;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.6);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

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

      {/* Render waypoint markers */}
      {showWaypoints && waypoints.map((waypoint, index) => (
        <DraggableWaypointMarker
          key={`waypoint-${index}`}
          waypoint={waypoint}
          index={index}
          draggableMode={draggableMode}
          waypointIcon={waypointIcon}
          draggableWaypointIcon={draggableWaypointIcon}
          onWaypointMove={onWaypointMove}
        />
      ))}

      {/* Render all routes as polylines */}
      {routes.map((route, index) => {
        const positions: [number, number][] = route.coordinates.map(coord => [coord.lat, coord.lng])
        
        return (
          <React.Fragment key={route.id || `route-${index}`}>
            <Polyline
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
            {/* Debug: Render all route vertices as small markers */}
            {showDebugVertices && route.coordinates.map((coord, vertexIndex) => {
              // Calculate edge information for this vertex
              const prevIndex = vertexIndex > 0 ? vertexIndex - 1 : route.coordinates.length - 1
              const nextIndex = (vertexIndex + 1) % route.coordinates.length
              const prevCoord = route.coordinates[prevIndex]
              const nextCoord = route.coordinates[nextIndex]
              
              // Calculate distances (Haversine formula)
              const distanceToPrev = calculateDistance(prevCoord, coord)
              const distanceToNext = calculateDistance(coord, nextCoord)
              
              // Calculate bearings (directions)
              const bearingFromPrev = calculateBearing(prevCoord, coord)
              const bearingToNext = calculateBearing(coord, nextCoord)
              
              // Use highlighted icon if this is the current vertex
              const isCurrentVertex = currentVertexIndex !== null && vertexIndex === currentVertexIndex
              const iconToUse = isCurrentVertex ? highlightedVertexIcon : debugVertexIcon
              
              return (
                <Marker
                  key={`vertex-${index}-${vertexIndex}`}
                  position={[coord.lat, coord.lng]}
                  icon={iconToUse}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                        Vertex {vertexIndex + 1} / {route.coordinates.length}
                        {isCurrentVertex && (
                          <span style={{ 
                            marginLeft: '8px', 
                            color: '#f59e0b',
                            fontSize: '12px'
                          }}>● Current</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', marginBottom: '8px', color: '#6b7280' }}>
                        {coord.lat.toFixed(6)}, {coord.lng.toFixed(6)}
                      </div>
                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Edges:</div>
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#6b7280' }}>From Vertex {prevIndex + 1}:</span><br/>
                          <span style={{ marginLeft: '8px' }}>
                            Distance: {distanceToPrev.toFixed(2)} km<br/>
                            Bearing: {bearingFromPrev.toFixed(1)}°
                          </span>
                        </div>
                        <div style={{ fontSize: '12px' }}>
                          <span style={{ color: '#6b7280' }}>To Vertex {nextIndex + 1}:</span><br/>
                          <span style={{ marginLeft: '8px' }}>
                            Distance: {distanceToNext.toFixed(2)} km<br/>
                            Bearing: {bearingToNext.toFixed(1)}°
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </React.Fragment>
        )
      })}

      {/* Auto-fit bounds when routes or waypoints are provided */}
      {(routes.length > 0 || waypoints.length > 0) && (
        <MapBoundsController routes={routes} waypoints={waypoints} />
      )}

      {/* Zoom to current vertex when index changes */}
      {currentVertexIndex !== null && (
        <VertexZoomController routes={routes} currentVertexIndex={currentVertexIndex} />
      )}
    </MapContainer>
  )
}
