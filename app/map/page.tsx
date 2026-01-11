'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { Route, Coordinate } from '@/types/route'
import { snapToRoads } from '@/utils/routeHelpers'
import { canvasToGeographicFromStartPoint } from '@/utils/drawingHelpers'
import DrawingCanvas from '@/components/DrawingCanvas'
import Header from '@/components/Header'
import { auth } from '@/lib/firebaseClient'
import { onAuthStateChanged } from 'firebase/auth'

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
  const router = useRouter()
  const [routes, setRoutes] = useState<Route[]>([])
  const [isSnapping, setIsSnapping] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [pendingCanvasPoints, setPendingCanvasPoints] = useState<Array<{ x: number; y: number }> | null>(null)
  const [selectingStartPoint, setSelectingStartPoint] = useState(false)
  const [selectedStartPoint, setSelectedStartPoint] = useState<Coordinate | null>(null)

  // Check authentication status
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
        router.push('/login')
      }
      setAuthLoading(false)
    })
    return () => unsub()
  }, [router])

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

  const handleRouteClick = (route: Route) => {
    console.log('Route clicked:', route)
    setCurrentRoute(route)
  }

  const handleSaveRoute = () => {
    if (!currentRoute) {
      alert('No route to save. Please draw a route first.')
      return
    }
    // TODO: Implement save functionality (e.g., save to database, localStorage, etc.)
    console.log('Saving route:', currentRoute)
    alert('Route saved! (This is a placeholder - implement actual save functionality)')
  }

  // Handle canvas drawing completion - store points and prompt for start point selection
  const handleCanvasDrawingComplete = async (canvasPoints: Array<{ x: number; y: number }>) => {
    if (canvasPoints.length < 2) {
      alert('Please draw a route with at least 2 points')
      return
    }

    // Store the canvas points and prompt user to select start point
    setPendingCanvasPoints(canvasPoints)
    setSelectingStartPoint(true)
    setShowCanvas(false) // Close canvas to show map
    setSelectedStartPoint(null) // Reset selected start point
  }

  // Handle start point selection
  const handleStartPointSelected = async (startPoint: Coordinate) => {
    if (!pendingCanvasPoints) return

    setSelectedStartPoint(startPoint)
    setSelectingStartPoint(false)
    setIsSnapping(true)

    try {
      // Convert canvas coordinates to geographic coordinates relative to start point
      const geographicWaypoints = canvasToGeographicFromStartPoint(
        pendingCanvasPoints,
        startPoint,
        0.0001 // ~11 meters per pixel
      )

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

      // Replace all routes with the new route (only one route at a time)
      setRoutes([newRoute])
      setCurrentRoute(newRoute)
      setPendingCanvasPoints(null) // Clear pending points
    } catch (error) {
      console.error('Failed to generate route from drawing:', error)
      alert('Failed to generate route. Please try again.')
      setSelectingStartPoint(true) // Re-enable start point selection on error
    } finally {
      setIsSnapping(false)
    }
  }


  const handleAuthSignOut = () => {
    router.push('/')
  }

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-forest-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-forest-200 dark:border-forest-700 border-t-orange-accent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-forest-600 dark:text-forest-300">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <Header showHomeButton onSignOut={handleAuthSignOut} />

      <div className="flex flex-col lg:flex-row bg-stone-50 dark:bg-forest-900 text-forest-900 dark:text-stone-50 h-[calc(100vh-4rem)]">
        {/* Sidebar - Fixed on desktop */}
        <aside className="w-full lg:w-72 lg:h-full lg:sticky lg:top-16 bg-white dark:bg-forest-800 border-b lg:border-b-0 lg:border-r border-forest-200 dark:border-forest-700 flex flex-col z-40 shadow-sm">

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-3 overflow-y-auto">
            {/* Primary Action Button */}
            <button
              onClick={() => setShowCanvas(!showCanvas)}
              disabled={isSnapping || selectingStartPoint}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-semibold ${
                showCanvas
                  ? 'bg-orange-accent text-white shadow-md hover:bg-orange-600 hover:shadow-lg'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md hover:from-orange-600 hover:to-orange-700 hover:shadow-lg'
              } ${(isSnapping || selectingStartPoint) ? 'opacity-50 cursor-not-allowed' : 'transform hover:scale-[1.02]'}`}
            >
              <span className="text-lg">{showCanvas ? '✕' : '✏️'}</span>
              <span>{showCanvas ? 'Close Drawing' : 'Draw New Route'}</span>
            </button>
            
            {/* Status Indicator */}
            {(isSnapping || selectingStartPoint) && (
              <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {isSnapping ? 'Generating route...' : selectingStartPoint ? 'Selecting start point...' : 'Processing...'}
                  </span>
                </div>
              </div>
            )}

            {/* Route Info Card */}
            {currentRoute && !isSnapping && !selectingStartPoint && (
              <div className="px-4 py-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🗺️</span>
                    <h3 className="font-semibold text-forest-900 dark:text-white">Route Created</h3>
                  </div>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <p className="text-sm text-forest-600 dark:text-forest-300 mb-3">
                  Your route has {currentRoute.coordinates.length} waypoints
                </p>
                <button
                  onClick={handleSaveRoute}
                  className="w-full px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-all font-semibold text-sm shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <span>💾</span>
                  <span>Save Route</span>
                </button>
              </div>
            )}

            {/* Instructions */}
            {!currentRoute && !showCanvas && !isSnapping && !selectingStartPoint && (
              <div className="px-4 py-4 rounded-xl bg-forest-50 dark:bg-forest-700/50 border border-forest-200 dark:border-forest-600">
                <h3 className="font-semibold text-forest-900 dark:text-white mb-2 text-sm">Get Started</h3>
                <ol className="text-xs text-forest-600 dark:text-forest-300 space-y-1.5 list-decimal list-inside">
                  <li>Click &quot;Draw New Route&quot; to open the canvas</li>
                  <li>Draw your desired route shape</li>
                  <li>Select a start point on the map</li>
                  <li>Your route will be generated automatically</li>
                </ol>
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-forest-200 dark:border-forest-700 space-y-4">
            <button
              onClick={toggleDarkMode}
              className="w-full px-4 py-2 rounded-lg bg-forest-100 dark:bg-forest-700 hover:bg-forest-200 dark:hover:bg-forest-600 text-forest-700 dark:text-forest-200 transition-colors text-sm"
            >
              {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
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
              <div className="w-full lg:w-[480px] bg-white dark:bg-forest-800 border-r border-forest-200 dark:border-forest-700 shadow-xl z-10 flex flex-col">
                <div className="p-6 border-b border-forest-200 dark:border-forest-700 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🎨</span>
                    <h2 className="text-2xl font-bold text-forest-900 dark:text-white">
                      Draw Your Route
                    </h2>
                  </div>
                  <p className="text-sm text-forest-700 dark:text-forest-200">
                    Draw any shape on the canvas. After you finish, you&apos;ll select where on the map your route should start.
                  </p>
                </div>
                <div className="flex-1 p-6 overflow-y-auto">
                  <DrawingCanvas
                    onDrawingComplete={handleCanvasDrawingComplete}
                    width={400}
                    height={400}
                    canDraw={!isSnapping}
                  />
                </div>
              </div>
            )}

            {/* Map Container */}
            <div className="flex-1 relative">
              {selectingStartPoint && (
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[1000] bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-5 rounded-2xl shadow-2xl border-4 border-white dark:border-forest-700 max-w-md animate-pulse-slow">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">📍</span>
                    <div>
                      <p className="text-xl font-bold mb-1">
                        Select Your Start Point
                      </p>
                      <p className="text-sm text-orange-50 opacity-90">
                        Click anywhere on the map to choose where your route should begin
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-orange-50">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    <span>Waiting for your selection...</span>
                  </div>
                </div>
              )}
              <RouteMap
                routes={routes}
                waypoints={[]}
                center={{ lat: 34.0522, lng: -118.2437 }}
                zoom={10}
                onRouteClick={handleRouteClick}
                showWaypoints={false}
                draggableMode={false}
                enableDrawing={false}
                enableStartPointSelection={selectingStartPoint}
                onStartPointSelected={handleStartPointSelected}
                startPointMarker={selectedStartPoint}
              />
            </div>
          </div>

          {/* Info Panel */}
          <div className="bg-white/80 dark:bg-forest-800/80 backdrop-blur-md border-t border-forest-200 dark:border-forest-700 px-4 sm:px-6 py-3 z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between text-sm gap-3">
              <div className="flex flex-wrap items-center gap-3 text-forest-600 dark:text-forest-300">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🗺️</span>
                  <span className="font-medium">OpenStreetMap</span>
                </div>
                <span className="hidden sm:inline text-forest-300 dark:text-forest-600">•</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs">📍</span>
                  <span className="font-medium">Southern California</span>
                </div>
                {routes.length > 0 && (
                  <>
                    <span className="hidden sm:inline text-forest-300 dark:text-forest-600">•</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">✓</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{routes.length} route{routes.length !== 1 ? 's' : ''}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-forest-500 dark:text-forest-400 text-center sm:text-right">
                Scroll to zoom • Drag to pan • Click route to select
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

