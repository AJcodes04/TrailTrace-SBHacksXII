'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import type { Route, Coordinate } from '@/types/route'
import { snapToRoads, snapToNearestRoad, snapMultipleToNearestRoad, optimizeWaypointOrder } from '@/utils/routeHelpers'
import DrawingCanvas from '@/components/DrawingCanvas'

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
    { lat: 34.0620, lng: -118.2500 },
    { lat: 34.0720, lng: -118.2600 },
    { lat: 34.0700, lng: -118.2700 },
    { lat: 34.0600, lng: -118.2750 },
    { lat: 34.0500, lng: -118.2700 },
    { lat: 34.0450, lng: -118.2600 },
    { lat: 34.0480, lng: -118.2500 },
    { lat: 34.0522, lng: -118.2437 }, // Return to start
  ],
  color: '#3b82f6',
  weight: 5,
  opacity: 0.8,
}

export default function MapPage() {
  const [routes, setRoutes] = useState<Route[]>([exampleRoute])
  const [showExample, setShowExample] = useState(true)
  const [isSnappedToRoads, setIsSnappedToRoads] = useState(false)
  const [isSnapping, setIsSnapping] = useState(false)
  const [showWaypoints, setShowWaypoints] = useState(true)
  const [waypoints, setWaypoints] = useState<Coordinate[]>(exampleRoute.coordinates)
  const [draggableMode, setDraggableMode] = useState(false)
  const [drawingMode, setDrawingMode] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (!darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  
  // Define the geographic area for route generation (Los Angeles area)
  const mapBounds = {
    center: { lat: 34.0522, lng: -118.2437 }, // Los Angeles center
    // Rough bounding box around Los Angeles area
    north: 34.15,
    south: 33.95,
    east: -118.15,
    west: -118.35,
  }
  
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

  // Convert canvas coordinates to geographic coordinates
  const canvasToGeographic = (canvasPoints: Array<{ x: number; y: number }>, canvasWidth: number, canvasHeight: number): Coordinate[] => {
    const latRange = mapBounds.north - mapBounds.south
    const lngRange = mapBounds.east - mapBounds.west

    return canvasPoints.map(point => {
      // Convert canvas coordinates (0 to width/height) to normalized (0 to 1)
      const normalizedX = point.x / canvasWidth
      const normalizedY = 1 - (point.y / canvasHeight) // Flip Y axis (canvas Y increases downward)

      // Map to geographic coordinates
      const lat = mapBounds.south + normalizedY * latRange
      const lng = mapBounds.west + normalizedX * lngRange

      return { lat, lng }
    })
  }

  // Handle canvas drawing completion
  const handleCanvasDrawingComplete = async (canvasPoints: Array<{ x: number; y: number }>) => {
    if (canvasPoints.length < 2) {
      alert('Please draw a route with at least 2 points')
      return
    }

    setIsSnapping(true)

    try {
      // Convert canvas coordinates to geographic coordinates
      const geographicWaypoints = canvasToGeographic(canvasPoints, 400, 400)

      // Route the waypoints through OSRM
      const snappedCoords = await snapToRoads(geographicWaypoints, 'walking', true, true)
      
      const newRoute: Route = {
        id: `route-${Date.now()}`,
        name: 'Drawn Route',
        coordinates: snappedCoords,
        color: '#f97316', // TrailTrace orange
        weight: 5,
        opacity: 0.8,
      }

      // Add the new route to the routes array
      setRoutes([...routes, newRoute])
      setShowExample(false) // Hide example route if showing
      setShowCanvas(false) // Close canvas after route generation
    } catch (error) {
      console.error('Failed to generate route from drawing:', error)
      alert('Failed to generate route. Please try again.')
    } finally {
      setIsSnapping(false)
    }
  }

  // Legacy handler for map drawing (keep for now)
  const handleDrawingComplete = async (coordinates: Coordinate[]) => {
    if (coordinates.length < 2) {
      alert('Please draw a route with at least 2 points')
      return
    }

    setIsSnapping(true)
    setDrawingMode(false) // Exit drawing mode

    try {
      // Route the drawn coordinates through OSRM
      const snappedCoords = await snapToRoads(coordinates, 'walking', true, true)
      
      const newRoute: Route = {
        id: `route-${Date.now()}`,
        name: 'Drawn Route',
        coordinates: snappedCoords,
        color: '#f97316', // TrailTrace orange
        weight: 5,
        opacity: 0.8,
      }

      // Add the new route to the routes array
      setRoutes([...routes, newRoute])
      setShowExample(false) // Hide example route if showing
    } catch (error) {
      console.error('Failed to generate route from drawing:', error)
      alert('Failed to generate route. Please try again.')
    } finally {
      setIsSnapping(false)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem('trailtrace_auth')
    window.location.href = '/'
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="flex flex-col lg:flex-row bg-stone-50 dark:bg-forest-900 text-forest-900 dark:text-stone-50 h-screen">
        {/* Sidebar - Fixed on desktop */}
        <aside className="w-full lg:w-64 lg:h-screen lg:sticky lg:top-0 bg-white dark:bg-forest-800 border-b lg:border-b-0 lg:border-r border-forest-200 dark:border-forest-700 flex flex-col z-50">
          {/* Logo */}
          <div className="p-6 border-b border-forest-200 dark:border-forest-700">
            <div className="relative w-32 h-16 mb-3">
              <Image
                src="/images/logo.png"
                alt="TrailTrace Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-sm text-forest-600 dark:text-forest-300 font-medium">
              Draw your path. Run your route.
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button
              onClick={() => setShowCanvas(!showCanvas)}
              disabled={isSnapping}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                showCanvas
                  ? 'bg-orange-accent text-white'
                  : 'hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200'
              } ${isSnapping ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {showCanvas ? 'Close Canvas' : 'Draw Route'}
            </button>
            <button
              onClick={toggleExampleRoute}
              disabled={isSnapping || drawingMode}
              className={`w-full text-left px-4 py-2 rounded-lg hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200 transition-colors ${
                isSnapping || drawingMode ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {showExample ? 'Hide Example Route' : 'Show Example Route'}
            </button>
            {showExample && (
              <>
                <button
                  onClick={toggleRoadSnapping}
                  disabled={isSnapping}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    isSnappedToRoads
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200'
                  } ${isSnapping ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {isSnapping ? 'Snapping...' : isSnappedToRoads ? 'Show Straight Lines' : 'Snap to Roads'}
                </button>
                <button
                  onClick={() => setShowWaypoints(!showWaypoints)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    showWaypoints
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200'
                  }`}
                >
                  {showWaypoints ? 'Hide Waypoints' : 'Show Waypoints'}
                </button>
                <button
                  onClick={() => setDraggableMode(!draggableMode)}
                  disabled={!showWaypoints}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    draggableMode
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200'
                  } ${!showWaypoints ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {draggableMode ? 'Stop Moving Points' : 'Move Points'}
                </button>
              </>
            )}
            <div className="px-4 py-2 text-sm text-forest-600 dark:text-forest-300">
              Routes: <span className="font-semibold">{routes.length}</span>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-forest-200 dark:border-forest-700 space-y-4">
            <button
              onClick={toggleDarkMode}
              className="w-full px-4 py-2 rounded-lg bg-forest-100 dark:bg-forest-700 hover:bg-forest-200 dark:hover:bg-forest-600 text-forest-700 dark:text-forest-200 transition-colors text-sm"
            >
              {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
            </button>
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors text-sm font-semibold"
            >
              Sign Out
            </button>
            <div className="flex space-x-4 justify-center">
              <a href="#" className="text-forest-400 hover:text-orange-accent transition-colors">Twitter</a>
              <a href="#" className="text-forest-400 hover:text-orange-accent transition-colors">GitHub</a>
            </div>
            <p className="text-xs text-center text-forest-500 dark:text-forest-400">
              SB Hacks - 2026
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 relative flex overflow-hidden">
            {/* Drawing Canvas Sidebar */}
            {showCanvas && (
              <div className="w-full lg:w-[450px] bg-white dark:bg-forest-800 border-r border-forest-200 dark:border-forest-700 p-6 overflow-y-auto shadow-lg z-10">
                <h2 className="text-xl font-bold text-forest-900 dark:text-white mb-4">
                  Draw Your Route
                </h2>
                <p className="text-sm text-forest-600 dark:text-forest-300 mb-6">
                  Draw any shape on the canvas. We&apos;ll generate waypoints and create a route in the Los Angeles area.
                </p>
                <DrawingCanvas
                  onDrawingComplete={handleCanvasDrawingComplete}
                  width={400}
                  height={400}
                />
              </div>
            )}

            {/* Map Container */}
            <div className="flex-1 relative">
              <RouteMap
                routes={routes}
                waypoints={showExample ? waypoints : []}
                center={{ lat: 34.0522, lng: -118.2437 }}
                zoom={10}
                onRouteClick={handleRouteClick}
                showWaypoints={showWaypoints && !drawingMode}
                draggableMode={draggableMode && showWaypoints && !drawingMode}
                onWaypointMove={handleWaypointMove}
                enableDrawing={drawingMode}
                onDrawingComplete={handleDrawingComplete}
              />
            </div>
          </div>

          {/* Info Panel */}
          <div className="bg-white/50 dark:bg-forest-800/50 backdrop-blur-sm border-t border-forest-200 dark:border-forest-700 px-6 py-3 z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-forest-600 dark:text-forest-300 gap-2">
              <div>
                <span className="font-semibold">Map Provider:</span> OpenStreetMap
                <span className="mx-2">•</span>
                <span className="font-semibold">Region:</span> Southern California
              </div>
              <div className="text-xs sm:text-sm">
                Click on a route to interact • Use mouse wheel to zoom • Drag to pan • Click &quot;Move Points&quot; to drag waypoints
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

