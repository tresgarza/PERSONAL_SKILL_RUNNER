'use client'

import { useEffect, useRef, useState } from 'react'

// PDF.js version to use from CDN
const PDFJS_VERSION = '3.11.174'

// Global variable to track if script is loaded
declare global {
  interface Window {
    pdfjsLib: typeof import('pdfjs-dist')
  }
}

interface PDFPreviewProps {
  file: File
  width?: number
  height?: number
  className?: string
  documentType?: string | null
  showLabel?: boolean
}

// Load PDF.js from CDN
function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  return new Promise((resolve, reject) => {
    // If already loaded, return immediately
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[data-pdfjs]')
    if (existingScript) {
      // Wait for existing script to load
      existingScript.addEventListener('load', () => {
        if (window.pdfjsLib) {
          resolve(window.pdfjsLib)
        } else {
          reject(new Error('PDF.js failed to initialize'))
        }
      })
      return
    }

    // Create and load the script
    const script = document.createElement('script')
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`
    script.setAttribute('data-pdfjs', 'true')
    script.async = true
    
    script.onload = () => {
      if (window.pdfjsLib) {
        // Set worker source
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
        resolve(window.pdfjsLib)
      } else {
        reject(new Error('PDF.js failed to initialize'))
      }
    }
    
    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'))
    
    document.head.appendChild(script)
  })
}

export default function PDFPreview({ 
  file, 
  width = 120, 
  height = 160,
  className = '',
  documentType = null,
  showLabel = true
}: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function renderPreview() {
      if (!canvasRef.current) return

      setLoading(true)
      setError(false)

      try {
        // Load PDF.js from CDN instead of importing
        const pdfjsLib = await loadPdfJs()
        
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        
        if (cancelled) return

        setPageCount(pdf.numPages)
        
        const page = await pdf.getPage(1)
        
        if (cancelled) return

        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        
        if (!context) {
          setError(true)
          return
        }

        // Calculate scale to fit the desired dimensions
        const viewport = page.getViewport({ scale: 1 })
        const scaleX = width / viewport.width
        const scaleY = height / viewport.height
        const scale = Math.min(scaleX, scaleY)
        
        const scaledViewport = page.getViewport({ scale })
        
        canvas.width = scaledViewport.width
        canvas.height = scaledViewport.height

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (page.render as any)({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise

        setLoading(false)
      } catch (err) {
        console.error('Error rendering PDF preview:', err)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    renderPreview()

    return () => {
      cancelled = true
    }
  }, [file, width, height])

  // Get emoji and color for document type
  const getDocTypeInfo = (type: string | null) => {
    const typeMap: Record<string, { emoji: string; color: string; bgColor: string }> = {
      'SOLICITUD': { emoji: '📝', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.2)' },
      'ANEXO A': { emoji: '📎', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.2)' },
      'TABLA DE AMORTIZACION': { emoji: '📊', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.2)' },
      'CARATULA': { emoji: '📋', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.2)' },
      'CONTRATO': { emoji: '📜', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.2)' },
      'PAGARE': { emoji: '💰', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.2)' },
      'BURO': { emoji: '🏦', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
      'MANDATO': { emoji: '✍️', color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.2)' },
    }
    return type && typeMap[type] ? typeMap[type] : { emoji: '📄', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.2)' }
  }

  const typeInfo = getDocTypeInfo(documentType)

  return (
    <div className={`pdf-preview-container ${className}`}>
      <div className="pdf-preview-wrapper">
        {loading && (
          <div className="pdf-preview-loading">
            <div className="preview-spinner"></div>
          </div>
        )}
        
        {error && (
          <div className="pdf-preview-error">
            <span className="error-icon">📄</span>
            <span className="error-text">Error</span>
          </div>
        )}
        
        <canvas 
          ref={canvasRef} 
          className={`pdf-preview-canvas ${loading ? 'hidden' : ''}`}
          style={{ maxWidth: width, maxHeight: height }}
        />
        
        {!loading && !error && pageCount > 0 && (
          <div className="pdf-page-count">
            {pageCount} {pageCount === 1 ? 'pág' : 'págs'}
          </div>
        )}
      </div>
      
      {showLabel && (
        <div 
          className="pdf-type-label"
          style={{ 
            backgroundColor: typeInfo.bgColor,
            borderColor: typeInfo.color,
            color: typeInfo.color
          }}
        >
          <span className="type-emoji">{typeInfo.emoji}</span>
          <span className="type-name">
            {documentType || 'Sin identificar'}
          </span>
        </div>
      )}
    </div>
  )
}
