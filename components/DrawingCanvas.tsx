'use client'

import { useRef, useState, useEffect } from 'react'

interface DrawingCanvasProps {
  onDrawingComplete: (coordinates: Array<{ x: number; y: number }>) => void
  width?: number
  height?: number
  onDrawClick?: () => void
  canDraw?: boolean
}

export default function DrawingCanvas({ 
  onDrawingComplete, 
  width = 400, 
  height = 400,
  onDrawClick,
  canDraw = true
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<Array<{ x: number; y: number }>>([])
  const [hasDrawing, setHasDrawing] = useState(false)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Set drawing styles
    ctx.strokeStyle = '#f97316' // TrailTrace orange
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [width, height])

  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    pointsRef.current = []
    isDrawingRef.current = false
    setHasDrawing(false)
  }

  // Get coordinates relative to canvas
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }

  // Start drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e)
    if (!coords) return

    isDrawingRef.current = true
    pointsRef.current = [coords]

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  // Draw line
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return

    const coords = getCoordinates(e)
    if (!coords) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()

    // Add point to array (sample points to avoid too many)
    const lastPoint = pointsRef.current[pointsRef.current.length - 1]
    if (lastPoint) {
      const distance = Math.sqrt(
        Math.pow(coords.x - lastPoint.x, 2) + Math.pow(coords.y - lastPoint.y, 2)
      )
        // Only add point if it's at least 15 pixels away (more aggressive sampling)
        if (distance >= 15) {
          pointsRef.current.push(coords)
        }
    } else {
      pointsRef.current.push(coords)
    }
  }

  // Sample every 4th coordinate
  const sampleCoordinates = (pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    if (pts.length <= 4) return pts
    
    const sampled: Array<{ x: number; y: number }> = []
    // Always include the first point
    sampled.push(pts[0])
    
    // Sample every 4th point (indices 4, 8, 12, ...)
    for (let i = 4; i < pts.length; i += 4) {
      sampled.push(pts[i])
    }
    
    // Always include the last point if it's not already included
    const lastIndex = pts.length - 1
    if (lastIndex % 4 !== 0) {
      sampled.push(pts[lastIndex])
    }
    
    return sampled
  }

  // Stop drawing
  const stopDrawing = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false

    // When drawing stops, keep the points but don't generate route yet
    if (pointsRef.current.length > 0) {
      setHasDrawing(true)
    }
  }

  // Handle Draw button click
  const handleDrawClick = () => {
    if (pointsRef.current.length < 2) {
      alert('Please draw a route with at least 2 points')
      return
    }

    // Sample 1 out of every 4 coordinates
    const sampledPoints = sampleCoordinates(pointsRef.current)
    onDrawingComplete(sampledPoints)
    
    // Call optional onDrawClick callback
    if (onDrawClick) {
      onDrawClick()
    }
  }

  // Improved point simplification with maximum waypoint limit
  // Uses distance-based filtering and key point selection to limit vertices
  const simplifyPoints = (pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    if (pts.length <= 2) return pts
    if (pts.length <= 12) {
      // If already small, just do basic distance filtering
      return distanceFilter(pts, 20)
    }

    const MAX_WAYPOINTS = 12 // Limit to 12 waypoints for optimal routing
    
    // Step 1: Distance-based filtering (remove very close points)
    const filtered = distanceFilter(pts, 25)
    
    // Step 2: If still too many, select key turning points
    if (filtered.length <= MAX_WAYPOINTS) {
      return filtered
    }

    // Step 3: Select key points based on angle changes (turning points)
    const keyPoints = selectKeyPoints(filtered, MAX_WAYPOINTS)
    
    return keyPoints
  }

  // Distance-based filtering
  const distanceFilter = (pts: Array<{ x: number; y: number }>, threshold: number): Array<{ x: number; y: number }> => {
    if (pts.length <= 2) return pts
    
    const filtered: Array<{ x: number; y: number }> = [pts[0]]
    
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = filtered[filtered.length - 1]
      const curr = pts[i]
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      )
      
      if (distance >= threshold) {
        filtered.push(curr)
      }
    }
    
    filtered.push(pts[pts.length - 1])
    return filtered
  }

  // Select key points based on angle changes (corners/turns)
  const selectKeyPoints = (pts: Array<{ x: number; y: number }>, maxPoints: number): Array<{ x: number; y: number }> => {
    if (pts.length <= maxPoints) return pts
    
    const keyPoints: Array<{ x: number; y: number }> = [pts[0]] // Always include first
    const angles: Array<{ index: number; angle: number }> = []
    
    // Calculate angle change at each point
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const next = pts[i + 1]
      
      // Calculate vectors
      const v1x = curr.x - prev.x
      const v1y = curr.y - prev.y
      const v2x = next.x - curr.x
      const v2y = next.y - curr.y
      
      // Calculate angle between vectors
      const dot = v1x * v2x + v1y * v2y
      const mag1 = Math.sqrt(v1x * v1x + v1y * v1y)
      const mag2 = Math.sqrt(v2x * v2x + v2y * v2y)
      
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = dot / (mag1 * mag2)
        const clamped = Math.max(-1, Math.min(1, cosAngle))
        const angle = Math.acos(clamped) * (180 / Math.PI)
        angles.push({ index: i, angle })
      }
    }
    
    // Sort by angle (sharpest turns first)
    angles.sort((a, b) => b.angle - a.angle)
    
    // Select top turning points
    const selectedIndices = new Set<number>([0, pts.length - 1]) // Always include first and last
    for (let i = 0; i < Math.min(angles.length, maxPoints - 2); i++) {
      selectedIndices.add(angles[i].index)
    }
    
    // If we still need more points, add evenly spaced ones
    if (selectedIndices.size < maxPoints) {
      const step = Math.floor(pts.length / (maxPoints - selectedIndices.size))
      for (let i = step; i < pts.length - 1; i += step) {
        if (selectedIndices.size >= maxPoints) break
        selectedIndices.add(i)
      }
    }
    
    // Build result array in order
    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b)
    return sortedIndices.map(idx => pts[idx])
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative border-2 border-forest-300 dark:border-forest-600 rounded-lg overflow-hidden bg-white dark:bg-forest-800 shadow-lg">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={(e) => {
            e.preventDefault()
            startDrawing(e)
          }}
          onTouchMove={(e) => {
            e.preventDefault()
            draw(e)
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            stopDrawing()
          }}
          className="cursor-crosshair touch-none"
          style={{ display: 'block' }}
        />
      </div>
      <div className="flex flex-col gap-3 w-full">
        <div className="flex gap-2">
          <button
            onClick={clearCanvas}
            className="flex-1 px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleDrawClick}
            disabled={!hasDrawing || !canDraw}
            className="flex-1 px-4 py-2 bg-orange-accent hover:bg-orange-dark disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Draw
          </button>
        </div>
        {!hasDrawing && (
          <p className="text-sm text-forest-600 dark:text-forest-300 text-center">
            Draw your route shape on the canvas
          </p>
        )}
      </div>
    </div>
  )
}

