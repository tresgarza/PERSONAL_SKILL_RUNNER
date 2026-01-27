'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import DocumentViewer from '../components/DocumentViewer'
import PDFPreview from '../components/PDFPreview'
import { useAuth } from '../lib/auth-context'
import { trackSkillUsage, updateSkillUsage, saveSkillData } from '../lib/supabase'
import { useAutoTracking } from '../lib/use-tracking'

// Skills disponibles
const SKILLS: Array<{
  id: string
  name: string
  icon: string
  description: string
  category: string
  acceptedFiles: string
  placeholder: string
  tested: boolean
  externalLink?: string
}> = [
  {
    id: 'pdf-to-excel',
    name: 'PDF → Excel',
    icon: '📄',
    description: 'Extrae tablas de un PDF (estado de cuenta, facturas) y genera un Excel/CSV descargable',
    category: 'Documentos',
    acceptedFiles: '.pdf,.txt,.csv',
    placeholder: 'Ejemplo: "Extrae todas las transacciones de este estado de cuenta bancario"',
    tested: true,
  },
  {
    id: 'cp-validator',
    name: 'Validador de CP',
    icon: '📮',
    description: 'Valida códigos postales contra el catálogo oficial de SEPOMEX y obtén información detallada',
    category: 'Verificación',
    acceptedFiles: '',
    placeholder: '',
    tested: true,
  },
  {
    id: 'address-verifier',
    name: 'Verificador de Direcciones',
    icon: '🏠',
    description: 'Extrae direcciones de recibos (CFE, agua, gas, Telmex) y las verifica contra Google Maps',
    category: 'Verificación',
    acceptedFiles: '.pdf,.jpg,.png,.jpeg',
    placeholder: 'Ejemplo: "Verifica la dirección de este recibo de CFE"',
    tested: true,
  },
  {
    id: 'document-organizer',
    name: 'Organizador de Documentos',
    icon: '📚',
    description: 'Procesa múltiples documentos, identifica su tipo, extrae datos importantes y genera un ZIP organizado',
    category: 'Documentos',
    acceptedFiles: '.pdf,.jpg,.png,.jpeg',
    placeholder: 'Sube múltiples archivos para organizarlos automáticamente',
    tested: true,
  },
  {
    id: 'pdf-merger',
    name: 'Combinar PDFs',
    icon: '🔗',
    description: 'Combina múltiples PDFs en uno solo. Arrastra y ordena los archivos como desees antes de combinarlos',
    category: 'Documentos',
    acceptedFiles: '.pdf',
    placeholder: 'Sube los PDFs que quieres combinar y ordénalos arrastrándolos',
    tested: true,
  },
  {
    id: 'prospection-ai',
    name: 'Prospección con IA',
    icon: '🎯',
    description: 'Busca leads en Apollo, enriquece contactos con emails y genera mensajes personalizados con IA',
    category: 'Ventas',
    acceptedFiles: '',
    placeholder: '',
    tested: true,
    externalLink: '/prospeccion',
  },
  {
    id: 'whatsapp-reply-drafter',
    name: 'Respuestas WhatsApp (rápidas)',
    icon: '💬',
    description: 'Genera 3–5 respuestas cortas para WhatsApp (ventas/soporte), con tono mexicano y CTA claro',
    category: 'Productividad',
    acceptedFiles: '',
    placeholder: 'Pega el mensaje del cliente y el contexto. Ej: “Cliente: ¿cuánto cuesta? Contexto: vendemos servicio express...”',
    tested: true,
  },
  {
    id: 'utm-builder',
    name: 'Generador de UTM Links',
    icon: '🔗',
    description: 'Crea links con UTM + naming consistente (campaign/source/medium/content) y checklist de tracking',
    category: 'Marketing',
    acceptedFiles: '',
    placeholder: 'Pega: URL base + canal + campaña + objetivo (leads/ventas).',
    tested: true,
  },
  {
    id: 'daily-planner',
    name: 'Plan Diario (Monterrey)',
    icon: '🗓️',
    description: 'Convierte tu lista de pendientes en un plan por bloques (deep work, llamadas, admin) con horarios sugeridos',
    category: 'Productividad',
    acceptedFiles: '.txt,.md',
    placeholder: 'Pega tus pendientes + restricciones (reuniones, energía, deadlines).',
    tested: true,
  },
  {
    id: 'brief-to-tasks',
    name: 'Brief → Checklist de tareas',
    icon: '✅',
    description: 'Convierte un brief en checklist ejecutable (definición de done, riesgos, estimación rápida)',
    category: 'Desarrollo',
    acceptedFiles: '.txt,.md',
    placeholder: 'Pega el brief o el mensaje del cliente.',
    tested: true,
  },
  {
    id: 'presentation-creator',
    name: 'Creador de Presentaciones',
    icon: '📊',
    description: 'Crea presentaciones PPTX profesionales con diseño visual, gráficos y layouts personalizados usando html2pptx',
    category: 'Ventas',
    acceptedFiles: '.pptx,.pdf',
    placeholder: 'Describe tu presentación: tema, audiencia, número de slides y estilo deseado...',
    tested: false,
    // Skill relacionado: .cursor/anthropic-official-skills/skills/pptx/SKILL.md
    // Funcionalidades: html2pptx workflow, paletas de color, layouts, charts, templates
  },
  {
    id: 'invoice-organizer',
    name: 'Organizador de Facturas',
    icon: '🧾',
    description: 'Organiza facturas y recibos automáticamente para preparación de impuestos',
    category: 'Finanzas',
    acceptedFiles: '.pdf,.jpg,.png,.txt',
    placeholder: 'Ejemplo: "Organiza estas facturas por fecha y calcula el total de IVA"',
    tested: false,
  },
  {
    id: 'file-organizer',
    name: 'Organizador de Archivos',
    icon: '📁',
    description: 'Sugiere cómo organizar tus archivos y carpetas de forma inteligente',
    category: 'Productividad',
    acceptedFiles: '*',
    placeholder: 'Describe la estructura actual de tus archivos o pega una lista...',
    tested: false,
  },
  {
    id: 'changelog-generator',
    name: 'Generador de Changelog',
    icon: '📝',
    description: 'Genera notas de versión profesionales a partir de commits de Git',
    category: 'Desarrollo',
    acceptedFiles: '.txt,.md',
    placeholder: 'Pega tus commits de Git aquí o describe los cambios...',
    tested: false,
  },
  {
    id: 'meeting-analyzer',
    name: 'Analizador de Reuniones',
    icon: '🎯',
    description: 'Analiza transcripciones de reuniones y extrae insights y action items',
    category: 'Productividad',
    acceptedFiles: '.txt,.md,.vtt,.srt',
    placeholder: 'Pega la transcripción de tu reunión aquí...',
    tested: false,
  },
  {
    id: 'content-writer',
    name: 'Escritor de Contenido',
    icon: '✍️',
    description: 'Ayuda a escribir contenido con investigación, citas y feedback',
    category: 'Marketing',

    acceptedFiles: '.txt,.md,.docx',
    placeholder: 'Describe el tema sobre el que quieres escribir...',
    tested: false,
  },
  // ===== SKILLS DE VENTAS/MARKETING (PENDIENTES) =====
  {
    id: 'proposal-generator',
    name: 'Generador de Propuestas',
    icon: '📋',
    description: 'Genera propuestas comerciales PDF personalizadas con datos del prospecto, beneficios por industria y casos de éxito',
    category: 'Ventas',
    acceptedFiles: '.pdf,.docx',
    placeholder: 'Ingresa datos del prospecto: empresa, industria, tamaño, necesidades...',
    tested: false,
  },
  {
    id: 'followup-sequencer',
    name: 'Secuenciador de Follow-ups',
    icon: '📨',
    description: 'Genera secuencias completas de 5-7 emails de seguimiento: introducción, valor, caso de éxito, urgencia y break-up',
    category: 'Ventas',
    acceptedFiles: '',
    placeholder: 'Describe el prospecto y el contexto del primer contacto...',
    tested: false,
  },
  {
    id: 'competitor-analyzer',
    name: 'Analizador de Competencia',
    icon: '🔍',
    description: 'Analiza competidores: propuesta de valor, precios, diferenciadores, debilidades y talking points para vendedores',
    category: 'Ventas',
    acceptedFiles: '.txt,.pdf',
    placeholder: 'Ingresa URL del competidor o nombre de empresa...',
    tested: false,
  },
  {
    id: 'linkedin-content',
    name: 'Contenido para LinkedIn',
    icon: '💼',
    description: 'Genera posts de LinkedIn para founders, vendedores y empresa: carruseles, posts de texto y encuestas',
    category: 'Marketing',
    acceptedFiles: '.txt,.md',
    placeholder: 'Describe el tema o mensaje que quieres comunicar...',
    tested: false,
  },
  {
    id: 'lead-scorer',
    name: 'Calificador de Leads',
    icon: '⭐',
    description: 'Califica leads con score 1-100, probabilidad de cierre, objeciones probables y recomendación de siguiente paso',
    category: 'Ventas',
    acceptedFiles: '.csv,.xlsx',
    placeholder: 'Ingresa datos del prospecto para calificar...',
    tested: false,
  },
  {
    id: 'call-scripts',
    name: 'Scripts de Llamada',
    icon: '📞',
    description: 'Genera scripts para cold calls, discovery, demos, manejo de objeciones y cierre, personalizados por industria',
    category: 'Ventas',
    acceptedFiles: '',
    placeholder: 'Describe el tipo de llamada y el perfil del prospecto...',
    tested: false,
  },
  {
    id: 'case-study-creator',
    name: 'Creador de Casos de Éxito',
    icon: '🏆',
    description: 'Crea casos de éxito: one-pager PDF, post LinkedIn, slide para presentaciones y email para prospectos similares',
    category: 'Marketing',
    acceptedFiles: '.txt,.pdf,.docx',
    placeholder: 'Ingresa datos del cliente, métricas de éxito y testimonial...',
    tested: false,
  },
  // ===== SKILLS DE UTILIDAD (PENDIENTES) =====
  {
    id: 'raffle-picker',
    name: 'Selector de Ganadores',
    icon: '🎰',
    description: 'Selecciona ganadores aleatorios de listas, CSV, Excel o Google Sheets para rifas, sorteos y concursos',
    category: 'Productividad',
    acceptedFiles: '.csv,.xlsx,.txt',
    placeholder: 'Pega la lista de participantes o sube un archivo CSV/Excel...',
    tested: false,
    // Skill relacionado: .cursor/awesome-claude-skills/raffle-winner-picker/SKILL.md
    // Funcionalidades: selección criptográficamente segura, múltiples ganadores, exclusiones, ponderación
  },
  {
    id: 'video-downloader',
    name: 'Descargador de Videos',
    icon: '📹',
    description: 'Descarga videos de YouTube con opciones de calidad (1080p, 720p, etc.) y formato (mp4, webm, mp3 audio)',
    category: 'Productividad',
    acceptedFiles: '',
    placeholder: 'Pega la URL del video de YouTube que deseas descargar...',
    tested: false,
    // Skill relacionado: .cursor/awesome-claude-skills/video-downloader/SKILL.md
    // Funcionalidades: yt-dlp, múltiples calidades, audio-only, custom output directory
  },
]

// Tipos de documentos Fincentiva en orden requerido
const FINCENTIVA_DOC_TYPES = [
  'SOLICITUD',
  'ANEXO A',
  'TABLA DE AMORTIZACION',
  'CARATULA',
  'CONTRATO',
  'PAGARE',
  'BURO',
  'MANDATO'
] as const

// Emojis para cada tipo de documento
const DOC_TYPE_ICONS: Record<string, string> = {
  'SOLICITUD': '📝',
  'ANEXO A': '📎',
  'TABLA DE AMORTIZACION': '📊',
  'CARATULA': '📋',
  'CONTRATO': '📜',
  'PAGARE': '💰',
  'BURO': '🏦',
  'MANDATO': '✍️'
}

interface SepomexValidation {
  cp_valido: boolean
  colonia_coincide: boolean
  municipio_coincide: boolean
  estado_coincide: boolean
  validaciones: string[]
  sugerencias_sepomex: string[]
  colonias_validas_para_cp: string[]
  datos_oficiales: {
    colonia_oficial: string
    municipio_oficial: string
    estado_oficial: string
    ciudad_oficial: string
  } | null
}

interface AlertaRiesgo {
  nivel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO'
  tipo: string
  mensaje: string
  accionRecomendada: string
}

interface ResumenMesaControl {
  puede_aprobar: boolean
  requiere_revision: boolean
  debe_rechazar: boolean
  nivel_riesgo_maximo: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO' | null
  total_alertas: number
  alertas_criticas: number
  alertas_altas: number
}

interface AddressVerification {
  direccion_documento: string
  tipo_documento: string
  nombre_servicio: string
  direccion_google: string
  coordenadas: { lat: number; lng: number }
  coincidencia: number
  diferencias: string[]
  link_google_maps: string
  validacion_sepomex?: SepomexValidation
  alertas_riesgo?: AlertaRiesgo[]
  estado_validacion?: 'APROBADO' | 'REVISION_REQUERIDA' | 'RECHAZADO'
  resumen_mesa_control?: ResumenMesaControl
}

interface PayrollAnalysis {
  cantidad_nominas: number
  promedio_ingreso: number
  periodicidad: string
  ingreso_mensual_estimado: number
  sueldos_encontrados: number[]
  descripcion_periodicidad: string
}

interface SkillResult {
  result: string
  csv?: string
  csvFileName?: string
  jsonData?: Record<string, unknown>
  addressVerification?: AddressVerification
  zipUrl?: string
  zipFileName?: string
  documentsData?: Array<{
    nombre_cliente: string
    tipo_documento: string
    fecha_documento: string
    datos_extraidos: Record<string, any>
    nombre_archivo_original: string
    nombre_archivo_nuevo: string
  }>
  payrollAnalysis?: PayrollAnalysis
}

// Este componente no usa searchParams ni params, pero Next.js 15 muestra advertencias
// durante el desarrollo cuando las herramientas inspeccionan el componente.
// Estas advertencias no afectan la funcionalidad y pueden ser ignoradas.
export default function Home() {
  // Supabase Auth
  const { user, loading: authLoading, signIn, signOut, isAdmin } = useAuth()
  
  // Auto-tracking de navegación y eventos
  useAutoTracking()
  
  // Auth form states
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading2, setAuthLoading2] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // Notification for pending skills
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  
  const [selectedSkill, setSelectedSkill] = useState<typeof SKILLS[0] | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [userInput, setUserInput] = useState('')
  const [result, setResult] = useState<SkillResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  
  // Estados para barra de progreso
  const [progress, setProgress] = useState({
    percentage: 0,
    message: '',
    current: 0,
    total: 0,
    step: '',
  })
  
  // Estados para validador de CP
  const [cpInput, setCpInput] = useState('')
  const [cpResult, setCpResult] = useState<any>(null)
  const [isValidatingCp, setIsValidatingCp] = useState(false)
  
  // Estados para combinador de PDFs
  const [pdfOrder, setPdfOrder] = useState<number[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null)
  const [pdfMergeMode, setPdfMergeMode] = useState<'general' | 'fincentiva'>('general')
  const [fincentivaAnalysis, setFincentivaAnalysis] = useState<{
    identified: Array<{ type: string; index: number; fileName: string }>;
    unidentified: Array<{ index: number; fileName: string }>;
    missing: string[];
    suggestedOrder: number[];
  } | null>(null)
  const [showMissingDocsModal, setShowMissingDocsModal] = useState(false)
  const [isAnalyzingDocs, setIsAnalyzingDocs] = useState(false)
  // Document types detected for general mode (index -> documentType)
  const [generalDocTypes, setGeneralDocTypes] = useState<Map<number, string | null>>(new Map())
  
  // Ref para hacer scroll al panel de ejecución
  const executionPanelRef = useRef<HTMLDivElement>(null)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  // Handle login form submission
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading2(true)
    
    try {
      await signIn(authEmail, authPassword)
    } catch (error: unknown) {
      const err = error as Error
      setAuthError(err.message || 'Error de autenticación')
    } finally {
      setAuthLoading2(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAuth(e as unknown as React.FormEvent)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (selectedSkill?.id === 'document-organizer' || selectedSkill?.id === 'pdf-merger') {
        // Permitir múltiples archivos para el organizador y combinador de PDFs
        const newFiles = Array.from(e.target.files).filter(f => 
          selectedSkill?.id === 'pdf-merger' ? f.type === 'application/pdf' : true
        )
        setFiles(newFiles)
        setFile(null)
        // Inicializar el orden para pdf-merger
        if (selectedSkill?.id === 'pdf-merger') {
          setPdfOrder(newFiles.map((_, i) => i))
          setMergedPdfUrl(null)
        }
      } else {
        // Un solo archivo para otros skills
        setFile(e.target.files[0])
        setFiles([])
      }
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files) {
      if (selectedSkill?.id === 'document-organizer' || selectedSkill?.id === 'pdf-merger') {
        // Permitir múltiples archivos para el organizador y combinador de PDFs
        const newFiles = Array.from(e.dataTransfer.files).filter(f => 
          selectedSkill?.id === 'pdf-merger' ? f.type === 'application/pdf' : true
        )
        setFiles(newFiles)
        setFile(null)
        // Inicializar el orden para pdf-merger
        if (selectedSkill?.id === 'pdf-merger') {
          setPdfOrder(newFiles.map((_, i) => i))
          setMergedPdfUrl(null)
        }
      } else {
        // Un solo archivo para otros skills
        setFile(e.dataTransfer.files[0])
        setFiles([])
      }
    }
  }, [selectedSkill])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Funciones para combinador de PDFs
  const handlePdfDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handlePdfDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    const newOrder = [...pdfOrder]
    const draggedItem = newOrder[draggedIndex]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(index, 0, draggedItem)
    setPdfOrder(newOrder)
    setDraggedIndex(index)
  }

  const handlePdfDragEnd = () => {
    setDraggedIndex(null)
  }

  const removePdf = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    const newOrder = pdfOrder.filter((_, i) => i !== index).map((val, i) => 
      val > index ? val - 1 : val
    )
    setPdfOrder(newOrder.length > 0 ? newOrder : newFiles.map((_, i) => i))
    setMergedPdfUrl(null)
  }

  const mergePdfs = async (skipMissingCheck = false) => {
    if (files.length === 0) {
      setResult({ result: 'Error: Debes subir al menos un PDF' })
      return
    }

    // En modo Fincentiva, verificar documentos faltantes
    if (pdfMergeMode === 'fincentiva' && fincentivaAnalysis && fincentivaAnalysis.missing.length > 0 && !skipMissingCheck) {
      setShowMissingDocsModal(true)
      return
    }

    setIsLoading(true)
    setResult(null)
    setShowMissingDocsModal(false)
    setProgress({ percentage: 0, message: 'Combinando PDFs...', current: 0, total: files.length, step: '' })

    try {
      const formData = new FormData()
      files.forEach((f) => {
        formData.append('files', f)
      })
      formData.append('order', JSON.stringify(pdfOrder))
      formData.append('mode', pdfMergeMode)

      const response = await fetch('/api/merge-pdfs', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al combinar PDFs')
      }

      const data = await response.json()

      // Convertir base64 a blob y crear URL
      const binaryString = atob(data.pdf)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setMergedPdfUrl(url)

      setProgress({ percentage: 100, message: 'PDFs combinados exitosamente', current: files.length, total: files.length, step: 'Completado' })
      
      let resultMessage = `✅ PDFs combinados exitosamente!\n\nTotal de archivos: ${data.totalFiles}\nTotal de páginas: ${data.totalPages}`
      
      if (pdfMergeMode === 'fincentiva' && data.analysis) {
        resultMessage += `\n\n📋 Modo: Expediente Fincentiva`
        resultMessage += `\n✅ Documentos identificados: ${data.analysis.identified.length}/${FINCENTIVA_DOC_TYPES.length}`
        if (data.analysis.missing.length > 0) {
          resultMessage += `\n⚠️ Documentos faltantes: ${data.analysis.missing.join(', ')}`
        }
      }
      
      resultMessage += `\n\nHaz clic en "Descargar PDF Combinado" para descargar el archivo.`
      
      setResult({ result: resultMessage })
    } catch (error) {
      console.error('Error combinando PDFs:', error)
      setResult({ result: `Error: ${error instanceof Error ? error.message : 'Error desconocido al combinar PDFs'}` })
    } finally {
      setIsLoading(false)
    }
  }

  const downloadMergedPdf = () => {
    if (!mergedPdfUrl) return
    
    const link = document.createElement('a')
    link.href = mergedPdfUrl
    link.download = pdfMergeMode === 'fincentiva' 
      ? `expediente_fincentiva_${Date.now()}.pdf`
      : `pdf_combinado_${Date.now()}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Función para analizar archivos en modo Fincentiva
  const analyzeForFincentiva = async (filesToAnalyze: File[]) => {
    if (filesToAnalyze.length === 0) return
    
    setIsAnalyzingDocs(true)
    
    try {
      const formData = new FormData()
      filesToAnalyze.forEach((f) => {
        formData.append('files', f)
      })
      formData.append('mode', 'fincentiva')
      formData.append('analyzeOnly', 'true')

      const response = await fetch('/api/merge-pdfs', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Error al analizar documentos')
      }

      const data = await response.json()
      
      if (data.analysis) {
        setFincentivaAnalysis(data.analysis)
        setPdfOrder(data.analysis.suggestedOrder)
      }
    } catch (error) {
      console.error('Error analizando documentos:', error)
    } finally {
      setIsAnalyzingDocs(false)
    }
  }

  // Función para analizar tipos de documento en modo general
  const analyzeForGeneral = async (filesToAnalyze: File[]) => {
    if (filesToAnalyze.length === 0) {
      setGeneralDocTypes(new Map())
      return
    }
    
    setIsAnalyzingDocs(true)
    
    try {
      const formData = new FormData()
      filesToAnalyze.forEach((f) => {
        formData.append('files', f)
      })
      formData.append('mode', 'general')
      formData.append('analyzeOnly', 'true')

      const response = await fetch('/api/merge-pdfs', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Error al analizar documentos')
      }

      const data = await response.json()
      
      if (data.analysis) {
        // Create map of index -> documentType
        const newDocTypes = new Map<number, string | null>()
        data.analysis.identified.forEach((doc: { index: number; type: string }) => {
          newDocTypes.set(doc.index, doc.type)
        })
        data.analysis.unidentified.forEach((doc: { index: number }) => {
          newDocTypes.set(doc.index, null)
        })
        setGeneralDocTypes(newDocTypes)
      }
    } catch (error) {
      console.error('Error analizando documentos:', error)
    } finally {
      setIsAnalyzingDocs(false)
    }
  }

  // Efecto para re-analizar cuando cambia el modo o los archivos
  useEffect(() => {
    if (pdfMergeMode === 'fincentiva' && files.length > 0) {
      analyzeForFincentiva(files)
    } else if (pdfMergeMode === 'general') {
      setFincentivaAnalysis(null)
      setPdfOrder(files.map((_, i) => i))
      // Analyze for document types in general mode
      if (files.length > 0) {
        analyzeForGeneral(files)
      } else {
        setGeneralDocTypes(new Map())
      }
    }
  }, [pdfMergeMode, files])

  const downloadCSV = () => {
    if (!result?.csv || !result?.csvFileName) return
    
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.csvFileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadExcel = () => {
    if (!result?.csv || !result?.csvFileName) return
    
    // Para un Excel real, usaríamos una librería como xlsx
    // Por ahora, descargamos CSV que Excel puede abrir
    const blob = new Blob(['\ufeff' + result.csv], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.csvFileName.replace('.csv', '.xls')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadZip = async () => {
    if (!result?.zipUrl || !result?.zipFileName) return
    
    try {
      const response = await fetch(result.zipUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.zipFileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      setResult({ result: `Error al descargar ZIP: ${error instanceof Error ? error.message : 'Error desconocido'}` })
    }
  }

  const executeSkill = async () => {
    if (!selectedSkill) return
    
    // Validar que haya archivos
    if (selectedSkill.id === 'document-organizer' || selectedSkill.id === 'pdf-merger') {
      if (files.length === 0) {
        setResult({ result: 'Error: Debes subir al menos un archivo' })
        return
      }
      // pdf-merger tiene su propio botón de ejecución
      if (selectedSkill.id === 'pdf-merger') {
        return
      }
    } else {
      if (!file && selectedSkill.acceptedFiles) {
        setResult({ result: 'Error: Debes subir un archivo' })
        return
      }
    }
    
    setIsLoading(true)
    setResult(null)
    setProgress({ percentage: 0, message: 'Iniciando...', current: 0, total: 0, step: '' })
    
    try {
      // Usar endpoint SSE para organizador de documentos
      if (selectedSkill.id === 'document-organizer') {
        const formData = new FormData()
        files.forEach((f) => {
          formData.append('files', f)
        })
        
        const response = await fetch('/api/process-documents', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.body) {
          throw new Error('No se pudo establecer conexión de streaming')
        }
        
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const text = decoder.decode(value)
          const lines = text.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'progress' || data.type === 'start') {
                  setProgress({
                    percentage: data.percentage || 0,
                    message: data.message || '',
                    current: data.current || 0,
                    total: data.total || 0,
                    step: data.step || '',
                  })
                } else if (data.type === 'complete') {
                  setProgress({
                    percentage: 100,
                    message: data.message,
                    current: data.result?.documentsData?.length || 0,
                    total: data.result?.documentsData?.length || 0,
                    step: 'complete',
                  })
                  setResult({
                    result: data.message,
                    csv: data.result.csv,
                    csvFileName: data.result.csvFileName,
                    documentsData: data.result.documentsData,
                    zipUrl: data.result.zipUrl,
                    zipFileName: data.result.zipFileName,
                    payrollAnalysis: data.result.payrollAnalysis,
                  })
                } else if (data.type === 'error') {
                  setResult({ result: `Error: ${data.message}` })
                }
              } catch (e) {
                // Ignorar líneas mal formadas
              }
            }
          }
        }
      } else {
        // Otros skills usan el endpoint normal
        const formData = new FormData()
        formData.append('skillId', selectedSkill.id)
        formData.append('userInput', userInput)
        
        if (file) {
          formData.append('file', file)
        }
        
        const response = await fetch('/api/execute-skill', {
          method: 'POST',
          body: formData,
        })
        
        const data = await response.json()
        
        if (data.error) {
          setResult({ result: `Error: ${data.error}` })
        } else {
          setResult(data)
        }
      }
    } catch (error) {
      setResult({ result: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}` })
    } finally {
      setIsLoading(false)
    }
  }

  const validatePostalCode = async () => {
    if (!cpInput || !/^\d{5}$/.test(cpInput)) {
      setCpResult({ error: 'Ingresa un código postal válido de 5 dígitos' })
      return
    }

    setIsValidatingCp(true)
    setCpResult(null)

    try {
      const response = await fetch(`/api/validate-cp?cp=${cpInput}`)
      const data = await response.json()
      setCpResult(data)
    } catch (error) {
      setCpResult({ error: 'Error al validar el código postal' })
    } finally {
      setIsValidatingCp(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Pantalla de carga
  if (authLoading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">⚡</div>
          <h1>Skill Runner</h1>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  // Pantalla de login (solo login, sin registro)
  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">🔐</div>
          <h1>Skill Runner</h1>
          <p>Inicia sesión para continuar</p>
          
          <form className="login-form" onSubmit={handleAuth}>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => {
                setAuthEmail(e.target.value)
                setAuthError('')
              }}
              placeholder="Correo electrónico"
              className={authError ? 'error' : ''}
              autoFocus
              required
            />
            
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={authPassword}
                onChange={(e) => {
                  setAuthPassword(e.target.value)
                  setAuthError('')
                }}
                onKeyPress={handleKeyPress}
                placeholder="Contraseña"
                className={authError ? 'error' : ''}
                required
                minLength={6}
              />
              <button 
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            {authError && (
              <span className="error-message">{authError}</span>
            )}
            
            <button 
              type="submit" 
              className="login-btn"
              disabled={authLoading2}
            >
              {authLoading2 ? 'Cargando...' : 'Iniciar sesión'}
            </button>
          </form>
          
          <p className="login-footer">
            Powered by Claude AI + Supabase
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      {/* Notification Toast */}
      {showNotification && (
        <div className="notification-toast">
          <span className="notification-icon">🚧</span>
          <span className="notification-message">{notificationMessage}</span>
        </div>
      )}
      
      <header className="header">
        <h1>⚡ Skill Runner</h1>
        <p>Selecciona un skill y ejecuta tareas con Claude AI</p>
        <div className="user-info">
          <div className="user-info-left">
            <span className="user-email">{user.email}</span>
            {isAdmin && <span className="admin-badge">👑 Admin</span>}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="skills-grid">
        {SKILLS.map((skill) => (
          skill.externalLink ? (
            <a
              key={skill.id}
              href={skill.externalLink}
              className={`skill-card skill-link`}
            >
              {skill.tested && (
                <div className="tested-badge" title="Skill testeado y funcionando">
                  ✓
                </div>
              )}
              <div className="external-badge" title="Abre en nueva página">
                ↗
              </div>
              <div className="skill-icon">{skill.icon}</div>
              <h3>{skill.name}</h3>
              <p>{skill.description}</p>
              <span className="skill-category">{skill.category}</span>
            </a>
          ) : (
            <div
              key={skill.id}
              className={`skill-card ${selectedSkill?.id === skill.id ? 'selected' : ''} ${!skill.tested && !isAdmin ? 'skill-locked' : ''}`}
              onClick={() => {
                // Si el skill no está testeado y el usuario NO es admin, mostrar notificación
                if (!skill.tested && !isAdmin) {
                  setNotificationMessage(`"${skill.name}" está en desarrollo. ¡Próximamente disponible!`)
                  setShowNotification(true)
                  setTimeout(() => setShowNotification(false), 3000)
                  return
                }
                
                setSelectedSkill(skill)
                setFile(null)
                setFiles([])
                setUserInput('')
                setResult(null)
                setCpResult(null)
                setCpInput('')
                // Resetear estado del combinador de PDFs
                setPdfOrder([])
                setMergedPdfUrl(null)
                setDraggedIndex(null)
                setPdfMergeMode('general')
                setFincentivaAnalysis(null)
                setShowMissingDocsModal(false)
                
                // Hacer scroll al panel de ejecución después de un pequeño delay
                setTimeout(() => {
                  executionPanelRef.current?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                  })
                }, 100)
              }}
            >
              {skill.tested ? (
                <div className="tested-badge" title="Skill testeado y funcionando">
                  ✓
                </div>
              ) : (
                <div className="pending-badge" title={isAdmin ? "Skill en desarrollo (Admin: puedes acceder)" : "Skill en desarrollo"}>
                  ⏳
                </div>
              )}
              <div className="skill-icon">{skill.icon}</div>
              <h3>{skill.name}</h3>
              <p>{skill.description}</p>
              <span className={`skill-category category-${skill.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}>{skill.category}</span>
            </div>
          )
        ))}
      </div>

      {selectedSkill && (
        <div className="execution-panel" ref={executionPanelRef}>
          <h2>
            {selectedSkill.icon} {selectedSkill.name}
          </h2>

          {/* Validador de CP - Panel especial */}
          {selectedSkill.id === 'cp-validator' ? (
            <div className="cp-validator-content">
              <p className="cp-validator-description">
                Valida códigos postales contra el catálogo oficial de SEPOMEX y obtén información detallada
              </p>
              
              <div className="cp-input-group">
                <input
                  type="text"
                  className="cp-input"
                  placeholder="Ejemplo: 64720"
                  value={cpInput}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 5)
                    setCpInput(value)
                    setCpResult(null)
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      validatePostalCode()
                    }
                  }}
                  maxLength={5}
                />
                <button
                  className="validate-cp-btn"
                  onClick={validatePostalCode}
                  disabled={isValidatingCp || !cpInput || cpInput.length !== 5}
                >
                  {isValidatingCp ? (
                    <>
                      <span className="spinner"></span>
                      Validando...
                    </>
                  ) : (
                    <>
                      🔍 Validar CP
                    </>
                  )}
                </button>
              </div>

              {cpResult && (
                <div className={`cp-result ${cpResult.existe === false ? 'cp-invalid' : cpResult.existe === true ? 'cp-valid' : 'cp-error'}`}>
                  {cpResult.error ? (
                    <div className="cp-error-message">
                      <span className="error-icon">❌</span>
                      <span>{cpResult.error}</span>
                    </div>
                  ) : cpResult.existe === false ? (
                    <div className="cp-not-found">
                      <div className="cp-status-header">
                        <span className="status-icon">❌</span>
                        <span className="status-title">Código Postal No Válido</span>
                      </div>
                      <div className="cp-status-message">{cpResult.mensaje}</div>
                    </div>
                  ) : cpResult.existe === true ? (
                    <div className="cp-found">
                      <div className="cp-status-header">
                        <span className="status-icon">✅</span>
                        <span className="status-title">Código Postal Válido</span>
                        <span className="cp-badge">CP {cpResult.cp}</span>
                      </div>

                      <div className="cp-info-grid">
                        <div className="cp-info-card">
                          <div className="cp-info-label">📍 Ubicación</div>
                          <div className="cp-info-value">
                            <div><strong>Estado:</strong> {cpResult.ubicacion.estado}</div>
                            <div><strong>Municipio:</strong> {cpResult.ubicacion.municipio}</div>
                            {cpResult.ubicacion.ciudad && (
                              <div><strong>Ciudad:</strong> {cpResult.ubicacion.ciudad}</div>
                            )}
                          </div>
                        </div>

                        <div className="cp-info-card">
                          <div className="cp-info-label">📊 Estadísticas</div>
                          <div className="cp-info-value">
                            <div><strong>Total Colonias:</strong> {cpResult.total_colonias}</div>
                            <div><strong>Total Registros:</strong> {cpResult.total_registros}</div>
                            <div><strong>Tipos de Asentamiento:</strong> {cpResult.tipos_asentamiento.length}</div>
                          </div>
                        </div>
                      </div>

                      <div className="cp-colonias-section">
                        <div className="cp-section-header">
                          <span className="cp-section-title">🏘️ Colonias ({cpResult.total_colonias})</span>
                          <button
                            className={`copy-btn ${copied === 'colonias' ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(cpResult.colonias.join(', '), 'colonias')}
                          >
                            {copied === 'colonias' ? '✓ Copiado' : '📋 Copiar Lista'}
                          </button>
                        </div>
                        <div className="cp-colonias-list">
                          {cpResult.colonias.slice(0, 20).map((colonia: string, i: number) => (
                            <span key={i} className="colonia-badge">{colonia}</span>
                          ))}
                          {cpResult.colonias.length > 20 && (
                            <span className="colonia-more">... y {cpResult.colonias.length - 20} más</span>
                          )}
                        </div>
                      </div>

                      {Object.keys(cpResult.colonias_por_tipo).length > 0 && (
                        <div className="cp-tipos-section">
                          <div className="cp-section-title">🏛️ Colonias por Tipo de Asentamiento</div>
                          {Object.entries(cpResult.colonias_por_tipo).map(([tipo, colonias]: [string, any]) => (
                            <details key={tipo} className="cp-tipo-details">
                              <summary>
                                <strong>{tipo}</strong> ({colonias.length} colonias)
                              </summary>
                              <div className="cp-tipo-colonias">
                                {colonias.map((col: string, i: number) => (
                                  <span key={i} className="colonia-badge small">{col}</span>
                                ))}
                              </div>
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                className={`dropzone ${(file || files.length > 0) ? 'active' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept={selectedSkill.acceptedFiles}
                  onChange={handleFileChange}
                  multiple={selectedSkill.id === 'document-organizer' || selectedSkill.id === 'pdf-merger'}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-icon">📎</div>
                <p>
                  <strong>
                    {(selectedSkill.id === 'document-organizer' || selectedSkill.id === 'pdf-merger')
                      ? 'Arrastra múltiples archivos aquí' 
                      : 'Arrastra un archivo aquí'}
                  </strong> o haz clic para seleccionar
                </p>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Acepta: {selectedSkill.acceptedFiles}
                  {(selectedSkill.id === 'document-organizer' || selectedSkill.id === 'pdf-merger') && ' (múltiples archivos)'}
                </p>
              </div>

          {/* Mostrar archivos individuales para skills normales */}
          {file && selectedSkill.id !== 'document-organizer' && selectedSkill.id !== 'pdf-merger' && (
            <div className="file-preview">
              <span className="file-icon">📄</span>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-size">{formatFileSize(file.size)}</div>
              </div>
              <button 
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Mostrar lista de archivos para organizador de documentos */}
          {selectedSkill.id === 'document-organizer' && files.length > 0 && (
            <div className="files-list">
              <div className="files-list-header">
                <span>📚 Archivos seleccionados ({files.length})</span>
                <button 
                  className="clear-all-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFiles([])
                  }}
                >
                  Limpiar todo
                </button>
              </div>
              <div className="files-grid">
                {files.map((f, index) => (
                  <div key={index} className="file-preview">
                    <span className="file-icon">📄</span>
                    <div className="file-info">
                      <div className="file-name">{f.name}</div>
                      <div className="file-size">{formatFileSize(f.size)}</div>
                    </div>
                    <button 
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFiles(files.filter((_, i) => i !== index))
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedSkill.id === 'pdf-merger' && (
            <div className="pdf-merger-content">
              {/* Selector de modo */}
              <div className="pdf-mode-selector">
                <button
                  className={`mode-btn ${pdfMergeMode === 'general' ? 'active' : ''}`}
                  onClick={() => setPdfMergeMode('general')}
                >
                  <span className="mode-icon">📄</span>
                  <span className="mode-label">General</span>
                  <span className="mode-desc">Orden manual</span>
                </button>
                <button
                  className={`mode-btn fincentiva ${pdfMergeMode === 'fincentiva' ? 'active' : ''}`}
                  onClick={() => setPdfMergeMode('fincentiva')}
                >
                  <span className="mode-icon">💰</span>
                  <span className="mode-label">Fincentiva</span>
                  <span className="mode-desc">Orden automático</span>
                </button>
              </div>

              <p className="pdf-merger-description">
                {pdfMergeMode === 'fincentiva' 
                  ? 'Sube los documentos del expediente Fincentiva. Se ordenarán automáticamente según el formato requerido.'
                  : 'Sube los PDFs que quieres combinar y arrastra para ordenarlos. El orden en que aparecen aquí será el orden final del PDF combinado.'
                }
              </p>

              {/* Orden Fincentiva esperado */}
              {pdfMergeMode === 'fincentiva' && (
                <div className="fincentiva-order-guide">
                  <p className="guide-title">📋 Orden del Expediente:</p>
                  <div className="guide-items">
                    {FINCENTIVA_DOC_TYPES.map((docType, i) => {
                      const isFound = fincentivaAnalysis?.identified.some(d => d.type === docType)
                      return (
                        <span 
                          key={docType} 
                          className={`guide-item ${isFound ? 'found' : 'missing'}`}
                        >
                          <span className="guide-number">{i + 1}</span>
                          <span className="guide-icon">{DOC_TYPE_ICONS[docType]}</span>
                          <span className="guide-name">{docType}</span>
                          {files.length > 0 && (
                            <span className="guide-status">
                              {isFound ? '✅' : '❌'}
                            </span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Indicador de análisis */}
              {isAnalyzingDocs && (
                <div className="analyzing-docs">
                  <span className="spinner"></span>
                  <span>Identificando documentos...</span>
                </div>
              )}
              
              {files.length > 0 && !isAnalyzingDocs && (
                <div className="pdf-order-list">
                  <div className="pdf-order-header">
                    <span>
                      {pdfMergeMode === 'fincentiva' 
                        ? `📋 Documentos del Expediente (${fincentivaAnalysis?.identified.length || 0}/${FINCENTIVA_DOC_TYPES.length} identificados)`
                        : `📄 Orden de los PDFs (${files.length})`
                      }
                    </span>
                    <button 
                      className="clear-all-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFiles([])
                        setPdfOrder([])
                        setMergedPdfUrl(null)
                        setFincentivaAnalysis(null)
                      }}
                    >
                      Limpiar todo
                    </button>
                  </div>

                  {/* Vista Fincentiva */}
                  {pdfMergeMode === 'fincentiva' && fincentivaAnalysis && (
                    <div className="fincentiva-docs-list">
                      {/* Documentos identificados */}
                      {fincentivaAnalysis.identified.length > 0 && (
                        <div className="docs-section identified">
                          <p className="docs-section-title">✅ Documentos Identificados</p>
                          <div className="pdf-preview-grid">
                            {FINCENTIVA_DOC_TYPES.map((docType, displayIndex) => {
                              const doc = fincentivaAnalysis.identified.find(d => d.type === docType)
                              if (!doc) return null
                              const file = files[doc.index]
                              return (
                                <div
                                  key={doc.index}
                                  className="pdf-preview-card fincentiva-card"
                                >
                                  <div className="preview-order-badge">{displayIndex + 1}</div>
                                  <button 
                                    className="preview-remove-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const newFiles = files.filter((_, i) => i !== doc.index)
                                      setFiles(newFiles)
                                      setMergedPdfUrl(null)
                                    }}
                                  >
                                    ✕
                                  </button>
                                  <PDFPreview 
                                    file={file}
                                    width={140}
                                    height={180}
                                    documentType={docType}
                                    showLabel={true}
                                  />
                                  <div className="preview-file-name" title={file.name}>
                                    {file.name}
                                  </div>
                                  <div className="preview-file-size">
                                    {formatFileSize(file.size)}
                                  </div>
                                </div>
                              )
                            }).filter(Boolean)}
                          </div>
                        </div>
                      )}

                      {/* Documentos no identificados */}
                      {fincentivaAnalysis.unidentified.length > 0 && (
                        <div className="docs-section unidentified">
                          <p className="docs-section-title">⚠️ Documentos No Identificados</p>
                          <p className="docs-section-hint">Estos archivos se agregarán al final del expediente</p>
                          <div className="pdf-preview-grid">
                            {fincentivaAnalysis.unidentified.map((doc, i) => {
                              const file = files[doc.index]
                              return (
                                <div
                                  key={doc.index}
                                  className="pdf-preview-card unidentified-card"
                                >
                                  <div className="preview-order-badge unidentified">?</div>
                                  <button 
                                    className="preview-remove-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const newFiles = files.filter((_, i) => i !== doc.index)
                                      setFiles(newFiles)
                                      setMergedPdfUrl(null)
                                    }}
                                  >
                                    ✕
                                  </button>
                                  <PDFPreview 
                                    file={file}
                                    width={140}
                                    height={180}
                                    documentType={null}
                                    showLabel={true}
                                  />
                                  <div className="preview-file-name" title={file.name}>
                                    {file.name}
                                  </div>
                                  <div className="preview-file-size">
                                    {formatFileSize(file.size)}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Resumen de documentos faltantes */}
                      {fincentivaAnalysis.missing.length > 0 && (
                        <div className="docs-section missing">
                          <p className="docs-section-title">❌ Documentos Faltantes ({fincentivaAnalysis.missing.length})</p>
                          <div className="missing-docs-list">
                            {fincentivaAnalysis.missing.map((docType) => (
                              <span key={docType} className="missing-doc-badge">
                                {DOC_TYPE_ICONS[docType]} {docType}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vista General con Previews */}
                  {pdfMergeMode === 'general' && (
                    <div className="pdf-preview-grid general-grid">
                      {pdfOrder.map((orderIndex, displayIndex) => {
                        const file = files[orderIndex]
                        const detectedType = generalDocTypes.get(orderIndex)
                        return (
                          <div
                            key={orderIndex}
                            className={`pdf-preview-card general-card ${draggedIndex === displayIndex ? 'dragging' : ''}`}
                            draggable
                            onDragStart={() => handlePdfDragStart(displayIndex)}
                            onDragOver={(e) => handlePdfDragOver(e, displayIndex)}
                            onDragEnd={handlePdfDragEnd}
                          >
                            <div className="preview-drag-handle">☰</div>
                            <div className="preview-order-badge">{displayIndex + 1}</div>
                            <button 
                              className="preview-remove-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                removePdf(orderIndex)
                              }}
                            >
                              ✕
                            </button>
                            <PDFPreview 
                              file={file}
                              width={140}
                              height={180}
                              documentType={detectedType}
                              showLabel={true}
                            />
                            <div className="preview-file-name" title={file.name}>
                              {file.name}
                            </div>
                            <div className="preview-file-size">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    className={`merge-pdfs-btn ${pdfMergeMode === 'fincentiva' ? 'fincentiva-btn' : ''}`}
                    onClick={() => mergePdfs()}
                    disabled={isLoading || files.length === 0}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner"></span>
                        Combinando PDFs...
                      </>
                    ) : pdfMergeMode === 'fincentiva' ? (
                      <>
                        💰 Generar Expediente Fincentiva
                      </>
                    ) : (
                      <>
                        🔗 Combinar PDFs
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Modal de documentos faltantes */}
          {showMissingDocsModal && fincentivaAnalysis && (
            <div className="modal-overlay" onClick={() => setShowMissingDocsModal(false)}>
              <div className="missing-docs-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-icon">⚠️</span>
                  <h3>Documentos Faltantes</h3>
                </div>
                <div className="modal-body">
                  <p>El expediente Fincentiva está incompleto. Faltan los siguientes documentos:</p>
                  <div className="missing-docs-grid">
                    {fincentivaAnalysis.missing.map((docType) => (
                      <div key={docType} className="missing-doc-item">
                        <span className="doc-icon">{DOC_TYPE_ICONS[docType]}</span>
                        <span className="doc-name">{docType}</span>
                      </div>
                    ))}
                  </div>
                  <p className="modal-question">¿Desea continuar de todas formas?</p>
                </div>
                <div className="modal-actions">
                  <button 
                    className="modal-btn cancel"
                    onClick={() => setShowMissingDocsModal(false)}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="modal-btn confirm"
                    onClick={() => mergePdfs(true)}
                  >
                    Sí, continuar
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedSkill.id !== 'pdf-merger' && (
            <>
              <div className="input-area">
                <label>Instrucciones adicionales (opcional)</label>
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder={selectedSkill.placeholder}
                />
              </div>

              <button
                className="execute-btn"
                onClick={executeSkill}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Procesando...
                  </>
                ) : (
                  <>
                    ⚡ Ejecutar Skill
                  </>
                )}
              </button>
            </>
          )}

          {(result || isLoading) && (
            <div className="result-panel">
              <h3>📋 Resultado</h3>
              {isLoading ? (
                <div className="loading-progress">
                  <div className="progress-header">
                    <span className="progress-icon">🔄</span>
                    <span className="progress-title">Procesando...</span>
                  </div>
                  
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${progress.percentage}%` }}
                    />
                    <span className="progress-percentage">{progress.percentage}%</span>
                  </div>
                  
                  <div className="progress-message">{progress.message}</div>
                  
                  {progress.total > 0 && (
                    <div className="progress-stats">
                      <span>Documento {progress.current} de {progress.total}</span>
                      {progress.step && (
                        <span className={`progress-step ${progress.step}`}>
                          {progress.step === 'reading' && '📖 Leyendo archivo...'}
                          {progress.step === 'analyzing' && '🤖 Analizando con IA...'}
                          {progress.step === 'complete' && '✅ Completado'}
                          {progress.step === 'error' && '❌ Error'}
                          {progress.step === 'generating_zip' && '📦 Generando ZIP...'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Botón de descarga para PDF combinado */}
                  {selectedSkill.id === 'pdf-merger' && mergedPdfUrl && (
                    <div className="download-buttons">
                      <button className="download-btn pdf" onClick={downloadMergedPdf}>
                        📥 Descargar PDF Combinado
                      </button>
                    </div>
                  )}

                  {/* Botones de descarga - solo mostrar si NO es organizador de documentos */}
                  {/* El organizador de documentos tiene sus propios botones en DocumentViewer */}
                  {result?.csv && !result?.documentsData && selectedSkill.id !== 'pdf-merger' && (
                    <div className="download-buttons">
                      <button className="download-btn excel" onClick={downloadExcel}>
                        📊 Descargar Excel (.xls)
                      </button>
                      <button className="download-btn csv" onClick={downloadCSV}>
                        📄 Descargar CSV
                      </button>
                    </div>
                  )}

                  {/* Botones adicionales para organizador de documentos (ZIP y JSON) */}
                  {result?.documentsData && result.documentsData.length > 0 && (
                    <div className="download-buttons">
                      {result.zipUrl && (
                        <button className="download-btn zip" onClick={downloadZip}>
                          📦 Descargar ZIP con Archivos Organizados
                        </button>
                      )}
                      <button 
                        className="download-btn copy" 
                        onClick={() => {
                          const dataText = JSON.stringify(result.documentsData, null, 2)
                          copyToClipboard(dataText, 'documents')
                        }}
                      >
                        📋 Copiar Datos JSON
                      </button>
                    </div>
                  )}
                  
                  {/* Preview del CSV */}
                  {result?.csv && (
                    <div className="csv-preview">
                      <h4>Vista previa de datos:</h4>
                      <div className="csv-table">
                        <table>
                          <tbody>
                            {result.csv.split('\n').slice(0, 10).map((row, i) => (
                              <tr key={i}>
                                {row.split(',').map((cell, j) => (
                                  <td key={j}>{cell.replace(/"/g, '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.csv.split('\n').length > 10 && (
                          <p className="more-rows">... y {result.csv.split('\n').length - 10} filas más</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Análisis de Nóminas */}
                  {result?.payrollAnalysis && (
                    <div className="payroll-analysis">
                      <h4>💰 Análisis de Ingresos</h4>
                      <div className="payroll-grid">
                        <div className="payroll-stat primary">
                          <div className="stat-icon">💵</div>
                          <div className="stat-content">
                            <span className="stat-label">Ingreso Promedio por Periodo</span>
                            <span className="stat-value">
                              ${result.payrollAnalysis.promedio_ingreso.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        
                        <div className="payroll-stat success">
                          <div className="stat-icon">📊</div>
                          <div className="stat-content">
                            <span className="stat-label">Ingreso Mensual Estimado</span>
                            <span className="stat-value">
                              ${result.payrollAnalysis.ingreso_mensual_estimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        
                        <div className="payroll-stat info">
                          <div className="stat-icon">📅</div>
                          <div className="stat-content">
                            <span className="stat-label">Periodicidad de Pago</span>
                            <span className="stat-value highlight">{result.payrollAnalysis.periodicidad}</span>
                            <span className="stat-description">{result.payrollAnalysis.descripcion_periodicidad}</span>
                          </div>
                        </div>
                        
                        <div className="payroll-stat">
                          <div className="stat-icon">📄</div>
                          <div className="stat-content">
                            <span className="stat-label">Nóminas Analizadas</span>
                            <span className="stat-value">{result.payrollAnalysis.cantidad_nominas}</span>
                          </div>
                        </div>
                      </div>
                      
                      {result.payrollAnalysis.sueldos_encontrados.length > 1 && (
                        <div className="payroll-detail">
                          <span className="detail-label">Sueldos encontrados:</span>
                          <div className="sueldos-list">
                            {result.payrollAnalysis.sueldos_encontrados.map((sueldo, i) => (
                              <span key={i} className="sueldo-badge">
                                ${sueldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visor de documentos mejorado */}
                  {result?.documentsData && result.documentsData.length > 0 && (
                    <DocumentViewer 
                      documents={result.documentsData}
                      clientName={result.documentsData[0]?.nombre_cliente}
                      payrollAnalysis={result.payrollAnalysis}
                    />
                  )}

                  {/* Verificación de dirección */}
                  {result?.addressVerification && (
                    <div className="address-verification">
                      <div className="address-header">
                        <span className="doc-type">{result.addressVerification.tipo_documento}</span>
                        <span className="service-name">{result.addressVerification.nombre_servicio}</span>
                      </div>
                      
                      <div className="address-comparison">
                        <div className="address-box document">
                          <div className="address-label">📄 Dirección en Documento</div>
                          <div className="address-text">{result.addressVerification.direccion_documento}</div>
                          <button 
                            className={`copy-btn ${copied === 'doc' ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(result.addressVerification!.direccion_documento, 'doc')}
                          >
                            {copied === 'doc' ? '✓ Copiado' : '📋 Copiar'}
                          </button>
                        </div>
                        
                        <div className="address-arrow">→</div>
                        
                        <div className="address-box google">
                          <div className="address-label">🗺️ Dirección Google Maps</div>
                          <div className="address-text">{result.addressVerification.direccion_google}</div>
                          <div className="address-buttons">
                            <button 
                              className={`copy-btn ${copied === 'google' ? 'copied' : ''}`}
                              onClick={() => copyToClipboard(result.addressVerification!.direccion_google, 'google')}
                            >
                              {copied === 'google' ? '✓ Copiado' : '📋 Copiar'}
                            </button>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.addressVerification.direccion_google)}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="maps-btn"
                            >
                              🗺️ Ver en Maps
                            </a>
                          </div>
                        </div>
                      </div>
                      
                      <div className="match-indicator">
                        <div className="match-label">Coincidencia:</div>
                        <div className={`match-value ${result.addressVerification.coincidencia >= 80 ? 'high' : result.addressVerification.coincidencia >= 50 ? 'medium' : 'low'}`}>
                          {result.addressVerification.coincidencia}%
                        </div>
                      </div>
                      
                      {result.addressVerification.diferencias.length > 0 && (
                        <div className="differences">
                          <div className="diff-label">⚠️ Diferencias encontradas:</div>
                          <ul>
                            {result.addressVerification.diferencias.map((diff, i) => (
                              <li key={i}>{diff}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Validación SEPOMEX */}
                      {result.addressVerification.validacion_sepomex && (
                        <div className="sepomex-validation">
                          <div className="sepomex-header">
                            <span className="sepomex-title">📮 Validación SEPOMEX (Oficial)</span>
                          </div>
                          
                          <div className="sepomex-checks">
                            {result.addressVerification.validacion_sepomex.validaciones.map((val, i) => (
                              <div key={i} className={`sepomex-check ${val.startsWith('✅') ? 'valid' : val.startsWith('⚠️') ? 'warning' : ''}`}>
                                {val}
                              </div>
                            ))}
                          </div>
                          
                          {result.addressVerification.validacion_sepomex.sugerencias_sepomex.length > 0 && (
                            <div className="sepomex-suggestions">
                              <div className="suggestions-label">💡 Sugerencias:</div>
                              <ul>
                                {result.addressVerification.validacion_sepomex.sugerencias_sepomex.map((sug, i) => (
                                  <li key={i}>{sug}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {result.addressVerification.validacion_sepomex.datos_oficiales && (
                            <div className="sepomex-official">
                              <div className="official-label">📋 Datos oficiales SEPOMEX:</div>
                              <div className="official-data">
                                <span><strong>Colonia:</strong> {result.addressVerification.validacion_sepomex.datos_oficiales.colonia_oficial}</span>
                                <span><strong>Municipio:</strong> {result.addressVerification.validacion_sepomex.datos_oficiales.municipio_oficial}</span>
                                <span><strong>Estado:</strong> {result.addressVerification.validacion_sepomex.datos_oficiales.estado_oficial}</span>
                                {result.addressVerification.validacion_sepomex.datos_oficiales.ciudad_oficial && (
                                  <span><strong>Ciudad:</strong> {result.addressVerification.validacion_sepomex.datos_oficiales.ciudad_oficial}</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {result.addressVerification.validacion_sepomex.colonias_validas_para_cp.length > 1 && (
                            <details className="sepomex-colonias">
                              <summary>Ver colonias válidas para este CP ({result.addressVerification.validacion_sepomex.colonias_validas_para_cp.length})</summary>
                              <ul>
                                {result.addressVerification.validacion_sepomex.colonias_validas_para_cp.map((col, i) => (
                                  <li key={i}>{col}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      )}
                      
                      {/* Sistema de Alertas de Riesgo para Mesa de Control */}
                      {result.addressVerification.alertas_riesgo && result.addressVerification.alertas_riesgo.length > 0 && (
                        <div className="mesa-control-alertas">
                          <div className="mesa-control-header">
                            <span className="mesa-control-title">🚨 Alertas de Riesgo - Mesa de Control</span>
                            {result.addressVerification.estado_validacion && (
                              <span className={`estado-badge ${result.addressVerification.estado_validacion.toLowerCase().replace('_', '-')}`}>
                                {result.addressVerification.estado_validacion === 'APROBADO' && '✅ APROBADO'}
                                {result.addressVerification.estado_validacion === 'REVISION_REQUERIDA' && '⚠️ REVISIÓN REQUERIDA'}
                                {result.addressVerification.estado_validacion === 'RECHAZADO' && '❌ RECHAZADO'}
                              </span>
                            )}
                          </div>
                          
                          {result.addressVerification.resumen_mesa_control && (
                            <div className="resumen-mesa-control">
                              <div className="resumen-stats">
                                <div className="stat">
                                  <span className="stat-label">Total Alertas:</span>
                                  <span className="stat-value">{result.addressVerification.resumen_mesa_control.total_alertas}</span>
                                </div>
                                {result.addressVerification.resumen_mesa_control.alertas_criticas > 0 && (
                                  <div className="stat critico">
                                    <span className="stat-label">Críticas:</span>
                                    <span className="stat-value">{result.addressVerification.resumen_mesa_control.alertas_criticas}</span>
                                  </div>
                                )}
                                {result.addressVerification.resumen_mesa_control.alertas_altas > 0 && (
                                  <div className="stat alto">
                                    <span className="stat-label">Altas:</span>
                                    <span className="stat-value">{result.addressVerification.resumen_mesa_control.alertas_altas}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="resumen-accion">
                                {result.addressVerification.resumen_mesa_control.puede_aprobar && (
                                  <div className="accion-aprobada">✅ Puede aprobarse automáticamente</div>
                                )}
                                {result.addressVerification.resumen_mesa_control.requiere_revision && (
                                  <div className="accion-revision">⚠️ Requiere revisión manual antes de aprobar</div>
                                )}
                                {result.addressVerification.resumen_mesa_control.debe_rechazar && (
                                  <div className="accion-rechazada">❌ Debe rechazarse - Revisar con supervisor</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="alertas-lista">
                            {result.addressVerification.alertas_riesgo.map((alerta, i) => (
                              <div key={i} className={`alerta-riesgo nivel-${alerta.nivel.toLowerCase()}`}>
                                <div className="alerta-header">
                                  <span className={`alerta-badge ${alerta.nivel.toLowerCase()}`}>
                                    {alerta.nivel === 'CRITICO' && '🔴 CRÍTICO'}
                                    {alerta.nivel === 'ALTO' && '🟠 ALTO'}
                                    {alerta.nivel === 'MEDIO' && '🟡 MEDIO'}
                                    {alerta.nivel === 'BAJO' && '🔵 BAJO'}
                                  </span>
                                  <span className="alerta-tipo">{alerta.tipo.replace(/_/g, ' ')}</span>
                                </div>
                                <div className="alerta-mensaje">{alerta.mensaje}</div>
                                <div className="alerta-accion">
                                  <strong>Acción recomendada:</strong> {alerta.accionRecomendada}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="coordinates">
                        <span>📍 Coordenadas: {result.addressVerification.coordenadas.lat}, {result.addressVerification.coordenadas.lng}</span>
                        <button 
                          className={`copy-btn small ${copied === 'coords' ? 'copied' : ''}`}
                          onClick={() => copyToClipboard(`${result.addressVerification!.coordenadas.lat}, ${result.addressVerification!.coordenadas.lng}`, 'coords')}
                        >
                          {copied === 'coords' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Respuesta de texto */}
                  {!result?.csv && !result?.addressVerification && (
                    <div className="result-content">{result?.result}</div>
                  )}
                </>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
