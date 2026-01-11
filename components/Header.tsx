"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import AuthWidget from "@/components/AuthWidget";

interface HeaderProps {
  showHomeButton?: boolean;
  onSignOut?: () => void;
}

export default function Header({ showHomeButton = false, onSignOut }: HeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-forest-200">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="relative w-24 h-12">
                <Image
                  src="/images/logo.png"
                  alt="TrailTrace Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <p className="hidden sm:block text-sm text-forest-600 font-medium">
                Draw your path. Run your route.
              </p>
            </button>
          </div>
          
          {/* Auth Widget */}
          <div className="flex items-center gap-4">
            {showHomeButton && (
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg font-semibold text-sm transition-colors"
              >
                Home
              </button>
            )}
            <AuthWidget
              onSignOut={onSignOut}
              variant="compact"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
