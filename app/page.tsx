'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { Route, Coordinate } from '@/types/route'
import { snapToRoads, snapToNearestRoad, snapMultipleToNearestRoad, optimizeWaypointOrder } from '@/utils/routeHelpers'

// Dynamically import the map component to avoid SSR issues with Leaflet
const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: '#f3f4f6',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #e5e7eb',
          borderTop: '3px solid #2563eb',
          borderRadius: '50%',
          margin: '0 auto 16px',
          animation: 'spin 1s linear infinite',
        }}></div>
        <p style={{ color: '#4b5563' }}>Loading map...</p>
      </div>
    </div>
  ),
})

/**
 * Example route demonstrating polyline rendering
 * This represents a simple running loop in the Los Angeles area
 */
const exampleRoute: Route = {
  id: 'example-route-1',
  name: 'Example Running Loop',
  coordinates: [
    { lat: 34.0522, lng: -118.2437 }, // Starting point (Downtown LA)
    { lat: 34.0622, lng: -118.2537 },
    { lat: 34.0722, lng: -118.2637 },
    { lat: 34.0692, lng: -118.2737 },
    { lat: 34.0592, lng: -118.2787 },
    { lat: 34.0492, lng: -118.2737 },
    { lat: 34.0422, lng: -118.2637 },
    { lat: 34.0452, lng: -118.2537 },
    { lat: 34.0522, lng: -118.2437 }, // Return to start
  ],
  color: '#3b82f6',
  weight: 5,
  opacity: 0.8,
}

export default function Home() {
  const [routes, setRoutes] = useState<Route[]>([exampleRoute])
  const [showExample, setShowExample] = useState(true)
  const [isSnappedToRoads, setIsSnappedToRoads] = useState(false)
  const [isSnapping, setIsSnapping] = useState(false)
  const [showWaypoints, setShowWaypoints] = useState(true)
  const [waypoints, setWaypoints] = useState<Coordinate[]>(exampleRoute.coordinates)
  const [draggableMode, setDraggableMode] = useState(false)
  const [showDebugVertices, setShowDebugVertices] = useState(false)
  const [currentVertexIndex, setCurrentVertexIndex] = useState<number | null>(null)
  
  // Keyboard navigation for vertices (a = previous, d = next)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if a route is shown and we're not typing in an input
      if (!showExample || routes.length === 0 || routes[0].coordinates.length === 0) {
        return
      }
      
      // Check if user is typing in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      const maxIndex = routes[0].coordinates.length - 1
      
      if (e.key === 'a' || e.key === 'A') {
        // Previous vertex
        if (currentVertexIndex === null) {
          setCurrentVertexIndex(maxIndex) // Start from last if none selected
        } else if (currentVertexIndex > 0) {
          setCurrentVertexIndex(currentVertexIndex - 1)
        }
      } else if (e.key === 'd' || e.key === 'D') {
        // Next vertex
        if (currentVertexIndex === null) {
          setCurrentVertexIndex(0) // Start from first if none selected
        } else if (currentVertexIndex < maxIndex) {
          setCurrentVertexIndex(currentVertexIndex + 1)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [showExample, routes, currentVertexIndex])
  
  // Update waypoints when example route changes and snap them to intersections
  useEffect(() => {
    if (showExample) {
      // Use batch snapping for better performance
      const snapWaypoints = async () => {
        const snappedWaypoints = await snapMultipleToNearestRoad(
          exampleRoute.coordinates,
          'walking',
          10 // Process 10 waypoints at a time
        )
        setWaypoints(snappedWaypoints)
        
        // Update the route with snapped waypoints
        const updatedRoute: Route = {
          ...exampleRoute,
          coordinates: snappedWaypoints,
        }
        setRoutes([updatedRoute])
      }
      snapWaypoints()
    }
  }, [showExample])

  const handleRouteClick = (route: Route) => {
    console.log('Route clicked:', route)
    // Future: Could show route details or allow interaction
  }

  const toggleExampleRoute = () => {
    if (showExample) {
      setRoutes([])
      setIsSnappedToRoads(false)
    } else {
      setRoutes([exampleRoute])
      setWaypoints(exampleRoute.coordinates)
      setIsSnappedToRoads(false)
    }
    setShowExample(!showExample)
  }

  // Debounce timer for waypoint moves to avoid excessive API calls
  const waypointMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleWaypointMove = async (index: number, newPosition: Coordinate) => {
    // Clear any pending snap operation
    if (waypointMoveTimeoutRef.current) {
      clearTimeout(waypointMoveTimeoutRef.current)
    }
    
    // Update waypoint position immediately for responsive UI
    const updatedWaypoints = [...waypoints]
    updatedWaypoints[index] = newPosition
    setWaypoints(updatedWaypoints)
    
    // Update route immediately with new position (straight line)
    const updatedRoute: Route = {
      ...exampleRoute,
      coordinates: updatedWaypoints,
    }
    setRoutes([updatedRoute])
    
    // Debounce the snapping and re-routing (wait 300ms after last move)
    waypointMoveTimeoutRef.current = setTimeout(async () => {
      // Snap the waypoint to the nearest road intersection
      const snappedPosition = await snapToNearestRoad(newPosition, 'walking', true)
      
      // Update with snapped position
      const finalWaypoints = [...waypoints]
      finalWaypoints[index] = snappedPosition
      setWaypoints(finalWaypoints)
      
      // If route is snapped to roads, re-route with snapped waypoints
      if (isSnappedToRoads) {
        setIsSnapping(true)
        try {
          const snappedCoords = await snapToRoads(finalWaypoints, 'walking')
          const snappedRoute: Route = {
            ...exampleRoute,
            coordinates: snappedCoords,
            name: exampleRoute.name + ' (Road-Aligned)',
          }
          setRoutes([snappedRoute])
        } catch (error) {
          console.error('Failed to re-route:', error)
        } finally {
          setIsSnapping(false)
        }
      } else {
        // Update route with snapped waypoints (straight lines)
        const finalRoute: Route = {
          ...exampleRoute,
          coordinates: finalWaypoints,
        }
        setRoutes([finalRoute])
      }
    }, 300) // 300ms debounce
  }

  const toggleRoadSnapping = async () => {
    if (isSnappedToRoads) {
      // Revert to original route
      const straightRoute: Route = {
        ...exampleRoute,
        coordinates: waypoints,
      }
      setRoutes([straightRoute])
      setIsSnappedToRoads(false)
    } else {
      // Snap to roads
      setIsSnapping(true)
      try {
        const snappedCoords = await snapToRoads(waypoints, 'walking')
        const snappedRoute: Route = {
          ...exampleRoute,
          coordinates: snappedCoords,
          name: exampleRoute.name + ' (Road-Aligned)',
        }
        setRoutes([snappedRoute])
        setIsSnappedToRoads(true)
      } catch (error) {
        console.error('Failed to snap to roads:', error)
        alert('Failed to snap route to roads. Please try again.')
      } finally {
        setIsSnapping(false)
      }
    }
  }

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
    }}>
      {/* Header */}
      <header style={{
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '4px',
            }}>TrailTrace</h1>
            <p style={{
              fontSize: '14px',
              color: '#4b5563',
            }}>Running Route Generator - Southern California</p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <button
              onClick={toggleExampleRoute}
              disabled={isSnapping}
              style={{
                padding: '8px 16px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isSnapping ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s',
                opacity: isSnapping ? 0.6 : 1,
              }}
              onMouseOver={(e) => !isSnapping && (e.currentTarget.style.background = '#1d4ed8')}
              onMouseOut={(e) => !isSnapping && (e.currentTarget.style.background = '#2563eb')}
            >
              {showExample ? 'Hide Example Route' : 'Show Example Route'}
            </button>
            {showExample && (
              <>
                <button
                  onClick={toggleRoadSnapping}
                  disabled={isSnapping}
                  style={{
                    padding: '8px 16px',
                    background: isSnappedToRoads ? '#10b981' : '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isSnapping ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                    opacity: isSnapping ? 0.6 : 1,
                  }}
                  onMouseOver={(e) => {
                    if (!isSnapping) {
                      e.currentTarget.style.background = isSnappedToRoads ? '#059669' : '#4b5563'
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSnapping) {
                      e.currentTarget.style.background = isSnappedToRoads ? '#10b981' : '#6b7280'
                    }
                  }}
                >
                  {isSnapping ? 'Snapping...' : isSnappedToRoads ? 'Show Straight Lines' : 'Snap to Roads'}
                </button>
                <button
                  onClick={() => setShowWaypoints(!showWaypoints)}
                  style={{
                    padding: '8px 16px',
                    background: showWaypoints ? '#ef4444' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = showWaypoints ? '#dc2626' : '#6b7280'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = showWaypoints ? '#ef4444' : '#9ca3af'
                  }}
                >
                  {showWaypoints ? 'Hide Waypoints' : 'Show Waypoints'}
                </button>
                <button
                  onClick={() => setDraggableMode(!draggableMode)}
                  disabled={!showWaypoints}
                  style={{
                    padding: '8px 16px',
                    background: draggableMode ? '#f59e0b' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: !showWaypoints ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                    opacity: !showWaypoints ? 0.5 : 1,
                  }}
                  onMouseOver={(e) => {
                    if (showWaypoints) {
                      e.currentTarget.style.background = draggableMode ? '#d97706' : '#6b7280'
                    }
                  }}
                  onMouseOut={(e) => {
                    if (showWaypoints) {
                      e.currentTarget.style.background = draggableMode ? '#f59e0b' : '#9ca3af'
                    }
                  }}
                >
                  {draggableMode ? 'Stop Moving Points' : 'Move Points'}
                </button>
                <button
                  onClick={() => setShowDebugVertices(!showDebugVertices)}
                  style={{
                    padding: '8px 16px',
                    background: showDebugVertices ? '#10b981' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = showDebugVertices ? '#059669' : '#6b7280'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = showDebugVertices ? '#10b981' : '#9ca3af'
                  }}
                >
                  {showDebugVertices ? 'Hide Vertices' : 'Show Vertices'}
                </button>
              </>
            )}
            <div style={{
              fontSize: '14px',
              color: '#4b5563',
            }}>
              Routes: <span style={{ fontWeight: '600' }}>{routes.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Map Container */}
      <div style={{
        flex: 1,
        position: 'relative',
      }}>
        <RouteMap
          routes={routes}
          waypoints={showExample ? waypoints : []}
          center={{ lat: 34.0522, lng: -118.2437 }}
          zoom={11}
          onRouteClick={handleRouteClick}
          showWaypoints={showWaypoints}
          draggableMode={draggableMode && showWaypoints}
          onWaypointMove={handleWaypointMove}
          showDebugVertices={showDebugVertices}
          currentVertexIndex={currentVertexIndex}
        />
      </div>

      {/* Info Panel */}
      <div style={{
        background: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        padding: '12px 24px',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '14px',
          color: '#4b5563',
        }}>
          <div>
            <span style={{ fontWeight: '500' }}>Map Provider:</span> OpenStreetMap
            <span style={{ margin: '0 8px' }}>•</span>
            <span style={{ fontWeight: '500' }}>Region:</span> Southern California
          </div>
          <div>
            Click on a route to interact • Use mouse wheel to zoom • Drag to pan • Click "Move Points" to drag waypoints • Press <strong>A</strong> (prev) / <strong>D</strong> (next) to navigate vertices
          </div>
        </div>
      </div>
    </main>
  )
}

