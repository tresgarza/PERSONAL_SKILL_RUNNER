'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import { useAuth } from './auth-context'
import { PageEvent, UserSession } from './supabase'

interface TrackingContextType {
  trackEvent: (event: Omit<PageEvent, 'id' | 'user_id' | 'timestamp' | 'created_at'>) => void
  trackPageView: (pagePath: string) => void
  trackClick: (elementId: string, elementType?: string, elementText?: string) => void
  trackError: (error: Error, errorType?: string, metadata?: Record<string, unknown>) => void
  sessionId: string | null
  isTrackingEnabled: boolean
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined)

// Configuración de tracking
const TRACKING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TRACKING !== 'false'
const BATCH_SIZE = parseInt(process.env.NEXT_PUBLIC_TRACKING_BATCH_SIZE || '10', 10)
const FLUSH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_TRACKING_FLUSH_INTERVAL || '5000', 10)

export function TrackingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isTrackingEnabled] = useState(TRACKING_ENABLED)
  
  const eventQueue = useRef<Array<Omit<PageEvent, 'id' | 'user_id' | 'timestamp' | 'created_at'>>>([])
  const flushTimer = useRef<NodeJS.Timeout | null>(null)
  const sessionStartTime = useRef<Date | null>(null)

  // Generar o recuperar session ID
  useEffect(() => {
    if (!isTrackingEnabled) return

    const storedSessionId = sessionStorage.getItem('tracking_session_id')
    const storedSessionStart = sessionStorage.getItem('tracking_session_start')
    
    if (storedSessionId && storedSessionStart) {
      setSessionId(storedSessionId)
      sessionStartTime.current = new Date(storedSessionStart)
    } else {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setSessionId(newSessionId)
      sessionStartTime.current = new Date()
      sessionStorage.setItem('tracking_session_id', newSessionId)
      sessionStorage.setItem('tracking_session_start', sessionStartTime.current.toISOString())
      
      // Crear sesión en el backend
      createSession(newSessionId)
    }

    // Limpiar al cerrar la pestaña/ventana
    const handleBeforeUnload = () => {
      if (sessionId) {
        endSession(sessionId)
      }
      flushEvents(true) // Enviar eventos pendientes
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (sessionId) {
        endSession(sessionId)
      }
      flushEvents(true)
    }
  }, [isTrackingEnabled])

  // Crear sesión en el backend
  const createSession = async (sid: string) => {
    try {
      const deviceInfo = getDeviceInfo()
      await fetch('/api/tracking/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          device_type: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          referrer: document.referrer || undefined,
        }),
      })
    } catch {
      // Silently fail - session creation is not critical
    }
  }

  // Finalizar sesión
  const endSession = async (sid: string) => {
    try {
      await fetch('/api/tracking/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          ended_at: new Date().toISOString(),
        }),
      })
    } catch {
      // Silently fail - session ending is not critical
    }
  }

  // Obtener información del dispositivo
  const getDeviceInfo = () => {
    const ua = navigator.userAgent
    let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown'
    let browser = 'unknown'
    let os = 'unknown'

    // Detectar dispositivo
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      deviceType = 'tablet'
    } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
      deviceType = 'mobile'
    } else {
      deviceType = 'desktop'
    }

    // Detectar navegador
    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
    else if (ua.includes('Edge')) browser = 'Edge'
    else if (ua.includes('Opera')) browser = 'Opera'

    // Detectar OS
    if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Mac')) os = 'macOS'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

    return { deviceType, browser, os }
  }

  // Enviar eventos en batch
  const flushEvents = useCallback(async (force = false) => {
    if (eventQueue.current.length === 0) return

    const shouldFlush = force || eventQueue.current.length >= BATCH_SIZE

    if (!shouldFlush && !force) {
      // Programar siguiente flush
      if (flushTimer.current) {
        clearTimeout(flushTimer.current)
      }
      flushTimer.current = setTimeout(() => flushEvents(false), FLUSH_INTERVAL)
      return
    }

    const eventsToSend = [...eventQueue.current]
    eventQueue.current = []

    try {
      await fetch('/api/tracking/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: eventsToSend }),
      })
    } catch (error) {
      console.error('Error sending events:', error)
      // Re-agregar eventos a la cola si falla
      eventQueue.current.unshift(...eventsToSend)
    }

    // Programar siguiente flush si hay más eventos
    if (eventQueue.current.length > 0) {
      flushTimer.current = setTimeout(() => flushEvents(false), FLUSH_INTERVAL)
    }
  }, [])

  // Trackear evento genérico
  const trackEvent = useCallback((event: Omit<PageEvent, 'id' | 'user_id' | 'timestamp' | 'created_at'>) => {
    if (!isTrackingEnabled || !sessionId) return

    const pagePath = typeof window !== 'undefined' ? window.location.pathname : '/'
    
    const fullEvent: Omit<PageEvent, 'id' | 'user_id' | 'timestamp' | 'created_at'> = {
      ...event,
      session_id: sessionId,
      page_path: event.page_path || pagePath,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }

    eventQueue.current.push(fullEvent)

    // Enviar inmediatamente si alcanza el tamaño del batch
    if (eventQueue.current.length >= BATCH_SIZE) {
      flushEvents(true)
    } else {
      // Programar flush si no hay timer activo
      if (!flushTimer.current) {
        flushTimer.current = setTimeout(() => flushEvents(false), FLUSH_INTERVAL)
      }
    }
  }, [isTrackingEnabled, sessionId, flushEvents])

  // Trackear vista de página
  const trackPageView = useCallback((pagePath: string) => {
    trackEvent({
      session_id: sessionId || '',
      event_type: 'view',
      event_name: 'page_view',
      page_path: pagePath,
    })
  }, [trackEvent, sessionId])

  // Trackear click
  const trackClick = useCallback((elementId: string, elementType?: string, elementText?: string) => {
    trackEvent({
      session_id: sessionId || '',
      event_type: 'click',
      event_name: 'element_click',
      page_path: typeof window !== 'undefined' ? window.location.pathname : '/',
      element_id: elementId,
      element_type: elementType,
      element_text: elementText,
    })
  }, [trackEvent, sessionId])

  // Trackear error
  const trackError = useCallback(async (
    error: Error,
    errorType: string = 'javascript',
    metadata?: Record<string, unknown>
  ) => {
    if (!isTrackingEnabled || !sessionId) return

    try {
      await fetch('/api/tracking/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_type: errorType,
          error_message: error.message,
          error_stack: error.stack,
          page_path: typeof window !== 'undefined' ? window.location.pathname : '/',
          metadata: {
            ...metadata,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          },
        }),
      })
    } catch (err) {
      console.error('Error tracking error:', err)
    }
  }, [isTrackingEnabled, sessionId])

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current)
      }
    }
  }, [])

  return (
    <TrackingContext.Provider
      value={{
        trackEvent,
        trackPageView,
        trackClick,
        trackError,
        sessionId,
        isTrackingEnabled,
      }}
    >
      {children}
    </TrackingContext.Provider>
  )
}

export function useTracking() {
  const context = useContext(TrackingContext)
  if (context === undefined) {
    throw new Error('useTracking must be used within a TrackingProvider')
  }
  return context
}
