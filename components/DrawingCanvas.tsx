'use client'

import { useRef, useState, useEffect } from 'react'

interface DrawingCanvasProps {
  onDrawingComplete: (coordinates: Array<{ x: number; y: number }>) => void
  width?: number
  height?: number
}

export default function DrawingCanvas({ 
  onDrawingComplete, 
  width = 400, 
  height = 400 
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<Array<{ x: number; y: number }>>([])

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
      // Only add point if it's at least 5 pixels away (reduce point density)
      if (distance >= 5) {
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

    // When drawing stops, process the points
    if (pointsRef.current.length > 0) {
      // Simplify points if needed
      const simplifiedPoints = simplifyPoints(pointsRef.current)
      onDrawingComplete(simplifiedPoints)
      // Reset points for next drawing
      pointsRef.current = []
    }
  }

  // Simple point simplification - takes every Nth point
  // For better results, could use Ramer-Douglas-Peucker algorithm
  const simplifyPoints = (pts: Array<{ x: number; y: number }>, threshold: number = 10): Array<{ x: number; y: number }> => {
    if (pts.length <= 2) return pts

    // Sample points to reduce density while preserving shape
    const simplified: Array<{ x: number; y: number }> = [pts[0]]

    for (let i = 1; i < pts.length - 1; i++) {
      const prev = simplified[simplified.length - 1]
      const curr = pts[i]
      const distance = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      )

      // Include point if it's far enough from previous point
      if (distance >= threshold) {
        simplified.push(curr)
      }
    }

    // Always include the last point
    simplified.push(pts[pts.length - 1])

    return simplified
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
      <div className="flex gap-2">
        <button
          onClick={clearCanvas}
          className="px-4 py-2 bg-forest-600 hover:bg-forest-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Clear Canvas
        </button>
        <p className="text-sm text-forest-600 dark:text-forest-300 px-4 py-2">
          Draw your route shape
        </p>
      </div>
    </div>
  )
}

