'use client'

import { useEffect } from 'react'
import { useTracking } from '../lib/tracking-context'
import { usePathname } from 'next/navigation'

interface WebVitals {
  name: string
  value: number
  id: string
  delta?: number
}

/**
 * Componente para monitorear métricas de rendimiento Web Vitals
 * Se monta automáticamente y envía métricas al backend
 */
export function PerformanceMonitor() {
  const { trackEvent, sessionId, isTrackingEnabled } = useTracking()
  const pathname = usePathname()

  useEffect(() => {
    if (!isTrackingEnabled || typeof window === 'undefined') return

    // Trackear métricas de Web Vitals usando web-vitals library si está disponible
    // O usando Performance API nativa
    const trackWebVital = (name: string, value: number, delta?: number) => {
      trackEvent({
        session_id: sessionId || '',
        event_type: 'custom',
        event_name: 'performance_metric',
        page_path: pathname,
        metadata: {
          metric_type: 'page_load',
          metric_name: name,
          value,
          unit: 'ms',
          delta,
        },
      })

      // También enviar a la tabla de performance_metrics
      fetch('/api/tracking/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_path: pathname,
          metric_type: 'page_load',
          metric_name: name,
          value,
          unit: 'ms',
          metadata: { delta },
        }),
      }).catch(err => console.error('Error tracking performance:', err))
    }

    // Medir TTFB (Time to First Byte)
    const measureTTFB = () => {
      if ('PerformanceNavigationTiming' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const ttfb = navigation.responseStart - navigation.requestStart
        trackWebVital('ttfb', ttfb)
      }
    }

    // Medir FCP (First Contentful Paint)
    const measureFCP = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === 'first-contentful-paint') {
                trackWebVital('fcp', entry.startTime)
                observer.disconnect()
              }
            }
          })
          observer.observe({ entryTypes: ['paint'] })
        } catch (e) {
          // PerformanceObserver no soportado o error
        }
      }
    }

    // Medir LCP (Largest Contentful Paint)
    const measureLCP = () => {
      if ('PerformanceObserver' in window) {
        try {
          let lcpValue = 0
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1] as any
            lcpValue = lastEntry.renderTime || lastEntry.loadTime
          })
          observer.observe({ entryTypes: ['largest-contentful-paint'] })

          // Enviar cuando la página se descarga completamente
          window.addEventListener('beforeunload', () => {
            if (lcpValue > 0) {
              trackWebVital('lcp', lcpValue)
            }
          })
        } catch (e) {
          // PerformanceObserver no soportado
        }
      }
    }

    // Medir CLS (Cumulative Layout Shift)
    const measureCLS = () => {
      if ('PerformanceObserver' in window) {
        try {
          let clsValue = 0
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value
              }
            }
          })
          observer.observe({ entryTypes: ['layout-shift'] })

          // Enviar cuando la página se descarga completamente
          window.addEventListener('beforeunload', () => {
            if (clsValue > 0) {
              trackWebVital('cls', clsValue)
            }
          })
        } catch (e) {
          // PerformanceObserver no soportado
        }
      }
    }

    // Medir FID (First Input Delay) - requiere interacción del usuario
    const measureFID = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const fid = (entry as any).processingStart - entry.startTime
              trackWebVital('fid', fid)
              observer.disconnect()
            }
          })
          observer.observe({ entryTypes: ['first-input'] })
        } catch (e) {
          // PerformanceObserver no soportado
        }
      }
    }

    // Medir tiempo total de carga de página
    const measurePageLoad = () => {
      if ('PerformanceNavigationTiming' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const loadTime = navigation.loadEventEnd - navigation.fetchStart
        trackWebVital('page_load', loadTime)
      } else if ('timing' in performance) {
        const timing = (performance as any).timing
        const loadTime = timing.loadEventEnd - timing.navigationStart
        trackWebVital('page_load', loadTime)
      }
    }

    // Ejecutar mediciones cuando la página esté lista
    if (document.readyState === 'complete') {
      measureTTFB()
      measureFCP()
      measureLCP()
      measureCLS()
      measurePageLoad()
    } else {
      window.addEventListener('load', () => {
        measureTTFB()
        measureFCP()
        measureLCP()
        measureCLS()
        measurePageLoad()
      })
    }

    // FID se mide cuando hay interacción
    measureFID()

    // Medir tiempo de respuesta de API
    const originalFetch = window.fetch
    window.fetch = async function(...args) {
      const startTime = performance.now()
      try {
        const response = await originalFetch.apply(this, args)
        const endTime = performance.now()
        const duration = endTime - startTime

        // Trackear solo si es una llamada a nuestra API
        const url = args[0] as string
        if (typeof url === 'string' && url.startsWith('/api/')) {
          fetch('/api/tracking/performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              page_path: pathname,
              metric_type: 'api_response',
              metric_name: 'api_latency',
              value: duration,
              unit: 'ms',
              metadata: {
                url,
                method: args[1]?.method || 'GET',
                status: response.status,
              },
            }),
          }).catch(err => console.error('Error tracking API performance:', err))
        }

        return response
      } catch (error) {
        const endTime = performance.now()
        const duration = endTime - startTime
        
        fetch('/api/tracking/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page_path: pathname,
            metric_type: 'api_response',
            metric_name: 'api_error',
            value: duration,
            unit: 'ms',
            metadata: {
              url: args[0] as string,
              error: error instanceof Error ? error.message : String(error),
            },
          }),
        }).catch(err => console.error('Error tracking API error:', err))

        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [isTrackingEnabled, pathname, trackEvent, sessionId])

  // Este componente no renderiza nada
  return null
}
