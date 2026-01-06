'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import './prospeccion.css'

// ICP Configurations (presets)
const CLIENTS = {
  fincentiva: {
    id: 'fincentiva',
    name: 'FINCENTIVA',
    description: 'Financiera B2B - Préstamos de nómina',
    logo: '💰',
    color: '#10B981',
    icp_summary: 'Empresas con nómina formal en Nuevo León, 50-1000 empleados, RH estructurado',
    apollo_filters: {
      employee_count_min: 50,
      employee_count_max: 1000,
      locations: ['Nuevo Leon', 'Monterrey'],
      locations_secondary: ['Mexico'],
      industries: [
        'manufacturing', 'automotive', 'food production', 'pharmaceuticals',
        'logistics', 'transportation', 'warehousing', 'retail',
        'call center', 'business process outsourcing'
      ]
    },
    target_titles: [
      'HR Manager', 'Human Resources Manager', 'Gerente de Recursos Humanos',
      'Head of People', 'Director de RH', 'Gerente de Nómina', 'Payroll Manager',
      'Admin Manager', 'Gerente Administrativo'
    ],
    seniorities: ['manager', 'director', 'vp'],
    tiers: [
      { name: 'CORE', color: '#10B981' },
      { name: 'BUEN ICP', color: '#F59E0B' },
      { name: 'OPORTUNIDAD', color: '#F97316' }
    ],
    pain_points: ['Adelantos constantes', 'RH sin tiempo', 'Alta rotación']
  },
  tresgarza: {
    id: 'tresgarza',
    name: 'TRES GARZA',
    description: 'Distribuidora de limpieza industrial',
    logo: '🧹',
    color: '#3B82F6',
    icp_summary: 'Negocios de operación continua en Nuevo León, alto flujo, consumo diario',
    apollo_filters: {
      employee_count_min: 20,
      employee_count_max: 500,
      locations: ['Nuevo Leon', 'Monterrey'],
      locations_secondary: ['Mexico'],
      industries: [
        'gas station', 'fuel', 'petroleum', 'logistics', 'transportation',
        'trucking', 'warehousing', 'distribution center', 'manufacturing',
        'shopping center', 'retail plaza', 'hotel', 'hospital'
      ]
    },
    target_titles: [
      'Operations Manager', 'Gerente de Operaciones', 'Facility Manager',
      'Gerente de Mantenimiento', 'Regional Manager', 'Gerente Regional',
      'Purchasing Manager', 'Gerente de Compras', 'General Manager', 'Owner'
    ],
    seniorities: ['owner', 'c_suite', 'vp', 'director', 'manager'],
    tiers: [
      { name: 'ANCLA', color: '#10B981' },
      { name: 'ESTRATÉGICO', color: '#3B82F6' },
      { name: 'SECUNDARIO', color: '#F59E0B' }
    ],
    pain_points: ['Sin insumos', 'Proveedores fallan', 'Baños = reputación']
  }
}

// Search presets for quick start
const SEARCH_PRESETS = {
  fincentiva: [
    {
      id: 'fin-1',
      emoji: '🏭',
      title: 'Manufactura Automotriz',
      prompt: 'Busco gerentes de recursos humanos en empresas de manufactura automotriz de Nuevo León con más de 100 empleados. Preferiblemente plantas de autopartes o ensamblaje.',
      tags: ['Automotriz', 'RH', '+100 emp']
    },
    {
      id: 'fin-2', 
      emoji: '📞',
      title: 'Call Centers BPO',
      prompt: 'Busco directores de RH y gerentes de nómina en call centers y empresas de BPO en Monterrey. Empresas con alta rotación de personal y más de 200 empleados.',
      tags: ['Call Center', 'Alta rotación', 'BPO']
    },
    {
      id: 'fin-3',
      emoji: '🍔',
      title: 'Alimentos y Bebidas',
      prompt: 'Busco gerentes administrativos y de recursos humanos en empresas de producción de alimentos y bebidas en Nuevo León. Plantas procesadoras con 50-500 empleados.',
      tags: ['Alimentos', 'Procesadoras', 'Admin']
    },
    {
      id: 'fin-4',
      emoji: '💊',
      title: 'Farmacéuticas y Retail',
      prompt: 'Busco responsables de nómina y gerentes de RH en cadenas de farmacias, retail y tiendas departamentales de Monterrey con más de 80 empleados.',
      tags: ['Farmacia', 'Retail', 'Nómina']
    },
    {
      id: 'fin-5',
      emoji: '📦',
      title: 'Logística y Almacenes',
      prompt: 'Busco gerentes de recursos humanos en empresas de logística, centros de distribución y almacenes de Nuevo León. Empresas con operación 24/7 y entre 100-800 empleados.',
      tags: ['Logística', 'CEDIS', '24/7']
    }
  ],
  tresgarza: [
    {
      id: 'tg-1',
      emoji: '⛽',
      title: 'Gasolineras y Combustibles',
      prompt: 'Busco gerentes de operaciones y encargados de mantenimiento en cadenas de gasolineras y estaciones de servicio en Nuevo León. Alto tráfico y necesidad de limpieza constante.',
      tags: ['Gasolineras', 'Alto tráfico', 'Limpieza']
    },
    {
      id: 'tg-2',
      emoji: '🏨',
      title: 'Hoteles y Hospitalidad',
      prompt: 'Busco gerentes de mantenimiento y facility managers en hoteles de 3-5 estrellas de Monterrey. Establecimientos con más de 50 habitaciones que requieren suministros de limpieza.',
      tags: ['Hoteles', 'Facility', 'Suministros']
    },
    {
      id: 'tg-3',
      emoji: '🏥',
      title: 'Hospitales y Clínicas',
      prompt: 'Busco gerentes de compras y responsables de mantenimiento en hospitales y clínicas privadas de Nuevo León. Instituciones con altos estándares de higiene.',
      tags: ['Salud', 'Compras', 'Higiene']
    },
    {
      id: 'tg-4',
      emoji: '🛒',
      title: 'Plazas Comerciales',
      prompt: 'Busco administradores y gerentes de operaciones en plazas comerciales y centros comerciales de Monterrey. Espacios con alto flujo de personas y áreas comunes grandes.',
      tags: ['Plazas', 'Áreas comunes', 'Comercial']
    },
    {
      id: 'tg-5',
      emoji: '🚚',
      title: 'Transportistas y Flotillas',
      prompt: 'Busco dueños y gerentes de operaciones en empresas de transporte y flotillas de camiones en Nuevo León. Empresas con más de 20 unidades que necesitan productos de limpieza para sus vehículos.',
      tags: ['Transporte', 'Flotillas', 'Dueños']
    }
  ]
}

type ClientId = keyof typeof CLIENTS

interface Contact {
  id: string
  name: string
  title: string
  email: string
  emailStatus: string
  phone: string
  linkedinUrl: string
  seniority: string
}

interface Company {
  id: string
  name: string
  domain: string
  industry: string
  employeeCount: number
  location: string
  linkedinUrl: string
  description: string
  contacts: Contact[]
}

interface SearchResults {
  clientId: string
  companies: Company[]
  summary: {
    totalCompanies: number
    totalContacts: number
    contactsWithEmail: number
  }
}

interface ExtractedFilters {
  industries: string[]
  titles: string[]
  locations: string[]
  employeeMin: number
  employeeMax: number
  seniorities: string[]
}

// Function to extract filters from natural language
function extractFiltersFromPrompt(prompt: string): ExtractedFilters {
  const promptLower = prompt.toLowerCase()
  
  // Default filters
  const filters: ExtractedFilters = {
    industries: [],
    titles: [],
    locations: ['Nuevo Leon', 'Monterrey'],
    employeeMin: 20,
    employeeMax: 500,
    seniorities: ['manager', 'director']
  }
  
  // Industry detection
  const industryKeywords: Record<string, string[]> = {
    'manufacturing': ['manufactura', 'fabrica', 'industrial', 'producción', 'planta'],
    'automotive': ['automotriz', 'autos', 'carros', 'vehículos', 'autopartes'],
    'logistics': ['logística', 'logistica', 'transporte', 'distribución', 'almacén'],
    'retail': ['retail', 'tienda', 'comercio', 'minorista', 'venta al detalle'],
    'technology': ['tecnología', 'software', 'tech', 'startup', 'saas'],
    'food production': ['alimentos', 'comida', 'bebidas', 'procesadora'],
    'construction': ['construcción', 'constructora', 'inmobiliaria', 'obras'],
    'healthcare': ['salud', 'hospital', 'clínica', 'médico', 'farmacéutica'],
    'hospitality': ['hotel', 'restaurante', 'turismo', 'hospitalidad'],
    'education': ['educación', 'escuela', 'universidad', 'capacitación'],
    'financial services': ['financiera', 'banco', 'fintech', 'crédito', 'préstamo'],
    'gas station': ['gasolinera', 'gasolina', 'combustible', 'estación de servicio'],
    'call center': ['call center', 'atención al cliente', 'bpo', 'contact center']
  }
  
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some(kw => promptLower.includes(kw))) {
      filters.industries.push(industry)
    }
  }
  
  // Title detection
  const titleKeywords: Record<string, string[]> = {
    'CEO': ['ceo', 'director general', 'dueño', 'propietario', 'founder', 'fundador'],
    'CFO': ['cfo', 'director financiero', 'finanzas', 'finance director'],
    'COO': ['coo', 'director de operaciones', 'operaciones'],
    'HR Manager': ['rh', 'recursos humanos', 'hr', 'people', 'talento'],
    'Operations Manager': ['operaciones', 'operations', 'planta'],
    'Purchasing Manager': ['compras', 'adquisiciones', 'procurement', 'purchasing'],
    'IT Manager': ['ti', 'sistemas', 'it', 'tecnología'],
    'Marketing Manager': ['marketing', 'mercadotecnia', 'growth'],
    'Sales Manager': ['ventas', 'comercial', 'sales'],
    'General Manager': ['gerente general', 'general manager', 'director']
  }
  
  for (const [title, keywords] of Object.entries(titleKeywords)) {
    if (keywords.some(kw => promptLower.includes(kw))) {
      filters.titles.push(title)
    }
  }
  
  // Location detection
  const locationKeywords: Record<string, string[]> = {
    'Nuevo Leon': ['nuevo león', 'nuevo leon', 'monterrey', 'mty', 'nl'],
    'Jalisco': ['jalisco', 'guadalajara', 'gdl'],
    'CDMX': ['cdmx', 'ciudad de méxico', 'df', 'mexico city'],
    'Queretaro': ['querétaro', 'queretaro', 'qro'],
    'Mexico': ['méxico', 'mexico', 'nacional', 'todo el país']
  }
  
  const detectedLocations: string[] = []
  for (const [location, keywords] of Object.entries(locationKeywords)) {
    if (keywords.some(kw => promptLower.includes(kw))) {
      detectedLocations.push(location)
    }
  }
  if (detectedLocations.length > 0) {
    filters.locations = detectedLocations
  }
  
  // Employee count detection
  const employeePatterns = [
    { pattern: /(\d+)\s*[-a]\s*(\d+)\s*empleados/i, extract: (m: RegExpMatchArray) => ({ min: parseInt(m[1]), max: parseInt(m[2]) }) },
    { pattern: /más de (\d+) empleados/i, extract: (m: RegExpMatchArray) => ({ min: parseInt(m[1]), max: 10000 }) },
    { pattern: /menos de (\d+) empleados/i, extract: (m: RegExpMatchArray) => ({ min: 1, max: parseInt(m[1]) }) },
    { pattern: /empresas (pequeñas|chicas)/i, extract: () => ({ min: 10, max: 50 }) },
    { pattern: /empresas medianas/i, extract: () => ({ min: 50, max: 250 }) },
    { pattern: /empresas grandes/i, extract: () => ({ min: 250, max: 5000 }) },
    { pattern: /pymes/i, extract: () => ({ min: 20, max: 250 }) }
  ]
  
  for (const { pattern, extract } of employeePatterns) {
    const match = promptLower.match(pattern)
    if (match) {
      const { min, max } = extract(match)
      filters.employeeMin = min
      filters.employeeMax = max
      break
    }
  }
  
  // Seniority detection
  if (promptLower.includes('c-level') || promptLower.includes('ejecutivo') || promptLower.includes('director')) {
    filters.seniorities = ['c_suite', 'vp', 'director']
  }
  if (promptLower.includes('dueño') || promptLower.includes('propietario') || promptLower.includes('founder')) {
    filters.seniorities = ['owner', 'founder']
  }
  if (promptLower.includes('gerente') || promptLower.includes('manager')) {
    filters.seniorities = ['manager', 'senior']
  }
  
  // If no industries detected, add some defaults
  if (filters.industries.length === 0) {
    filters.industries = ['manufacturing', 'retail', 'logistics']
  }
  
  // If no titles detected, add some defaults
  if (filters.titles.length === 0) {
    filters.titles = ['General Manager', 'Operations Manager', 'HR Manager']
  }
  
  return filters
}

// Email Modal State Interface
interface EmailModalState {
  isOpen: boolean
  contact: Contact | null
  company: Company | null
  generatedEmail: {
    subject: string
    body: string
    cta: string
    tips: string[]
  } | null
  isGenerating: boolean
  selectedStyle: 'directo' | 'storytelling' | 'pregunta'
}

export default function ProspeccionPage() {
  const [searchMode, setSearchMode] = useState<'preset' | 'custom'>('preset')
  const [selectedClient, setSelectedClient] = useState<ClientId | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [extractedFilters, setExtractedFilters] = useState<ExtractedFilters | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [maxCompanies, setMaxCompanies] = useState(25)
  const [maxContacts, setMaxContacts] = useState(2)
  const [includeAllMexico, setIncludeAllMexico] = useState(false)
  const [enrichContacts, setEnrichContacts] = useState(false) // Uses Apollo credits
  
  // Email Modal State
  const [emailModal, setEmailModal] = useState<EmailModalState>({
    isOpen: false,
    contact: null,
    company: null,
    generatedEmail: null,
    isGenerating: false,
    selectedStyle: 'directo'
  })

  useEffect(() => {
    async function checkApi() {
      try {
        const res = await fetch('/api/apollo-search')
        const data = await res.json()
        setApiStatus(data.status === 'connected' ? 'connected' : 'error')
        if (data.status === 'error') setError(data.message)
      } catch {
        setApiStatus('error')
      }
    }
    checkApi()
  }, [])

  // Analyze custom prompt when it changes
  useEffect(() => {
    if (searchMode === 'custom' && customPrompt.length > 20) {
      setIsAnalyzing(true)
      const timer = setTimeout(() => {
        const filters = extractFiltersFromPrompt(customPrompt)
        setExtractedFilters(filters)
        setIsAnalyzing(false)
      }, 500)
      return () => clearTimeout(timer)
    } else if (customPrompt.length < 20) {
      setExtractedFilters(null)
    }
  }, [customPrompt, searchMode])

  const handleSearch = async () => {
    let searchParams: {
      clientId: string
      industries: string[]
      locations: string[]
      employeeMin: number
      employeeMax: number
      titles: string[]
      seniorities: string[]
      maxCompanies: number
      maxContactsPerCompany: number
      enrichContacts: boolean
    }

    if (searchMode === 'preset' && selectedClient) {
      const client = CLIENTS[selectedClient]
      const locations = includeAllMexico 
        ? [...client.apollo_filters.locations, ...(client.apollo_filters.locations_secondary || [])]
        : client.apollo_filters.locations

      searchParams = {
        clientId: selectedClient,
        industries: client.apollo_filters.industries,
        locations,
        employeeMin: client.apollo_filters.employee_count_min,
        employeeMax: client.apollo_filters.employee_count_max,
        titles: client.target_titles,
        seniorities: client.seniorities,
        maxCompanies,
        maxContactsPerCompany: maxContacts,
        enrichContacts
      }
    } else if (searchMode === 'custom' && extractedFilters) {
      searchParams = {
        clientId: 'custom',
        industries: extractedFilters.industries,
        locations: includeAllMexico ? [...extractedFilters.locations, 'Mexico'] : extractedFilters.locations,
        employeeMin: extractedFilters.employeeMin,
        employeeMax: extractedFilters.employeeMax,
        titles: extractedFilters.titles,
        seniorities: extractedFilters.seniorities,
        maxCompanies,
        maxContactsPerCompany: maxContacts,
        enrichContacts
      }
    } else {
      return
    }

    setIsSearching(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/apollo-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error en la búsqueda')
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSearching(false)
    }
  }

  const exportToCsv = () => {
    if (!results) return
    
    // Enhanced export with ALL available data
    const rows = results.companies.flatMap(company =>
      company.contacts.length > 0 
        ? company.contacts.map(contact => ({
            // Company data
            empresa: company.name,
            dominio: company.domain,
            industria: company.industry,
            empleados: company.employeeCount,
            ubicacion: company.location,
            linkedin_empresa: company.linkedinUrl,
            descripcion: company.description,
            // Contact data
            contacto_id: contact.id,
            contacto_nombre: contact.name,
            contacto_titulo: contact.title,
            contacto_email: contact.email,
            email_status: contact.emailStatus,
            contacto_telefono: contact.phone,
            contacto_linkedin: contact.linkedinUrl,
            seniority: contact.seniority,
            // Metadata
            cliente_icp: results.clientId,
            fecha_extraccion: new Date().toISOString().split('T')[0]
          }))
        : [{
            // Company without contacts
            empresa: company.name,
            dominio: company.domain,
            industria: company.industry,
            empleados: company.employeeCount,
            ubicacion: company.location,
            linkedin_empresa: company.linkedinUrl,
            descripcion: company.description,
            contacto_id: '',
            contacto_nombre: '',
            contacto_titulo: '',
            contacto_email: '',
            email_status: '',
            contacto_telefono: '',
            contacto_linkedin: '',
            seniority: '',
            cliente_icp: results.clientId,
            fecha_extraccion: new Date().toISOString().split('T')[0]
          }]
    )
    
    if (rows.length === 0) return alert('No hay datos para exportar')
    
    const headers = Object.keys(rows[0])
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h as keyof typeof r] || '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }) // UTF-8 BOM for Excel
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `leads_${searchMode === 'preset' ? selectedClient : 'custom'}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Email generation functions
  const openEmailModal = (contact: Contact, company: Company) => {
    setEmailModal({
      isOpen: true,
      contact,
      company,
      generatedEmail: null,
      isGenerating: false,
      selectedStyle: 'directo'
    })
  }

  const closeEmailModal = () => {
    setEmailModal({
      isOpen: false,
      contact: null,
      company: null,
      generatedEmail: null,
      isGenerating: false,
      selectedStyle: 'directo'
    })
  }

  const generateEmail = async (style: 'directo' | 'storytelling' | 'pregunta') => {
    if (!emailModal.contact || !emailModal.company) return
    
    setEmailModal(prev => ({ ...prev, isGenerating: true, selectedStyle: style }))
    
    try {
      const clientId = selectedClient || 'custom'
      const clientConfig = selectedClient ? CLIENTS[selectedClient] : null
      
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: emailModal.contact,
          company: emailModal.company,
          clientContext: {
            clientId,
            clientName: clientConfig?.name || 'Custom',
            productDescription: clientConfig?.description || '',
            valueProposition: clientConfig?.icp_summary || '',
            painPoints: clientConfig?.pain_points || []
          },
          emailStyle: style
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setEmailModal(prev => ({
          ...prev,
          generatedEmail: data.email,
          isGenerating: false
        }))
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('Email generation error:', err)
      setEmailModal(prev => ({ ...prev, isGenerating: false }))
      alert('Error generando email. Verifica que ANTHROPIC_API_KEY esté configurada.')
    }
  }

  const copyEmailToClipboard = () => {
    if (!emailModal.generatedEmail) return
    const fullEmail = `Subject: ${emailModal.generatedEmail.subject}\n\n${emailModal.generatedEmail.body}`
    navigator.clipboard.writeText(fullEmail)
    alert('Email copiado al portapapeles!')
  }

  const client = selectedClient ? CLIENTS[selectedClient] : null
  const canSearch = (searchMode === 'preset' && selectedClient) || (searchMode === 'custom' && extractedFilters)

  return (
    <div className="prospeccion-container">
      {/* Header */}
      <header className="prospeccion-header">
        <div className="header-content">
          <div className="header-left">
            <Link href="/" className="back-link">← Volver</Link>
            <h1 className="page-title">
              <span className="title-icon">🎯</span>
              Prospección Apollo
            </h1>
          </div>
          <div className={`api-status ${apiStatus}`}>
            <span className="status-dot"></span>
            {apiStatus === 'connected' ? 'Conectado' : apiStatus === 'error' ? 'Sin API Key' : 'Verificando...'}
          </div>
        </div>
      </header>

      <main className="prospeccion-main">
        {/* Search Mode Toggle */}
        <div className="custom-search">
          <div className="custom-search-header">
            <h3 className="custom-search-title">
              <span>✨</span> ¿Cómo quieres buscar?
            </h3>
            <div className="mode-toggle">
              <button 
                className={`mode-btn ${searchMode === 'preset' ? 'active' : ''}`}
                onClick={() => setSearchMode('preset')}
              >
                📋 Preset ICP
              </button>
              <button 
                className={`mode-btn ${searchMode === 'custom' ? 'active' : ''}`}
                onClick={() => setSearchMode('custom')}
              >
                ✍️ Describir
              </button>
            </div>
          </div>

          {searchMode === 'custom' && (
            <>
              {/* Quick Start Presets */}
              <div className="presets-section">
                <div className="presets-group">
                  <h4 className="presets-group-title">
                    <span className="presets-logo">💰</span> FINCENTIVA
                    <span className="presets-subtitle">Préstamos de nómina</span>
                  </h4>
                  <div className="presets-grid">
                    {SEARCH_PRESETS.fincentiva.map((preset) => (
                      <button
                        key={preset.id}
                        className="preset-card"
                        onClick={() => setCustomPrompt(preset.prompt)}
                      >
                        <span className="preset-emoji">{preset.emoji}</span>
                        <span className="preset-title">{preset.title}</span>
                        <div className="preset-tags">
                          {preset.tags.map(tag => (
                            <span key={tag} className="preset-tag">{tag}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="presets-group">
                  <h4 className="presets-group-title">
                    <span className="presets-logo">🧹</span> TRES GARZA
                    <span className="presets-subtitle">Limpieza industrial</span>
                  </h4>
                  <div className="presets-grid">
                    {SEARCH_PRESETS.tresgarza.map((preset) => (
                      <button
                        key={preset.id}
                        className="preset-card preset-card-blue"
                        onClick={() => setCustomPrompt(preset.prompt)}
                      >
                        <span className="preset-emoji">{preset.emoji}</span>
                        <span className="preset-title">{preset.title}</span>
                        <div className="preset-tags">
                          {preset.tags.map(tag => (
                            <span key={tag} className="preset-tag">{tag}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="prompt-divider">
                <span>o escribe tu propia búsqueda</span>
              </div>

              <textarea
                className="prompt-textarea"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe a quién buscas...

Ejemplo: Busco gerentes de recursos humanos en empresas de manufactura de Nuevo León con más de 100 empleados. Preferiblemente del sector automotriz o alimentos."
              />
              <div className="prompt-hint">
                <span className="prompt-hint-icon">💡</span>
                Menciona: industria, ubicación, tamaño de empresa, y qué título/cargo buscas
              </div>

              {isAnalyzing && (
                <div className="ai-analyzing">
                  <span className="spinner"></span>
                  <p>Analizando tu descripción...</p>
                </div>
              )}

              {extractedFilters && !isAnalyzing && (
                <div className="extracted-filters">
                  <p className="extracted-filters-title">
                    <span>✅</span> Filtros detectados
                  </p>
                  <div className="filter-chips">
                    {extractedFilters.industries.slice(0, 4).map(ind => (
                      <span key={ind} className="filter-chip">
                        <span className="filter-chip-label">🏭</span>{ind}
                      </span>
                    ))}
                    {extractedFilters.titles.slice(0, 3).map(title => (
                      <span key={title} className="filter-chip">
                        <span className="filter-chip-label">👤</span>{title}
                      </span>
                    ))}
                    {extractedFilters.locations.slice(0, 2).map(loc => (
                      <span key={loc} className="filter-chip">
                        <span className="filter-chip-label">📍</span>{loc}
                      </span>
                    ))}
                    <span className="filter-chip">
                      <span className="filter-chip-label">👥</span>
                      {extractedFilters.employeeMin}-{extractedFilters.employeeMax}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Client Selection - Only show in preset mode */}
        {searchMode === 'preset' && (
          <section className="client-selection">
            <h2 className="section-title">Selecciona Cliente</h2>
            <div className="client-cards">
              {Object.values(CLIENTS).map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedClient(c.id as ClientId)}
                  className={`client-card ${selectedClient === c.id ? 'selected' : ''}`}
                  style={{ '--client-color': c.color } as React.CSSProperties}
                >
                  <div className="card-top">
                    <span className="client-logo">{c.logo}</span>
                    <div className="client-info">
                      <h3 className="client-name">{c.name}</h3>
                      <p className="client-desc">{c.description}</p>
                    </div>
                  </div>
                  <p className="client-summary">{c.icp_summary}</p>
                  <div className="client-tiers">
                    {c.tiers.map(tier => (
                      <span
                        key={tier.name}
                        className="tier-badge"
                        style={{ backgroundColor: `${tier.color}20`, color: tier.color, borderColor: `${tier.color}40` }}
                      >
                        {tier.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Config Panel - Show when we have filters or selected client */}
        {(canSearch || searchMode === 'custom') && (
          <section className="client-panel">
            <div className="panel-grid">
              {/* ICP Info - For preset mode */}
              {searchMode === 'preset' && client && (
                <div className="icp-info">
                  <div className="panel-header">
                    <span className="panel-icon">{client.logo}</span>
                    <h3>ICP de {client.name}</h3>
                  </div>
                  
                  <div className="info-columns">
                    <div className="info-column">
                      <h4 className="column-title">Filtros de Búsqueda</h4>
                      <ul className="filter-list">
                        <li><span className="filter-icon">📍</span> {client.apollo_filters.locations.join(', ')}</li>
                        <li><span className="filter-icon">👥</span> {client.apollo_filters.employee_count_min} - {client.apollo_filters.employee_count_max} empleados</li>
                        <li><span className="filter-icon">🏭</span> {client.apollo_filters.industries.slice(0, 3).join(', ')}...</li>
                      </ul>
                    </div>
                    
                    <div className="info-column">
                      <h4 className="column-title">Títulos Objetivo</h4>
                      <div className="title-tags">
                        {client.target_titles.slice(0, 4).map(t => (
                          <span key={t} className="title-tag">{t}</span>
                        ))}
                        {client.target_titles.length > 4 && (
                          <span className="title-more">+{client.target_titles.length - 4}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pain-points">
                    <h4 className="column-title">Pain Points</h4>
                    <div className="pain-list">
                      {client.pain_points.map(p => (
                        <span key={p} className="pain-badge">⚠️ {p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ICP Info - For custom mode */}
              {searchMode === 'custom' && extractedFilters && (
                <div className="icp-info">
                  <div className="panel-header">
                    <span className="panel-icon">🔍</span>
                    <h3>Búsqueda Personalizada</h3>
                  </div>
                  
                  <div className="info-columns">
                    <div className="info-column">
                      <h4 className="column-title">Filtros Detectados</h4>
                      <ul className="filter-list">
                        <li><span className="filter-icon">📍</span> {extractedFilters.locations.join(', ')}</li>
                        <li><span className="filter-icon">👥</span> {extractedFilters.employeeMin} - {extractedFilters.employeeMax} empleados</li>
                        <li><span className="filter-icon">🏭</span> {extractedFilters.industries.slice(0, 3).join(', ')}</li>
                      </ul>
                    </div>
                    
                    <div className="info-column">
                      <h4 className="column-title">Títulos a Buscar</h4>
                      <div className="title-tags">
                        {extractedFilters.titles.map(t => (
                          <span key={t} className="title-tag">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Search Config */}
              <div className="search-config">
                <h4 className="config-title">Configurar Búsqueda</h4>
                
                <div className="config-form">
                  <div className="form-group">
                    <label>Máx. Empresas</label>
                    <input
                      type="number"
                      value={maxCompanies}
                      onChange={(e) => setMaxCompanies(Math.min(100, Math.max(1, parseInt(e.target.value) || 25)))}
                      min={1}
                      max={100}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Contactos por Empresa</label>
                    <input
                      type="number"
                      value={maxContacts}
                      onChange={(e) => setMaxContacts(Math.min(10, Math.max(1, parseInt(e.target.value) || 2)))}
                      min={1}
                      max={10}
                    />
                  </div>

                  {/* Location Toggle */}
                  <div className="location-toggle" onClick={() => setIncludeAllMexico(!includeAllMexico)}>
                    <div className="toggle-info">
                      <span className="toggle-label">{includeAllMexico ? '🇲🇽 Todo México' : '📍 Solo Nuevo León'}</span>
                      <span className="toggle-desc">{includeAllMexico ? 'Búsqueda nacional' : 'Enfoque regional'}</span>
                    </div>
                    <div className={`toggle-switch ${includeAllMexico ? 'active' : ''}`}>
                      <div className="toggle-knob"></div>
                    </div>
                  </div>

                  {/* Enrichment Toggle - Gets emails and phones using Apollo credits */}
                  <div className={`location-toggle enrich-toggle ${enrichContacts ? 'enrich-active' : ''}`} onClick={() => setEnrichContacts(!enrichContacts)}>
                    <div className="toggle-info">
                      <span className="toggle-label">{enrichContacts ? '📧 Enriquecer Datos' : '🔍 Solo Buscar'}</span>
                      <span className="toggle-desc">{enrichContacts ? 'Obtener emails y teléfonos (usa créditos)' : 'Sin datos de contacto directo'}</span>
                    </div>
                    <div className={`toggle-switch ${enrichContacts ? 'active' : ''}`}>
                      <div className="toggle-knob"></div>
                    </div>
                  </div>

                  <button
                    onClick={handleSearch}
                    disabled={isSearching || apiStatus !== 'connected' || !canSearch}
                    className="search-btn"
                    style={{ '--btn-color': searchMode === 'preset' && client ? client.color : '#8b5cf6' } as React.CSSProperties}
                  >
                    {isSearching ? (
                      <>
                        <span className="spinner"></span>
                        Buscando...
                      </>
                    ) : '🚀 Buscar Leads'}
                  </button>

                  {apiStatus === 'error' && (
                    <p className="api-error">Configura APOLLO_API_KEY en .env.local</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="error-box">{error}</div>
        )}

        {/* Results */}
        {results && (
          <section className="results-section">
            <div className="results-header">
              <div className="results-info">
                <h2>Resultados</h2>
                <div className="results-stats">
                  <span className="stat-badge">🏢 {results.summary.totalCompanies} empresas</span>
                  <span className="stat-badge">👤 {results.summary.totalContacts} contactos</span>
                  <span className="stat-badge success">✉️ {results.summary.contactsWithEmail} con email</span>
                </div>
              </div>
              <button onClick={exportToCsv} className="export-btn">
                📥 Exportar CSV
              </button>
            </div>

            <div className="companies-grid">
              {results.companies.map((company) => (
                <div key={company.id} className="company-card">
                  <div className="company-header">
                    <div>
                      <h3 className="company-name">{company.name}</h3>
                      <p className="company-industry">{company.industry}</p>
                    </div>
                    <span className="company-size">~{company.employeeCount}</span>
                  </div>
                  
                  <div className="company-meta">
                    <p>📍 {company.location || 'N/A'}</p>
                    <p>🌐 {company.domain}</p>
                  </div>

                  {company.contacts.length > 0 && (
                    <div className="contacts-section">
                      <p className="contacts-title">Contactos <span className="contacts-hint">(clic para generar email)</span></p>
                      <div className="contacts-list">
                        {company.contacts.map((contact, idx) => (
                          <div 
                            key={idx} 
                            className="contact-item contact-clickable"
                            onClick={() => openEmailModal(contact, company)}
                            title="Clic para generar email personalizado"
                          >
                            <div className="contact-header">
                              <div>
                                <p className="contact-name">{contact.name}</p>
                                <p className="contact-title">{contact.title}</p>
                              </div>
                              <div className="contact-actions">
                                {contact.email && (
                                  <span className={`email-status ${contact.emailStatus === 'verified' ? 'verified' : 'unknown'}`}>
                                    {contact.emailStatus === 'verified' ? '✓' : '?'}
                                  </span>
                                )}
                                <span className="email-icon" title="Generar email">✉️</span>
                              </div>
                            </div>
                            {(contact.email || contact.phone) && (
                              <div className="contact-details">
                                {contact.email && <span>📧 {contact.email}</span>}
                                {contact.phone && <span>📞 {contact.phone}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {results.companies.length === 0 && (
              <div className="no-results">
                <p className="no-results-icon">🔍</p>
                <p>No se encontraron empresas</p>
                <p className="no-results-hint">Intenta ampliar los filtros</p>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Email Generation Modal */}
      {emailModal.isOpen && emailModal.contact && emailModal.company && (
        <div className="email-modal-overlay" onClick={closeEmailModal}>
          <div className="email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="email-modal-header">
              <h2>✉️ Generar Email de Ventas</h2>
              <button className="modal-close" onClick={closeEmailModal}>×</button>
            </div>
            
            <div className="email-modal-content">
              {/* Contact Info */}
              <div className="email-contact-info">
                <div className="contact-avatar">👤</div>
                <div>
                  <h3>{emailModal.contact.name}</h3>
                  <p>{emailModal.contact.title}</p>
                  <p className="contact-company">{emailModal.company.name}</p>
                  {emailModal.contact.email && (
                    <p className="contact-email">📧 {emailModal.contact.email}</p>
                  )}
                </div>
              </div>

              {/* Style Selector */}
              <div className="email-style-section">
                <h4>Estilo del email</h4>
                <div className="email-style-buttons">
                  <button 
                    className={`style-btn ${emailModal.selectedStyle === 'directo' ? 'active' : ''}`}
                    onClick={() => generateEmail('directo')}
                    disabled={emailModal.isGenerating}
                  >
                    <span className="style-icon">🎯</span>
                    <span className="style-name">Directo</span>
                    <span className="style-desc">Corto y al punto</span>
                  </button>
                  <button 
                    className={`style-btn ${emailModal.selectedStyle === 'storytelling' ? 'active' : ''}`}
                    onClick={() => generateEmail('storytelling')}
                    disabled={emailModal.isGenerating}
                  >
                    <span className="style-icon">📖</span>
                    <span className="style-name">Storytelling</span>
                    <span className="style-desc">Con mini-historia</span>
                  </button>
                  <button 
                    className={`style-btn ${emailModal.selectedStyle === 'pregunta' ? 'active' : ''}`}
                    onClick={() => generateEmail('pregunta')}
                    disabled={emailModal.isGenerating}
                  >
                    <span className="style-icon">❓</span>
                    <span className="style-name">Pregunta</span>
                    <span className="style-desc">Abre con reflexión</span>
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {emailModal.isGenerating && (
                <div className="email-generating">
                  <span className="spinner"></span>
                  <p>Generando email personalizado con IA...</p>
                </div>
              )}

              {/* Generated Email */}
              {emailModal.generatedEmail && !emailModal.isGenerating && (
                <div className="email-result">
                  <div className="email-subject">
                    <label>Asunto:</label>
                    <div className="subject-text">{emailModal.generatedEmail.subject}</div>
                  </div>
                  <div className="email-body">
                    <label>Mensaje:</label>
                    <div className="body-text">{emailModal.generatedEmail.body}</div>
                  </div>
                  {emailModal.generatedEmail.tips.length > 0 && (
                    <div className="email-tips">
                      <label>💡 Tips de seguimiento:</label>
                      <ul>
                        {emailModal.generatedEmail.tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="email-actions">
                    <button className="copy-btn" onClick={copyEmailToClipboard}>
                      📋 Copiar Email
                    </button>
                    {emailModal.contact.email && (
                      <a 
                        href={`mailto:${emailModal.contact.email}?subject=${encodeURIComponent(emailModal.generatedEmail.subject)}&body=${encodeURIComponent(emailModal.generatedEmail.body)}`}
                        className="send-btn"
                      >
                        📤 Abrir en Email
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
