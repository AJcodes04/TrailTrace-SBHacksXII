'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Header from '@/components/Header'

interface LandingPageProps {
  onSignIn: () => void
}

function LandingPage({ onSignIn }: LandingPageProps) {
  const [darkMode, setDarkMode] = useState(false)

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (!darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <Header />
      
      <div className="flex flex-col lg:flex-row bg-stone-50 dark:bg-forest-900 text-forest-900 dark:text-stone-50">
        {/* Sidebar - Fixed on desktop */}
        <aside className="w-full lg:w-64 lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16 bg-white dark:bg-forest-800 border-b lg:border-b-0 lg:border-r border-forest-200 dark:border-forest-700 flex flex-col z-50">
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button
              onClick={() => scrollToSection('overview')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200 transition-colors"
            >
              Overview
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200 transition-colors"
            >
              How it works
            </button>
            <button
              onClick={() => scrollToSection('safety')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200 transition-colors"
            >
              Safety first
            </button>
            <button
              onClick={() => scrollToSection('friends')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200 transition-colors"
            >
              For friends
            </button>
            <button
              onClick={() => scrollToSection('get-started')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-forest-50 dark:hover:bg-forest-700 text-forest-700 dark:text-forest-200 transition-colors"
            >
              Get started
            </button>
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
        <main className="flex-1 overflow-y-auto">
          {/* Background Illustration */}
          <div className="fixed inset-0 pointer-events-none opacity-5 dark:opacity-10 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-forest-500 via-forest-400 to-orange-accent"></div>
          </div>

          {/* Hero Section - Overview */}
          <section id="overview" className="relative z-10 px-6 lg:px-12 py-20 lg:py-32">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Left: Text Content */}
                <div className="space-y-6">
                  <h1 className="text-5xl lg:text-6xl font-bold text-forest-900 dark:text-white leading-tight">
                    Turn sketches into safe, social runs.
                  </h1>
                  <p className="text-xl text-forest-600 dark:text-forest-300 leading-relaxed">
                    Draw any route you want—hearts, letters, your campus mascot. TrailTrace maps it to real streets, avoids high-crime areas, and lets you share with friends.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button
                      onClick={onSignIn}
                      className="px-8 py-4 bg-orange-accent hover:bg-orange-dark text-white rounded-xl font-semibold text-lg shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all hover:scale-105 animate-pulse-slow"
                    >
                      Start drawing a route
                    </button>
                    <button className="px-8 py-4 bg-white dark:bg-forest-800 border-2 border-forest-300 dark:border-forest-600 text-forest-700 dark:text-forest-200 rounded-xl font-semibold text-lg hover:bg-forest-50 dark:hover:bg-forest-700 transition-all">
                      Watch 30‑second preview
                    </button>
                  </div>
                </div>

                {/* Right: Map Preview Card */}
                <div className="relative">
                  <div className="relative bg-white dark:bg-forest-800 rounded-3xl shadow-2xl p-6 transform rotate-3 hover:rotate-6 transition-transform duration-300">
                    {/* Mock Map */}
                    <div className="aspect-square rounded-2xl relative overflow-hidden bg-white dark:bg-forest-700">
                      {/* Route Path */}
                      <Image
                        src="/images/StravaArtExample.png"
                        alt="TrailTrace route example"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Timeline */}
          <section id="how-it-works" className="relative z-10 px-6 lg:px-12 py-20 bg-white/50 dark:bg-forest-800/50 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-4xl font-bold text-center mb-16 text-forest-900 dark:text-white">
                How it works
              </h2>
              
              <div className="grid md:grid-cols-3 gap-8">
                {/* Step 1: Draw */}
                <div className="relative">
                  <div className="bg-white dark:bg-forest-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-forest-100 dark:border-forest-700">
                    <div className="w-16 h-16 bg-gradient-to-br from-forest-500 to-forest-600 rounded-xl flex items-center justify-center mb-6 text-3xl">
                      ✏️
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-forest-900 dark:text-white">Draw</h3>
                    <p className="text-forest-600 dark:text-forest-300">
                      Sketch any outline on our interactive canvas. Draw hearts, letters, or any shape you want to run.
                    </p>
                  </div>
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-forest-300 dark:border-forest-600 transform -translate-y-1/2"></div>
                </div>

                {/* Step 2: Generate */}
                <div className="relative">
                  <div className="bg-white dark:bg-forest-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-forest-100 dark:border-forest-700">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-accent to-orange-dark rounded-xl flex items-center justify-center mb-6 text-3xl">
                      🗺️
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-forest-900 dark:text-white">Generate safe route</h3>
                    <p className="text-forest-600 dark:text-forest-300">
                      Our system maps your drawing onto real streets and avoids high-crime areas when possible.
                    </p>
                  </div>
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-forest-300 dark:border-forest-600 transform -translate-y-1/2"></div>
                </div>

                {/* Step 3: Run & Share */}
                <div>
                  <div className="bg-white dark:bg-forest-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-forest-100 dark:border-forest-700">
                    <div className="w-16 h-16 bg-gradient-to-br from-forest-500 to-orange-accent rounded-xl flex items-center justify-center mb-6 text-3xl">
                      👥
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-forest-900 dark:text-white">Run & share</h3>
                    <p className="text-forest-600 dark:text-forest-300">
                      Copy routes from others, share your creations, and build a community of runners.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Safety First Section */}
          <section id="safety" className="relative z-10 px-6 lg:px-12 py-20">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                {/* Left: Copy */}
                <div className="space-y-6">
                  <h2 className="text-4xl font-bold text-forest-900 dark:text-white">
                    Safety first
                  </h2>
                  <p className="text-lg text-forest-600 dark:text-forest-300 leading-relaxed">
                    Every route is analyzed using crime heatmap data. We prioritize well-lit streets and areas with lower incident rates, especially important for campus-area runs.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-semibold">
                      Crime-aware routing
                    </span>
                    <span className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full text-sm font-semibold">
                      Route safety score
                    </span>
                  </div>
                </div>

                {/* Right: Heatmap Card */}
                <div className="relative">
                  <div className="bg-white dark:bg-forest-800 rounded-3xl p-6 shadow-2xl border border-forest-100 dark:border-forest-700">
                    <div className="aspect-square relative rounded-2xl overflow-hidden">
                      {/* Heatmap Gradient */}
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/40 via-yellow-500/30 to-red-500/40"></div>
                      {/* Route Overlay */}
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                        <path
                          d="M 30 150 Q 60 100, 90 120 T 170 100"
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                      </svg>
                      {/* Grid overlay for heatmap effect */}
                      <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)',
                        backgroundSize: '20px 20px'
                      }}></div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-forest-600 dark:text-forest-300">Lower reports</span>
                      </div>
                      <div className="flex-1 h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded mx-4"></div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm text-forest-600 dark:text-forest-300">Higher reports</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* For Friends Section */}
          <section id="friends" className="relative z-10 px-6 lg:px-12 py-20 bg-white/50 dark:bg-forest-800/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 text-forest-900 dark:text-white">
                  Run together, from anywhere
                </h2>
                <p className="text-lg text-forest-600 dark:text-forest-300 max-w-2xl mx-auto">
                  Discover routes created by friends, copy them to your profile, and run the same path even when you&apos;re apart.
                </p>
              </div>

              {/* Scrollable Route Cards */}
              <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6">
                <div className="flex gap-6 pb-4">
                  {/* Route Card 1 */}
                  <div className="flex-shrink-0 w-80 snap-center">
                    <div className="bg-white dark:bg-forest-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-forest-100 dark:border-forest-700 overflow-hidden">
                      <div className="h-40 bg-gradient-to-br from-forest-200 to-forest-300 dark:from-forest-700 dark:to-forest-600 relative">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                          <path d="M 50 100 Q 100 50, 150 100" fill="none" stroke="#f97316" strokeWidth="4" />
                        </svg>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-lg text-forest-900 dark:text-white">Heart around IV</h3>
                          <span className="text-sm text-forest-500 dark:text-forest-400">3.2k</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                            <span className="text-sm text-forest-600 dark:text-forest-300">@runner123</span>
                          </div>
                          <button className="px-4 py-2 bg-orange-accent hover:bg-orange-dark text-white rounded-lg text-sm font-semibold transition-colors">
                            Copy route
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Route Card 2 */}
                  <div className="flex-shrink-0 w-80 snap-center">
                    <div className="bg-white dark:bg-forest-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-forest-100 dark:border-forest-700 overflow-hidden">
                      <div className="h-40 bg-gradient-to-br from-orange-200 to-orange-300 dark:from-orange-900/30 dark:to-orange-800/30 relative">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                          <path d="M 100 50 L 150 100 L 100 150 L 50 100 Z" fill="none" stroke="#1a4d3e" strokeWidth="4" />
                        </svg>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-lg text-forest-900 dark:text-white">Campus Square</h3>
                          <span className="text-sm text-forest-500 dark:text-forest-400">5.1k</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-forest-600 dark:text-forest-300">@trailrunner</span>
                          </div>
                          <button className="px-4 py-2 bg-orange-accent hover:bg-orange-dark text-white rounded-lg text-sm font-semibold transition-colors">
                            Copy route
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Route Card 3 */}
                  <div className="flex-shrink-0 w-80 snap-center">
                    <div className="bg-white dark:bg-forest-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-forest-100 dark:border-forest-700 overflow-hidden">
                      <div className="h-40 bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-900/30 dark:to-blue-800/30 relative">
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                          <path d="M 50 50 Q 100 150, 150 50" fill="none" stroke="#f97316" strokeWidth="4" />
                        </svg>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-lg text-forest-900 dark:text-white">Beach Loop</h3>
                          <span className="text-sm text-forest-500 dark:text-forest-400">7.8k</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-500 rounded-full"></div>
                            <span className="text-sm text-forest-600 dark:text-forest-300">@coastalrun</span>
                          </div>
                          <button className="px-4 py-2 bg-orange-accent hover:bg-orange-dark text-white rounded-lg text-sm font-semibold transition-colors">
                            Copy route
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section - Get Started */}
          <section id="get-started" className="relative z-10 px-6 lg:px-12 py-20">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white dark:bg-forest-800 rounded-3xl shadow-2xl p-12 border border-forest-100 dark:border-forest-700 relative overflow-hidden">
                {/* Subtle path illustration behind */}
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 400 200">
                    <path
                      d="M 0 100 Q 100 50, 200 100 T 400 100"
                      fill="none"
                      stroke="#1a4d3e"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                
                <div className="relative z-10 text-center space-y-8">
                  <h2 className="text-4xl lg:text-5xl font-bold text-forest-900 dark:text-white">
                    Ready to trace your first trail?
                  </h2>
                  <form className="space-y-4 max-w-md mx-auto" onSubmit={(e) => { e.preventDefault(); onSignIn(); }}>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      className="w-full px-6 py-4 rounded-xl border-2 border-forest-200 dark:border-forest-600 bg-white dark:bg-forest-700 text-forest-900 dark:text-white focus:outline-none focus:border-orange-accent transition-colors"
                    />
                    <button
                      type="submit"
                      className="w-full px-8 py-4 bg-orange-accent hover:bg-orange-dark text-white rounded-xl font-semibold text-lg shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all hover:scale-105"
                    >
                      Get early access
                    </button>
                  </form>
                  <p className="text-sm text-forest-500 dark:text-forest-400">
                    No spam. Just a link to try the prototype.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()

  const handleSignIn = () => {
    router.push('/map')
  }

  return <LandingPage onSignIn={handleSignIn} />
}
