'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LandingPage from '@/components/LandingPage'

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check authentication status from localStorage
    const auth = localStorage.getItem('trailtrace_auth')
    const authenticated = auth === 'true'
    setIsAuthenticated(authenticated)

    // If authenticated, redirect to map page
    if (authenticated) {
      router.push('/map')
    }
  }, [router])

  const handleSignIn = () => {
    // Simple auth state management - in production, this would be replaced with real auth
    localStorage.setItem('trailtrace_auth', 'true')
    router.push('/map')
  }

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(to bottom, #1a4d3e 0%, #2d5f50 100%)',
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderTop: '3px solid #ffffff',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite',
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    return <LandingPage onSignIn={handleSignIn} />
  }

  // This should not be reached due to redirect, but return null as fallback
  return null
}

