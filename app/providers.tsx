'use client'

import { AuthProvider } from '../lib/auth-context'
import { TrackingProvider } from '../lib/tracking-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TrackingProvider>
        {children}
      </TrackingProvider>
    </AuthProvider>
  )
}
