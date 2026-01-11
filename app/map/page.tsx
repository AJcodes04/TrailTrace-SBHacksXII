'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Route, Coordinate } from '@/types/route'
import { snapToRoads } from '@/utils/routeHelpers'
import DrawingCanvas from '@/components/DrawingCanvas'
import AuthWidget from '@/components/AuthWidget'
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

      // Replace all routes with the new route (only one route at a time)
      setRoutes([newRoute])
      setCurrentRoute(newRoute)
      setShowCanvas(false) // Close canvas after route generation
    } catch (error) {
      console.error('Failed to generate route from drawing:', error)
      alert('Failed to generate route. Please try again.')
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
      <header className="sticky top-0 z-50 bg-white dark:bg-forest-800 border-b border-forest-200 dark:border-forest-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="relative w-24 h-12">
                  <Image
                    src="/images/logo.png"
                    alt="TrailTrace Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <p className="hidden sm:block text-sm text-forest-600 dark:text-forest-300 font-medium">
                  Draw your path. Run your route.
                </p>
              </button>
            </div>
            
            {/* Auth Widget */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-forest-100 dark:bg-forest-700 hover:bg-forest-200 dark:hover:bg-forest-600 text-forest-700 dark:text-forest-200 rounded-lg font-semibold text-sm transition-colors"
              >
                Home
              </button>
              <AuthWidget
                onSignOut={handleAuthSignOut}
                variant="compact"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row bg-stone-50 dark:bg-forest-900 text-forest-900 dark:text-stone-50 h-[calc(100vh-4rem)]">
        {/* Sidebar - Fixed on desktop */}
        <aside className="w-full lg:w-64 lg:h-full lg:sticky lg:top-16 bg-white dark:bg-forest-800 border-b lg:border-b-0 lg:border-r border-forest-200 dark:border-forest-700 flex flex-col z-40">

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
              {showCanvas ? 'Close Canvas' : 'Map'}
            </button>
            
            {currentRoute && (
              <button
                onClick={handleSaveRoute}
                className="w-full px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors text-sm font-semibold"
              >
                Save Route
              </button>
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
                  canDraw={!isSnapping}
                />
              </div>
            )}

            {/* Map Container */}
            <div className="flex-1 relative">
              <RouteMap
                routes={routes}
                waypoints={[]}
                center={{ lat: 34.0522, lng: -118.2437 }}
                zoom={10}
                onRouteClick={handleRouteClick}
                showWaypoints={false}
                draggableMode={false}
                enableDrawing={false}
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

