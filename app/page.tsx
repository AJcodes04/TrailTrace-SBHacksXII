'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Route, Coordinate } from '@/types/route'
import { snapToRoads } from '@/utils/routeHelpers'

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
    { lat: 34.0522, lng: -118.2437 }, // Starting point
    { lat: 34.0620, lng: -118.2500 },
    { lat: 34.0700, lng: -118.2600 },
    { lat: 34.0680, lng: -118.2700 },
    { lat: 34.0580, lng: -118.2750 },
    { lat: 34.0480, lng: -118.2700 },
    { lat: 34.0420, lng: -118.2600 },
    { lat: 34.0450, lng: -118.2500 },
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
  
  // Update waypoints when example route changes
  useEffect(() => {
    if (showExample) {
      setWaypoints(exampleRoute.coordinates)
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

  const handleWaypointMove = async (index: number, newPosition: Coordinate) => {
    // Update the waypoint position
    const updatedWaypoints = [...waypoints]
    updatedWaypoints[index] = newPosition
    setWaypoints(updatedWaypoints)
    
    // If route is snapped to roads, re-route with new waypoints
    if (isSnappedToRoads) {
      setIsSnapping(true)
      try {
        const snappedCoords = await snapToRoads(updatedWaypoints, 'walking')
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
      // Update route with new waypoints (straight lines)
      const updatedRoute: Route = {
        ...exampleRoute,
        coordinates: updatedWaypoints,
      }
      setRoutes([updatedRoute])
    }
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
          zoom={10}
          onRouteClick={handleRouteClick}
          showWaypoints={showWaypoints}
          onWaypointMove={handleWaypointMove}
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
            Click on a route to interact • Use mouse wheel to zoom • Drag to pan • Hold Shift and drag waypoints to move them
          </div>
        </div>
      </div>
    </main>
  )
}

