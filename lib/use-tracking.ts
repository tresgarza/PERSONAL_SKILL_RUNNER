'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useTracking } from './tracking-context'

/**
 * Hook para tracking automático de navegación y eventos comunes
 * Usa este hook en componentes que necesiten tracking automático
 */
export function useAutoTracking() {
  const pathname = usePathname()
  const { trackPageView, trackClick, trackError, isTrackingEnabled } = useTracking()

  // Trackear cambios de página
  useEffect(() => {
    if (!isTrackingEnabled) return
    
    trackPageView(pathname)
  }, [pathname, trackPageView, isTrackingEnabled])

  // Trackear clicks en elementos con data-tracking-id
  useEffect(() => {
    if (!isTrackingEnabled) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const trackingId = target.getAttribute('data-tracking-id')
      const trackingType = target.getAttribute('data-tracking-type') || target.tagName.toLowerCase()
      const trackingText = target.textContent?.trim() || undefined

      if (trackingId) {
        trackClick(trackingId, trackingType, trackingText)
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [trackClick, isTrackingEnabled])

  // Trackear errores globales de JavaScript
  useEffect(() => {
    if (!isTrackingEnabled) return

    const handleError = (event: ErrorEvent) => {
      trackError(
        new Error(event.message),
        'javascript',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      )
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason))
      
      trackError(error, 'javascript', {
        type: 'unhandled_promise_rejection',
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [trackError, isTrackingEnabled])
}
