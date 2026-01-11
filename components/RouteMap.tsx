'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
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
  waypoints?: Coordinate[] // Original waypoints to display as markers
  center?: Coordinate
  zoom?: number
  onRouteClick?: (route: Route) => void
  showWaypoints?: boolean // Toggle to show/hide waypoint markers
  draggableMode?: boolean // Enable/disable waypoint dragging
  onWaypointMove?: (index: number, newPosition: Coordinate) => void // Callback when a waypoint is moved
  enableDrawing?: boolean // Enable drawing mode
  onDrawingComplete?: (coordinates: Coordinate[]) => void // Callback when user finishes drawing
}


/**
 * Draggable waypoint marker component
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
  const [position, setPosition] = useState([waypoint.lat, waypoint.lng] as [number, number])
  const markerRef = useRef<L.Marker>(null)
  
  // Update position when waypoint prop changes
  useEffect(() => {
    setPosition([waypoint.lat, waypoint.lng])
  }, [waypoint])
  
  // Make marker draggable based on draggableMode prop
  useEffect(() => {
    const marker = markerRef.current
    if (marker) {
      if (draggableMode) {
        marker.dragging?.enable()
      } else {
        marker.dragging?.disable()
      }
    }
  }, [draggableMode])
  
  return (
    <Marker
      ref={markerRef}
      position={position}
              icon={draggableMode ? draggableWaypointIcon : waypointIcon}
              draggable={draggableMode}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target
          if (marker) {
            const newPosition = marker.getLatLng()
            const newCoord: Coordinate = {
              lat: newPosition.lat,
              lng: newPosition.lng,
            }
            setPosition([newCoord.lat, newCoord.lng])
            if (onWaypointMove) {
              onWaypointMove(index, newCoord)
            }
          }
        },
      }}
    >
      <Popup>
        <div style={{ textAlign: 'center' }}>
          <strong>Waypoint {index + 1}</strong>
          <br />
          <small>
            {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </small>
          {draggableMode && (
            <>
              <br />
              <small style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                Drag to move
              </small>
            </>
          )}
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
 * Component to handle drawing on the map using Leaflet Draw
 */
function DrawingController({ 
  enableDrawing, 
  onDrawingComplete 
}: { 
  enableDrawing?: boolean
  onDrawingComplete?: (coordinates: Coordinate[]) => void 
}) {
  const map = useMap()
  const drawControlRef = useRef<L.Control.Draw | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup())

  useEffect(() => {
    if (!enableDrawing || !onDrawingComplete) return

    // Add drawn items layer to map
    const drawnItems = drawnItemsRef.current
    drawnItems.addTo(map)

    // Configure draw control - only allow polylines for route drawing
    const drawControl = new (L.Control as any).Draw({
      draw: {
        polyline: {
          shapeOptions: {
            color: '#f97316', // TrailTrace orange
            weight: 4,
          },
          allowIntersection: true,
          showLength: true,
        },
        polygon: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    })

    drawControlRef.current = drawControl
    map.addControl(drawControl)

    // Handle drawing completion
    const handleDrawCreated = (e: any) => {
      const layer = e.layer
      const geoJSON = layer.toGeoJSON()

      // Extract coordinates from the drawn polyline
      if (geoJSON.geometry.type === 'LineString' && geoJSON.geometry.coordinates) {
        const coordinates: Coordinate[] = geoJSON.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => ({
            lat,
            lng,
          })
        )

        // Call callback with coordinates
        onDrawingComplete(coordinates)

        // Remove the drawn layer (we'll display the routed version instead)
        map.removeLayer(layer)
      }
    }

    // Handle draw deletion
    const handleDrawDeleted = () => {
      drawnItems.clearLayers()
    }

    map.on((L.Draw as any).Event.CREATED, handleDrawCreated)
    map.on((L.Draw as any).Event.DELETED, handleDrawDeleted)

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current)
      }
      map.off((L.Draw as any).Event.CREATED, handleDrawCreated)
      map.off((L.Draw as any).Event.DELETED, handleDrawDeleted)
      map.removeLayer(drawnItems)
    }
  }, [map, enableDrawing, onDrawingComplete])

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
  center = { lat: 34.4208, lng: -119.6982 }, // Santa Barbara area - center of Southern California
  zoom = 10,
  onRouteClick,
  showWaypoints = true,
  draggableMode = false,
  onWaypointMove,
  enableDrawing = false,
  onDrawingComplete,
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

      {/* Auto-fit bounds when routes or waypoints are provided */}
      {(routes.length > 0 || waypoints.length > 0) && (
        <MapBoundsController routes={routes} waypoints={waypoints} />
      )}

      {/* Drawing controller */}
      {enableDrawing && (
        <DrawingController 
          enableDrawing={enableDrawing}
          onDrawingComplete={onDrawingComplete}
        />
      )}
    </MapContainer>
  )
}

