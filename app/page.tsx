'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Header from '@/components/Header'
import AnimatedMapPreview from '@/components/AnimatedMapPreview'

export default function Home() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleStartDrawing = () => {
    router.push('/map')
  }

  const handleMacroScanner = () => {
    router.push('/macroscanner')
  }

  // Fade in animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Main Hero Section */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left: Content (Mobile-first, full width on mobile) */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={mounted ? 'visible' : 'hidden'}
          className="flex-1 flex flex-col justify-center px-6 sm:px-8 lg:px-12 py-12 lg:py-16 bg-white lg:max-w-[50%] z-10 relative overflow-y-auto"
        >
          <motion.div variants={itemVariants} className="max-w-2xl mx-auto lg:mx-0 w-full">
            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-forest-900 leading-tight mb-6"
            >
              Draw your route.{' '}
              <span className="text-orange-accent">Run it.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-forest-600 mb-8 leading-relaxed"
            >
              Turn any sketch into a safe running route. Map it to real streets, avoid high-crime areas, and track your nutrition.
            </motion.p>

            {/* Dual CTAs - Desktop */}
            <motion.div
              variants={itemVariants}
              className="hidden lg:flex gap-4 mb-8"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartDrawing}
                className="flex-1 px-8 py-4 bg-orange-accent hover:bg-orange-dark text-white rounded-xl font-semibold text-lg shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all"
              >
                Start Drawing
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMacroScanner}
                className="flex-1 px-8 py-4 bg-forest-700 hover:bg-forest-800 text-white rounded-xl font-semibold text-lg shadow-lg shadow-forest-500/30 hover:shadow-xl hover:shadow-forest-500/40 transition-all border-2 border-orange-accent/30"
              >
                MacroScanner
              </motion.button>
            </motion.div>

            {/* Key Features - Compact */}
            <motion.div
              variants={itemVariants}
              className="mt-8 flex flex-wrap gap-3"
            >
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="px-4 py-2 bg-forest-100 text-forest-700 rounded-full text-sm font-medium"
              >
                Draw anything
              </motion.span>
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium"
              >
                Safety-first
              </motion.span>
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-medium"
              >
                Share routes
              </motion.span>
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                Track nutrition
              </motion.span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Right: Map Preview (Desktop) / Full Screen (Mobile) */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={mounted ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          className="relative w-full lg:w-[50%] h-[50vh] lg:h-full order-first lg:order-last"
        >
          <AnimatedMapPreview className="w-full h-full" />
        </motion.div>
      </div>

      {/* Floating CTAs - Mobile */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={mounted ? { y: 0, opacity: 1 } : { y: 100, opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-white via-white to-transparent pointer-events-none space-y-3"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStartDrawing}
          className="w-full px-6 py-4 bg-orange-accent hover:bg-orange-dark text-white rounded-xl font-semibold text-lg shadow-2xl shadow-orange-500/40 pointer-events-auto"
        >
          Start Drawing
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleMacroScanner}
          className="w-full px-6 py-4 bg-forest-700 hover:bg-forest-800 text-white rounded-xl font-semibold text-lg shadow-2xl shadow-forest-500/40 pointer-events-auto border-2 border-orange-accent/30"
        >
          MacroScanner
        </motion.button>
      </motion.div>
    </div>
  )
}