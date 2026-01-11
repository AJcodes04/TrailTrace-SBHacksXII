# First Step: Create Drawing Canvas Component

## The Problem
Right now you have:
- ✅ Map display (RouteMap component)
- ✅ Route routing (OSRM)
- ✅ Waypoint dragging
- ❌ **NO WAY FOR USERS TO DRAW**

## The Solution: Step 1

**Create a drawing overlay on top of your map that captures stroke coordinates**

### Implementation (30-60 minutes)

#### Option A: Leaflet Draw Plugin (Easiest - Recommended)

1. **Install Leaflet Draw**
   ```bash
   npm install leaflet-draw @types/leaflet-draw
   ```

2. **Add to RouteMap component**
   ```typescript
   // In RouteMap.tsx
   import 'leaflet-draw/dist/leaflet.draw.css'
   import 'leaflet-draw'
   import L from 'leaflet'
   
   // Inside RouteMap component, add:
   useEffect(() => {
     if (!map) return
     
     const drawControl = new L.Control.Draw({
       draw: {
         polyline: {
           shapeOptions: {
             color: '#f97316', // TrailTrace orange
             weight: 4
           }
         },
         polygon: false,
         circle: false,
         rectangle: false,
         marker: false
       },
       edit: {
         featureGroup: drawnItems,
         remove: true
       }
     })
     
     map.addControl(drawControl)
     
     map.on(L.Draw.Event.CREATED, (e: any) => {
       const layer = e.layer
       const geoJSON = layer.toGeoJSON()
       
       // Extract coordinates from the drawn line
       const coordinates = geoJSON.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
         lat,
         lng
       }))
       
       // Call callback with coordinates
       onDrawingComplete?.(coordinates)
     })
     
     return () => {
       map.removeControl(drawControl)
     }
   }, [map])
   ```

#### Option B: HTML5 Canvas Overlay (More Control)

Create a new component: `components/DrawingCanvas.tsx`

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import type { Coordinate } from '@/types/route'

interface DrawingCanvasProps {
  onDrawingComplete: (coordinates: Coordinate[]) => void
  isDrawingMode: boolean
}

export default function DrawingCanvas({ onDrawingComplete, isDrawingMode }: DrawingCanvasProps) {
  const map = useMap()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [points, setPoints] = useState<Coordinate[]>([])

  useEffect(() => {
    if (!canvasRef.current || !isDrawingMode) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match map container
    const updateCanvasSize = () => {
      const container = map.getContainer()
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight
    }
    updateCanvasSize()

    const handleMouseDown = (e: MouseEvent) => {
      setIsDrawing(true)
      const point = map.mouseEventToLatLng(e as any)
      setPoints([{ lat: point.lat, lng: point.lng }])
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return
      const point = map.mouseEventToLatLng(e as any)
      setPoints(prev => [...prev, { lat: point.lat, lng: point.lng }])
      
      // Draw line on canvas
      const containerPoint = map.latLngToContainerPoint(point)
      ctx.lineTo(containerPoint.x, containerPoint.y)
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 4
      ctx.stroke()
    }

    const handleMouseUp = () => {
      if (isDrawing && points.length > 0) {
        onDrawingComplete(points)
      }
      setIsDrawing(false)
      setPoints([])
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    map.getContainer().addEventListener('mousedown', handleMouseDown)
    map.getContainer().addEventListener('mousemove', handleMouseMove)
    map.getContainer().addEventListener('mouseup', handleMouseUp)

    return () => {
      map.getContainer().removeEventListener('mousedown', handleMouseDown)
      map.getContainer().removeEventListener('mousemove', handleMouseMove)
      map.getContainer().removeEventListener('mouseup', handleMouseUp)
    }
  }, [map, isDrawingMode, isDrawing, points, onDrawingComplete])

  if (!isDrawingMode) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'all',
        zIndex: 1000,
        cursor: 'crosshair'
      }}
    />
  )
}
```

## Next Steps After Step 1

Once you have coordinates from drawing:

1. **Pass coordinates to OSRM** (you already have this!)
   ```typescript
   const route = await snapToRoads(drawingCoordinates, 'walking')
   ```

2. **Display the route on the map**
   ```typescript
   setRoutes([route])
   ```

3. **Add safety scoring** (Step 2)

## Recommendation

**Start with Option A (Leaflet Draw)** because:
- ✅ Works immediately
- ✅ No complex canvas code
- ✅ Handles touch/mouse automatically
- ✅ Built-in editing/deleting
- ✅ Ready in 15 minutes

Then enhance with Option B if you need more control over the drawing experience.

## Quick Implementation Checklist

- [ ] Install `leaflet-draw`
- [ ] Add Draw control to RouteMap
- [ ] Handle `L.Draw.Event.CREATED` event
- [ ] Extract coordinates from GeoJSON
- [ ] Pass coordinates to `snapToRoads()` (already exists!)
- [ ] Display routed path on map
- [ ] Test drawing a simple shape

**Time estimate: 30-60 minutes for working prototype**

