'use client'

import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import NutritionDashboard from "@/components/NutritionDashboard"

export default function MacroscannerPage() {
  const router = useRouter()

  const handleAuthSignOut = () => {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header showHomeButton onSignOut={handleAuthSignOut} />
      <main className="py-6 px-4 sm:px-6 lg:px-8 pb-safe">
        <div className="max-w-7xl mx-auto">
          <NutritionDashboard />
        </div>
      </main>
    </div>
  )
}
