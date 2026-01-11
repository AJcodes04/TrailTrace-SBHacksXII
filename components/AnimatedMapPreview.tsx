'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import type { Route } from '@/types/route'

// Dynamically import the map component to avoid SSR issues
const RouteMap = dynamic(() => import('@/components/RouteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-forest-100 dark:bg-forest-800 animate-pulse flex items-center justify-center">
      <div className="text-forest-400">Loading map...</div>
    </div>
  ),
})

// Example route for preview (heart shape in LA area)
const previewRoute: Route = {
  id: 'preview-route',
  name: 'Preview Route',
  coordinates: [
    { lat: 34.0522, lng: -118.2437 },
    { lat: 34.0450, lng: -118.2500 },
    { lat: 34.0400, lng: -118.2550 },
    { lat: 34.0350, lng: -118.2500 },
    { lat: 34.0320, lng: -118.2430 },
    { lat: 34.0350, lng: -118.2360 },
    { lat: 34.0420, lng: -118.2300 },
    { lat: 34.0522, lng: -118.2330 },
    { lat: 34.0620, lng: -118.2300 },
    { lat: 34.0690, lng: -118.2360 },
    { lat: 34.0720, lng: -118.2430 },
    { lat: 34.0690, lng: -118.2500 },
    { lat: 34.0640, lng: -118.2550 },
    { lat: 34.0590, lng: -118.2500 },
    { lat: 34.0522, lng: -118.2437 },
  ],
  color: '#f97316',
  weight: 5,
  opacity: 0.9,
}

interface AnimatedMapPreviewProps {
  className?: string
}

export default function AnimatedMapPreview({ className = '' }: AnimatedMapPreviewProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`w-full h-full bg-forest-100 dark:bg-forest-800 animate-pulse ${className}`} />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`relative w-full h-full rounded-2xl overflow-hidden shadow-2xl ${className}`}
    >
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-forest-900/20 via-transparent to-transparent pointer-events-none" />
      <RouteMap
        routes={[previewRoute]}
        center={{ lat: 34.0522, lng: -118.2437 }}
        zoom={12}
        showWaypoints={false}
        enableDrawing={false}
        draggableMode={false}
      />
    </motion.div>
  )
}
