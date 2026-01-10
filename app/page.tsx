'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Route } from '@/types/route'

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

  const handleRouteClick = (route: Route) => {
    console.log('Route clicked:', route)
    // Future: Could show route details or allow interaction
  }

  const toggleExampleRoute = () => {
    if (showExample) {
      setRoutes([])
    } else {
      setRoutes([exampleRoute])
    }
    setShowExample(!showExample)
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
              style={{
                padding: '8px 16px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1d4ed8'}
              onMouseOut={(e) => e.currentTarget.style.background = '#2563eb'}
            >
              {showExample ? 'Hide Example Route' : 'Show Example Route'}
            </button>
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
          center={{ lat: 34.0522, lng: -118.2437 }}
          zoom={10}
          onRouteClick={handleRouteClick}
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
            Click on a route to interact • Use mouse wheel to zoom • Drag to pan
          </div>
        </div>
      </div>
    </main>
  )
}

