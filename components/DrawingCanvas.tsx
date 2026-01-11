'use client'

import { useRef, useState, useEffect } from 'react'
import { selectOptimalWaypoints } from '@/utils/drawingHelpers'

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

    // Use improved waypoint selection algorithm
    const optimalWaypoints = selectOptimalWaypoints(pointsRef.current, {
      minPoints: 4,
      maxPoints: 25,
      preserveCurves: true,
    })
    
    onDrawingComplete(optimalWaypoints)
    
    // Call optional onDrawClick callback
    if (onDrawClick) {
      onDrawClick()
    }
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

