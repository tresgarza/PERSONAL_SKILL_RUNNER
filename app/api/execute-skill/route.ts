import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { validateAddressWithSepomex, getColoniasByCP, getLocationByCP } from '@/lib/sepomex'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'

// Función para verificar dirección con Google Maps Geocoding API
async function verifyAddressWithGoogleMaps(address: string): Promise<{
  formatted_address: string
  lat: number
  lng: number
  success: boolean
}> {
  // #region agent log H1
  fetch('http://127.0.0.1:7245/ingest/1fe64fd2-516e-4e4c-ad7e-e400237c7adc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:verifyAddressWithGoogleMaps:entry',message:'Function called with address',data:{address,hasEnvKey:!!process.env.GOOGLE_MAPS_API_KEY,keyPrefix:process.env.GOOGLE_MAPS_API_KEY?.substring(0,10)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    // #region agent log H1-nokey
    fetch('http://127.0.0.1:7245/ingest/1fe64fd2-516e-4e4c-ad7e-e400237c7adc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:verifyAddressWithGoogleMaps:nokey',message:'API Key NOT found in env',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return { formatted_address: 'API Key de Google Maps no configurada', lat: 0, lng: 0, success: false }
  }

  try {
    const encodedAddress = encodeURIComponent(address)
    // Forzar búsqueda SOLO en México para evitar confusiones con nombres de calles
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&language=es&region=mx&components=country:MX`
    
    // #region agent log H3
    fetch('http://127.0.0.1:7245/ingest/1fe64fd2-516e-4e4c-ad7e-e400237c7adc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:verifyAddressWithGoogleMaps:beforeFetch',message:'About to call Google Maps API',data:{encodedAddress,urlWithoutKey:url.replace(apiKey,'[REDACTED]')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    
    const response = await fetch(url)
    const data = await response.json()
    
    // #region agent log H2,H4
    fetch('http://127.0.0.1:7245/ingest/1fe64fd2-516e-4e4c-ad7e-e400237c7adc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:verifyAddressWithGoogleMaps:afterFetch',message:'Google Maps API response received',data:{status:data.status,errorMessage:data.error_message,resultsCount:data.results?.length||0,httpStatus:response.status},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2,H4'})}).catch(()=>{});
    // #endregion
    
    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0]
      // #region agent log H5-success
      fetch('http://127.0.0.1:7245/ingest/1fe64fd2-516e-4e4c-ad7e-e400237c7adc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:verifyAddressWithGoogleMaps:success',message:'Address found successfully',data:{formattedAddress:result.formatted_address,lat:result.geometry.location.lat,lng:result.geometry.location.lng},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      return {
        formatted_address: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        success: true
      }
    }
    
    // #region agent log H2-notfound
    fetch('http://127.0.0.1:7245/ingest/1fe64fd2-516e-4e4c-ad7e-e400237c7adc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:verifyAddressWithGoogleMaps:notFound',message:'Address not found or API error',data:{status:data.status,errorMessage:data.error_message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return { formatted_address: 'No se encontró la dirección', lat: 0, lng: 0, success: false }
  } catch (error) {
    // #region agent log H4-error
    fetch('http://127.0.0.1:7245/ingest/1fe64fd2-516e-4e4c-ad7e-e400237c7adc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:verifyAddressWithGoogleMaps:catch',message:'Exception caught',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    console.error('Error con Google Maps API:', error)
    return { formatted_address: 'Error al consultar Google Maps', lat: 0, lng: 0, success: false }
  }
}

// Abreviaturas y sinónimos comunes en direcciones mexicanas
const ADDRESS_ABBREVIATIONS: Record<string, string[]> = {
  'nuevo leon': ['n.l.', 'nl', 'nvo leon', 'nvo. leon'],
  'ciudad de mexico': ['cdmx', 'ciudad de méxico', 'df', 'd.f.', 'distrito federal'],
  'jalisco': ['jal', 'jal.'],
  'estado de mexico': ['edomex', 'edo. mex.', 'edo mex', 'méx', 'mex'],
  'baja california': ['bc', 'b.c.'],
  'baja california sur': ['bcs', 'b.c.s.'],
  'aguascalientes': ['ags', 'ags.'],
  'chihuahua': ['chih', 'chih.'],
  'coahuila': ['coah', 'coah.'],
  'guanajuato': ['gto', 'gto.'],
  'michoacan': ['mich', 'mich.'],
  'queretaro': ['qro', 'qro.'],
  'san luis potosi': ['slp', 's.l.p.'],
  'tamaulipas': ['tamps', 'tamps.'],
  'veracruz': ['ver', 'ver.'],
  'yucatan': ['yuc', 'yuc.'],
  'calle': ['c.', 'c', 'cl', 'cl.'],
  'avenida': ['av', 'av.', 'avda', 'avda.'],
  'boulevard': ['blvd', 'blvd.', 'bulevar'],
  'colonia': ['col', 'col.'],
  'fraccionamiento': ['fracc', 'fracc.', 'frac', 'frac.'],
  'numero': ['num', 'num.', 'no', 'no.', '#'],
  'interior': ['int', 'int.'],
  'departamento': ['depto', 'depto.', 'dpto', 'dpto.'],
}

// Palabras que no aportan a la comparación
const NOISE_WORDS = ['calle', 'c', 'colonia', 'col', 'cp', 'codigo', 'postal', 'mexico', 'méxico', 'numero', 'num', 'no', 'int', 'interior', '#']

// Normalizar dirección para comparación
function normalizeAddress(addr: string): string {
  let normalized = addr.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[.,#\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Expandir abreviaturas a forma canónica
  for (const [canonical, abbrevs] of Object.entries(ADDRESS_ABBREVIATIONS)) {
    for (const abbrev of abbrevs) {
      const regex = new RegExp(`\\b${abbrev.replace(/\./g, '\\.')}\\b`, 'gi')
      normalized = normalized.replace(regex, canonical)
    }
  }
  
  return normalized
}

// Extraer componentes clave de una dirección
function extractAddressComponents(addr: string): {
  streetNumber: string
  streetName: string
  colony: string
  postalCode: string
  city: string
  state: string
} {
  const normalized = normalizeAddress(addr)
  
  // Extraer código postal (5 dígitos)
  const cpMatch = normalized.match(/\b(\d{5})\b/)
  const postalCode = cpMatch ? cpMatch[1] : ''
  
  // Extraer número de calle
  const numMatch = normalized.match(/\b(\d+)\b/)
  const streetNumber = numMatch ? numMatch[1] : ''
  
  // Extraer estado (buscar estados conocidos)
  const states = ['nuevo leon', 'jalisco', 'ciudad de mexico', 'estado de mexico', 'guanajuato', 
                  'queretaro', 'coahuila', 'tamaulipas', 'chihuahua', 'veracruz', 'puebla', 
                  'yucatan', 'michoacan', 'oaxaca', 'sonora', 'sinaloa', 'baja california']
  let state = ''
  for (const s of states) {
    if (normalized.includes(s)) {
      state = s
      break
    }
  }
  
  // Extraer ciudad (Monterrey, Guadalajara, etc.)
  const cities = ['monterrey', 'guadalajara', 'mexico', 'puebla', 'tijuana', 'leon', 'juarez',
                  'torreon', 'merida', 'queretaro', 'san luis potosi', 'aguascalientes', 'hermosillo',
                  'saltillo', 'mexicali', 'culiacan', 'chihuahua', 'morelia', 'cancun', 'azcapotzalco']
  let city = ''
  for (const c of cities) {
    if (normalized.includes(c)) {
      city = c
      break
    }
  }
  
  // Extraer colonia y calle (más complejo, usar palabras restantes)
  const words = normalized.split(' ').filter(w => w.length > 2 && !NOISE_WORDS.includes(w))
  
  return {
    streetNumber,
    streetName: words.slice(0, 2).join(' '), // Primeras palabras significativas
    colony: words.slice(2, 4).join(' '), // Siguientes palabras
    postalCode,
    city,
    state
  }
}

// Función para calcular similitud entre direcciones (MEJORADA)
function calculateAddressSimilarity(addr1: string, addr2: string): { percentage: number; differences: string[] } {
  const comp1 = extractAddressComponents(addr1)
  const comp2 = extractAddressComponents(addr2)
  
  const differences: string[] = []
  let totalScore = 0
  let maxScore = 0
  
  // Comparar número de calle (peso: 30 puntos) - MUY IMPORTANTE
  maxScore += 30
  if (comp1.streetNumber && comp2.streetNumber) {
    if (comp1.streetNumber === comp2.streetNumber) {
      totalScore += 30
    } else {
      differences.push(`Número diferente: "${comp1.streetNumber}" vs "${comp2.streetNumber}"`)
    }
  } else if (comp1.streetNumber || comp2.streetNumber) {
    totalScore += 15 // Parcial si uno tiene número
  }
  
  // Comparar código postal (peso: 25 puntos) - MUY IMPORTANTE
  maxScore += 25
  if (comp1.postalCode && comp2.postalCode) {
    if (comp1.postalCode === comp2.postalCode) {
      totalScore += 25
    } else {
      differences.push(`CP diferente: "${comp1.postalCode}" vs "${comp2.postalCode}"`)
    }
  } else if (!comp1.postalCode && !comp2.postalCode) {
    totalScore += 12 // Sin CP en ambos, neutral
  }
  
  // Comparar nombre de calle (peso: 20 puntos)
  maxScore += 20
  const street1Words = normalizeAddress(addr1).split(' ').filter(w => w.length > 2 && !NOISE_WORDS.includes(w) && !/^\d+$/.test(w))
  const street2Words = normalizeAddress(addr2).split(' ').filter(w => w.length > 2 && !NOISE_WORDS.includes(w) && !/^\d+$/.test(w))
  
  // Buscar coincidencias de palabras clave de calle
  const streetMatches = street1Words.filter(w1 => 
    street2Words.some(w2 => w1.includes(w2) || w2.includes(w1) || levenshteinSimilarity(w1, w2) > 0.7)
  )
  const streetScore = Math.min(20, (streetMatches.length / Math.max(1, Math.min(street1Words.length, street2Words.length))) * 20)
  totalScore += streetScore
  
  // Comparar ciudad (peso: 15 puntos)
  maxScore += 15
  if (comp1.city && comp2.city) {
    if (comp1.city === comp2.city || comp1.city.includes(comp2.city) || comp2.city.includes(comp1.city)) {
      totalScore += 15
    }
  } else {
    totalScore += 7 // Parcial si no se detectó ciudad
  }
  
  // Comparar estado (peso: 10 puntos)
  maxScore += 10
  if (comp1.state && comp2.state) {
    if (comp1.state === comp2.state) {
      totalScore += 10
    }
  } else {
    totalScore += 5 // Parcial si no se detectó estado
  }
  
  const percentage = Math.round((totalScore / maxScore) * 100)
  
  // Si el porcentaje es alto pero hay diferencias menores, limpiar diferencias
  if (percentage >= 85 && differences.length > 0) {
    // Solo mantener diferencias críticas (número y CP)
    const criticalDiffs = differences.filter(d => d.includes('Número diferente') || d.includes('CP diferente'))
    if (criticalDiffs.length === 0) {
      differences.length = 0 // Limpiar diferencias menores
    }
  }
  
  // Si coinciden número Y código postal, es muy probable que sea la misma dirección
  if (comp1.streetNumber === comp2.streetNumber && comp1.postalCode === comp2.postalCode && 
      comp1.streetNumber && comp1.postalCode) {
    return { 
      percentage: Math.max(percentage, 95), 
      differences: differences.length === 0 ? [] : differences 
    }
  }
  
  return { percentage, differences }
}

// Calcular similitud de Levenshtein normalizada (0-1)
function levenshteinSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  
  const matrix: number[][] = []
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  
  const distance = matrix[s1.length][s2.length]
  return 1 - (distance / Math.max(s1.length, s2.length))
}

// Prompts para generar datos estructurados (JSON)
const SKILL_PROMPTS: Record<string, string> = {
  'address-verifier': `
Eres un experto en extracción de direcciones de documentos de servicios mexicanos.

Analiza el documento (recibo de CFE, agua, gas, Telmex, u otro servicio) y extrae la dirección del domicilio.

RESPONDE ÚNICAMENTE con JSON válido (sin markdown, sin backticks, sin explicaciones):

{
  "tipo_documento": "Recibo de CFE/Agua/Gas/Telmex/Otro",
  "nombre_servicio": "nombre del proveedor de servicio",
  "numero_servicio": "número de servicio o cuenta si existe",
  "titular": "nombre del titular si aparece",
  "direccion_extraida": {
    "calle": "nombre de la calle principal",
    "numero_exterior": "número exterior",
    "numero_interior": "número interior si existe o null",
    "colonia": "nombre de la colonia",
    "municipio": "municipio, delegación o alcaldía",
    "estado": "estado o entidad federativa",
    "codigo_postal": "código postal de 5 dígitos"
  },
  "direccion_completa": "dirección completa formateada para búsqueda en Google Maps"
}

REGLAS CRÍTICAS:
1. Extrae SOLO la dirección del domicilio del cliente, NO la dirección de CFE/empresa
2. IGNORA las calles de referencia "entre X y Y" - solo usa la calle principal
3. En recibos de CFE, la dirección del cliente está después del nombre del titular
4. La colonia es MUY importante - búscala cerca del código postal (ej: "COSMOPOLITA C.P.02670" significa colonia Cosmopolita)
5. Para la direccion_completa usa ESTE formato exacto:
   "Calle Nombre #NumExt, Colonia NombreColonia, CP XXXXX, Ciudad, Estado, México"
6. SIEMPRE incluye ", México" al final para evitar confusiones con otros países
7. NO incluyas calles de referencia (como "entre Madeira y Mallorca") en direccion_completa
`,
  'pdf-to-excel': `
Eres un experto en extracción de datos de estados de cuenta bancarios.

TAREA CRÍTICA: Debes extraer ABSOLUTAMENTE TODAS las transacciones del documento, sin importar cuántas sean (pueden ser 10, 100, 500 o más).

RESPONDE ÚNICAMENTE con JSON válido (sin markdown, sin backticks, sin explicaciones):

{
  "tipo": "estado_de_cuenta",
  "banco": "nombre del banco",
  "titular": "nombre completo",
  "rfc": "RFC",
  "cuenta": "número de cuenta",
  "clabe": "CLABE",
  "periodo": "fecha inicio - fecha fin",
  "saldo_inicial": 0.00,
  "saldo_final": 0.00,
  "transacciones": [
    {"fecha": "DD/MMM", "descripcion": "texto corto", "deposito": 0, "retiro": 0, "saldo": 0}
  ],
  "resumen": {
    "total_depositos": 0.00,
    "total_retiros": 0.00,
    "num_transacciones": 0
  }
}

REGLAS CRÍTICAS:
1. EXTRAE TODAS LAS TRANSACCIONES - revisa TODAS las páginas del documento
2. Para la descripción, usa solo el concepto principal (ej: "SPEI ENVIADO", "PAGO CUENTA", "SPEI RECIBIDO")
3. Los montos son números sin símbolos ($, comas)
4. Si hay cientos de transacciones, inclúyelas TODAS
5. NO omitas ninguna transacción
6. Verifica que num_transacciones coincida con el total de items en el array transacciones
`,
  'invoice-organizer': `
Eres un experto en organización de documentos fiscales.
Analiza el documento y extrae la información.
Responde ÚNICAMENTE con JSON válido, sin markdown ni backticks.

{
  "facturas": [
    {
      "fecha": "DD/MM/YYYY",
      "proveedor": "nombre",
      "rfc_proveedor": "RFC",
      "concepto": "descripción",
      "categoria": "categoría de gasto",
      "subtotal": 0.00,
      "iva": 0.00,
      "total": 0.00
    }
  ],
  "resumen": {
    "total_facturas": 0,
    "suma_subtotales": 0.00,
    "suma_iva": 0.00,
    "suma_totales": 0.00
  }
}
`,
  'file-organizer': `
Eres un experto en organización de archivos.
Analiza la lista de archivos y sugiere una organización.
Responde en texto normal con la estructura sugerida.
`,
  'changelog-generator': `
Eres un experto en comunicación técnica.
Genera un changelog profesional en formato Markdown.
`,
  'meeting-analyzer': `
Eres un experto en análisis de reuniones.
Extrae los puntos clave, decisiones y action items.
Responde en formato estructurado.
`,
  'content-writer': `
Eres un experto en creación de contenido.
Ayuda a escribir contenido de alta calidad.
`,
  'document-organizer': `
Eres un experto en análisis y clasificación de documentos mexicanos.

Analiza cada documento y determina:
1. Tipo de documento (COMPROBANTE_DE_NOMINA, IDENTIFICACION_OFICIAL, ESTADO_DE_CUENTA, COMPROBANTE_DE_DOMICILIO, OTRO)
2. Nombre completo del cliente/persona
3. Fecha del documento (formato DD_MM_AAAA)
4. Todos los datos importantes según el tipo de documento

RESPONDE ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "tipo_documento": "COMPROBANTE_DE_NOMINA|IDENTIFICACION_OFICIAL|ESTADO_DE_CUENTA|COMPROBANTE_DE_DOMICILIO|OTRO",
  "nombre_cliente": "NOMBRE COMPLETO",
  "fecha_documento": "DD_MM_AAAA",
  "datos_extraidos": {
    // Todos los datos relevantes según el tipo de documento
  }
}

TIPOS DE DOCUMENTOS:
- COMPROBANTE_DE_NOMINA: Recibos de nómina, constancias laborales
- IDENTIFICACION_OFICIAL: INE, Pasaporte, Licencia de conducir
- ESTADO_DE_CUENTA: Estados de cuenta bancarios
- COMPROBANTE_DE_DOMICILIO: Recibos de CFE, agua, gas, Telmex
- OTRO: Cualquier otro documento
`,
}

// Función para procesar múltiples documentos
async function processDocumentOrganizer(files: File[], apiKey: string): Promise<NextResponse> {
  const client = new Anthropic({ apiKey })
  const documentsData: Array<{
    nombre_cliente: string
    tipo_documento: string
    fecha_documento: string
    datos_extraidos: Record<string, any>
    nombre_archivo_original: string
    nombre_archivo_nuevo: string
  }> = []
  
  const zip = new JSZip()

  // Procesar cada archivo
  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64Data = buffer.toString('base64')
      
      const messageContent: Anthropic.MessageCreateParams['messages'][0]['content'] = []
      
      if (file.name.toLowerCase().endsWith('.pdf')) {
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data,
          },
        })
      } else if (file.type.startsWith('image/')) {
        const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        })
      }
      
      messageContent.push({
        type: 'text',
        text: 'Analiza este documento y extrae todos los datos importantes. Identifica el tipo de documento, nombre del cliente, fecha y todos los datos relevantes.',
      })

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: SKILL_PROMPTS['document-organizer'],
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      })

      const resultText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')

      // Parsear JSON
      let cleanJson = resultText.trim()
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7)
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3)
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
      cleanJson = cleanJson.trim()

      const docData = JSON.parse(cleanJson)
      
      // Generar nombre de archivo nuevo
      const nombreCliente = docData.nombre_cliente?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() || 'SIN_NOMBRE'
      const tipoDoc = docData.tipo_documento?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() || 'OTRO'
      const fecha = docData.fecha_documento || 'SIN_FECHA'
      const extension = file.name.split('.').pop() || 'pdf'
      const nombreArchivoNuevo = `${nombreCliente}_${tipoDoc}_${fecha}.${extension}`

      documentsData.push({
        nombre_cliente: docData.nombre_cliente || 'N/A',
        tipo_documento: docData.tipo_documento || 'OTRO',
        fecha_documento: docData.fecha_documento || 'N/A',
        datos_extraidos: docData.datos_extraidos || {},
        nombre_archivo_original: file.name,
        nombre_archivo_nuevo: nombreArchivoNuevo,
      })

      // Agregar archivo al ZIP con el nuevo nombre
      zip.file(nombreArchivoNuevo, buffer)
    } catch (error) {
      console.error(`Error procesando archivo ${file.name}:`, error)
      // Continuar con el siguiente archivo aunque haya error
    }
  }

  // Generar ZIP
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const zipBase64 = zipBuffer.toString('base64')
  
  // Guardar ZIP temporalmente
  // En Vercel/serverless, usar /tmp (único directorio escribible)
  // En desarrollo local, también usar /tmp para consistencia
  const tempDir = '/tmp'
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  
  const zipFileName = `documentos_organizados_${Date.now()}.zip`
  const zipPath = path.join(tempDir, zipFileName)
  fs.writeFileSync(zipPath, zipBuffer)
  
  // Generar CSV con los datos
  const csvHeaders = ['Nombre Cliente', 'Tipo Documento', 'Fecha', 'Archivo Original', 'Archivo Nuevo', 'Datos Extraídos']
  const csvRows = documentsData.map(doc => [
    doc.nombre_cliente,
    doc.tipo_documento,
    doc.fecha_documento,
    doc.nombre_archivo_original,
    doc.nombre_archivo_nuevo,
    JSON.stringify(doc.datos_extraidos),
  ])
  
  const csvContent = [
    csvHeaders.join(','),
    ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  // Retornar respuesta con URL del ZIP (en producción usarías una URL pública)
  const zipUrl = `/api/download-zip?file=${zipFileName}`

  return NextResponse.json({
    result: `Se procesaron ${documentsData.length} documentos exitosamente.`,
    csv: csvContent,
    csvFileName: 'documentos_organizados.csv',
    documentsData,
    zipUrl,
    zipFileName,
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const skillId = formData.get('skillId') as string
    const userInput = formData.get('userInput') as string
    const file = formData.get('file') as File | null
    const files = formData.getAll('files') as File[]

    if (!skillId) {
      return NextResponse.json({ error: 'No se especificó el skill' }, { status: 400 })
    }

    // Verificar API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'API Key no configurada. Agrega ANTHROPIC_API_KEY a tu archivo .env.local' 
      }, { status: 500 })
    }

    // Procesar organizador de documentos (múltiples archivos)
    if (skillId === 'document-organizer' && files.length > 0) {
      return await processDocumentOrganizer(files, apiKey)
    }

    // Construir el mensaje para Claude
    const systemPrompt = SKILL_PROMPTS[skillId] || 'Eres un asistente útil.'
    const client = new Anthropic({ apiKey })
    
    // Preparar el contenido del mensaje
    const messageContent: Anthropic.MessageCreateParams['messages'][0]['content'] = []
    
    // Agregar instrucciones del usuario
    const userInstruction = userInput || 'Analiza el documento adjunto y extrae todos los datos estructurados.'
    
    // Procesar archivo si existe
    if (file) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64Data = buffer.toString('base64')
      
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Enviar PDF directamente a Claude (soporta PDFs nativamente)
        messageContent.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data,
          },
        })
        messageContent.push({
          type: 'text',
          text: userInstruction,
        })
      } else if (file.type.startsWith('image/')) {
        // Para imágenes
        const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        })
        messageContent.push({
          type: 'text',
          text: userInstruction,
        })
      } else {
        // Para archivos de texto
        const textContent = buffer.toString('utf-8')
        messageContent.push({
          type: 'text',
          text: `${userInstruction}\n\n--- CONTENIDO DEL ARCHIVO (${file.name}) ---\n\n${textContent}`,
        })
      }
    } else {
      messageContent.push({
        type: 'text',
        text: userInstruction,
      })
    }

    // Llamar a Claude
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    })

    // Extraer el texto de la respuesta
    const resultText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    // Para el skill de verificación de direcciones
    if (skillId === 'address-verifier') {
      try {
        let cleanJson = resultText.trim()
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7)
        if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3)
        if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
        cleanJson = cleanJson.trim()
        
        const extractedData = JSON.parse(cleanJson)
        const direccionDocumento = extractedData.direccion_completa
        const direccionExtraida = extractedData.direccion_extraida || {}
        
        // 1. Validar con SEPOMEX (fuente oficial de códigos postales)
        const sepomexValidation = validateAddressWithSepomex({
          codigoPostal: direccionExtraida.codigo_postal,
          colonia: direccionExtraida.colonia,
          municipio: direccionExtraida.municipio,
          estado: direccionExtraida.estado
        })
        
        // 2. Verificar con Google Maps
        const googleResult = await verifyAddressWithGoogleMaps(direccionDocumento)
        
        // 3. Calcular similitud combinada
        let similarity = { percentage: 0, differences: [] as string[] }
        if (googleResult.success) {
          similarity = calculateAddressSimilarity(direccionDocumento, googleResult.formatted_address)
        }
        
        // 4. Sistema de alertas de riesgo para mesa de control
        const alertasRiesgo: Array<{
          nivel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO'
          tipo: string
          mensaje: string
          accionRecomendada: string
        }> = []
        
        let coincidenciaFinal = similarity.percentage
        
        // ALERTA CRÍTICA: CP no existe en SEPOMEX
        if (direccionExtraida.codigo_postal && !sepomexValidation.cpExists) {
          alertasRiesgo.push({
            nivel: 'CRITICO',
            tipo: 'CP_INVALIDO',
            mensaje: `El código postal ${direccionExtraida.codigo_postal} NO existe en el catálogo oficial de SEPOMEX`,
            accionRecomendada: 'REVISAR MANUALMENTE - Posible fraude o error grave. Verificar con el cliente y solicitar comprobante adicional.'
          })
          coincidenciaFinal = Math.min(coincidenciaFinal, 30) // Reducir drásticamente la confianza
        }
        
        // ALERTA ALTA: CP válido pero colonia NO coincide
        if (sepomexValidation.cpExists && direccionExtraida.colonia && !sepomexValidation.coloniaMatch) {
          alertasRiesgo.push({
            nivel: 'ALTO',
            tipo: 'COLONIA_NO_COINCIDE',
            mensaje: `La colonia "${direccionExtraida.colonia}" NO corresponde al CP ${direccionExtraida.codigo_postal}`,
            accionRecomendada: 'VERIFICAR CON CLIENTE - Solicitar aclaración. Puede ser error de captura, dirección antigua o colonia informal.'
          })
          coincidenciaFinal = Math.min(coincidenciaFinal, 60)
        }
        
        // ALERTA MEDIA: Municipio no coincide
        if (sepomexValidation.cpExists && direccionExtraida.municipio && !sepomexValidation.municipioMatch) {
          alertasRiesgo.push({
            nivel: 'MEDIO',
            tipo: 'MUNICIPIO_NO_COINCIDE',
            mensaje: `El municipio "${direccionExtraida.municipio}" no coincide con el CP ${direccionExtraida.codigo_postal}`,
            accionRecomendada: 'REVISAR - Puede ser error menor o cambio administrativo. Verificar con datos oficiales de SEPOMEX.'
          })
          coincidenciaFinal = Math.min(coincidenciaFinal, 75)
        }
        
        // ALERTA MEDIA: Estado no coincide
        if (sepomexValidation.cpExists && direccionExtraida.estado && !sepomexValidation.estadoMatch) {
          alertasRiesgo.push({
            nivel: 'MEDIO',
            tipo: 'ESTADO_NO_COINCIDE',
            mensaje: `El estado "${direccionExtraida.estado}" no coincide con el CP ${direccionExtraida.codigo_postal}`,
            accionRecomendada: 'VERIFICAR - Error posible en el documento o cambio de entidad federativa.'
          })
          coincidenciaFinal = Math.min(coincidenciaFinal, 70)
        }
        
        // ALERTA MEDIA: Google Maps no encuentra la dirección
        if (!googleResult.success && direccionExtraida.codigo_postal) {
          alertasRiesgo.push({
            nivel: 'MEDIO',
            tipo: 'GOOGLE_NO_ENCONTRO',
            mensaje: 'Google Maps no pudo geocodificar esta dirección',
            accionRecomendada: 'REVISAR MANUALMENTE - La dirección puede ser incorrecta, incompleta o muy nueva.'
          })
          coincidenciaFinal = Math.min(coincidenciaFinal, 50)
        }
        
        // ALERTA BAJA: Coincidencia baja entre documento y Google Maps
        if (googleResult.success && similarity.percentage < 60) {
          alertasRiesgo.push({
            nivel: 'BAJO',
            tipo: 'COINCIDENCIA_BAJA',
            mensaje: `Baja coincidencia (${similarity.percentage}%) entre documento y Google Maps`,
            accionRecomendada: 'REVISAR - Puede haber diferencias menores en formato pero la dirección es válida.'
          })
        }
        
        // Validaciones positivas
        const validacionesExtras: string[] = []
        
        if (sepomexValidation.cpExists) {
          validacionesExtras.push('✅ CP válido según SEPOMEX')
          
          if (sepomexValidation.coloniaMatch) {
            validacionesExtras.push('✅ Colonia coincide con CP')
            coincidenciaFinal = Math.min(100, coincidenciaFinal + 10)
          }
          
          if (sepomexValidation.municipioMatch) {
            validacionesExtras.push('✅ Municipio correcto')
            coincidenciaFinal = Math.min(100, coincidenciaFinal + 5)
          }
          
          if (sepomexValidation.estadoMatch) {
            validacionesExtras.push('✅ Estado correcto')
            coincidenciaFinal = Math.min(100, coincidenciaFinal + 5)
          }
          
          // Si SEPOMEX valida todo y Google encontró la dirección, alta confianza
          if (sepomexValidation.coloniaMatch && googleResult.success) {
            coincidenciaFinal = Math.max(coincidenciaFinal, 90)
          }
        }
        
        // Determinar estado general de validación
        let estadoValidacion: 'APROBADO' | 'REVISION_REQUERIDA' | 'RECHAZADO' = 'APROBADO'
        if (alertasRiesgo.some(a => a.nivel === 'CRITICO')) {
          estadoValidacion = 'RECHAZADO'
        } else if (alertasRiesgo.some(a => a.nivel === 'ALTO' || a.nivel === 'MEDIO')) {
          estadoValidacion = 'REVISION_REQUERIDA'
        } else if (coincidenciaFinal >= 85 && sepomexValidation.cpExists && sepomexValidation.coloniaMatch) {
          estadoValidacion = 'APROBADO'
        }
        
        // 5. Obtener colonias válidas para el CP (sugerencias)
        const coloniasValidas = direccionExtraida.codigo_postal 
          ? getColoniasByCP(direccionExtraida.codigo_postal)
          : []
        
        // 6. Obtener datos oficiales de SEPOMEX
        const datosOficiales = sepomexValidation.officialData ? {
          colonia_oficial: sepomexValidation.officialData.colonia,
          municipio_oficial: sepomexValidation.officialData.municipio,
          estado_oficial: sepomexValidation.officialData.estado,
          ciudad_oficial: sepomexValidation.officialData.ciudad
        } : null
        
        return NextResponse.json({
          result: JSON.stringify(extractedData, null, 2),
          addressVerification: {
            direccion_documento: direccionDocumento,
            tipo_documento: extractedData.tipo_documento,
            nombre_servicio: extractedData.nombre_servicio,
            direccion_google: googleResult.success ? googleResult.formatted_address : 'No se pudo verificar',
            coordenadas: { lat: googleResult.lat, lng: googleResult.lng },
            coincidencia: coincidenciaFinal,
            diferencias: similarity.differences,
            link_google_maps: googleResult.success 
              ? `https://www.google.com/maps?q=${googleResult.lat},${googleResult.lng}`
              : `https://www.google.com/maps/search/${encodeURIComponent(direccionDocumento)}`,
            // Validación SEPOMEX
            validacion_sepomex: {
              cp_valido: sepomexValidation.cpExists,
              colonia_coincide: sepomexValidation.coloniaMatch,
              municipio_coincide: sepomexValidation.municipioMatch,
              estado_coincide: sepomexValidation.estadoMatch,
              validaciones: validacionesExtras,
              sugerencias_sepomex: sepomexValidation.suggestions,
              colonias_validas_para_cp: coloniasValidas.slice(0, 10),
              datos_oficiales: datosOficiales
            },
            // Sistema de alertas para mesa de control
            alertas_riesgo: alertasRiesgo,
            estado_validacion: estadoValidacion,
            resumen_mesa_control: {
              puede_aprobar: estadoValidacion === 'APROBADO',
              requiere_revision: estadoValidacion === 'REVISION_REQUERIDA',
              debe_rechazar: estadoValidacion === 'RECHAZADO',
              nivel_riesgo_maximo: alertasRiesgo.length > 0 
                ? alertasRiesgo.reduce((max, a) => {
                    const niveles = { CRITICO: 4, ALTO: 3, MEDIO: 2, BAJO: 1 }
                    return niveles[a.nivel] > niveles[max] ? a.nivel : max
                  }, alertasRiesgo[0].nivel as 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO')
                : null,
              total_alertas: alertasRiesgo.length,
              alertas_criticas: alertasRiesgo.filter(a => a.nivel === 'CRITICO').length,
              alertas_altas: alertasRiesgo.filter(a => a.nivel === 'ALTO').length
            }
          }
        })
      } catch (parseError) {
        console.log('Error procesando address-verifier:', parseError)
        return NextResponse.json({ result: resultText })
      }
    }

    // Para skills que generan Excel, intentar parsear JSON y generar CSV
    if (skillId === 'pdf-to-excel' || skillId === 'invoice-organizer') {
      try {
        // Limpiar el JSON (remover posibles backticks de markdown)
        let cleanJson = resultText.trim()
        if (cleanJson.startsWith('```json')) {
          cleanJson = cleanJson.slice(7)
        }
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.slice(3)
        }
        if (cleanJson.endsWith('```')) {
          cleanJson = cleanJson.slice(0, -3)
        }
        cleanJson = cleanJson.trim()

        // Intentar arreglar JSON truncado
        let data
        try {
          data = JSON.parse(cleanJson)
        } catch {
          // JSON está truncado, intentar repararlo
          console.log('JSON truncado, intentando reparar...')
          
          // Buscar el último objeto completo en transacciones
          const transMatch = cleanJson.match(/"transacciones"\s*:\s*\[/)
          if (transMatch) {
            // Encontrar todas las transacciones completas
            const allTransactions: Array<{fecha: string, descripcion: string, deposito: number, retiro: number, saldo: number}> = []
            const transRegex = /\{[^{}]*"fecha"\s*:\s*"([^"]*)"[^{}]*"descripcion"\s*:\s*"([^"]*)"[^{}]*"deposito"\s*:\s*(\d+(?:\.\d+)?)[^{}]*"retiro"\s*:\s*(\d+(?:\.\d+)?)[^{}]*"saldo"\s*:\s*(-?\d+(?:\.\d+)?)[^{}]*\}/g
            let match
            while ((match = transRegex.exec(cleanJson)) !== null) {
              allTransactions.push({
                fecha: match[1],
                descripcion: match[2],
                deposito: parseFloat(match[3]) || 0,
                retiro: parseFloat(match[4]) || 0,
                saldo: parseFloat(match[5]) || 0
              })
            }
            
            // Extraer metadatos
            const bancoMatch = cleanJson.match(/"banco"\s*:\s*"([^"]*)"/)
            const titularMatch = cleanJson.match(/"titular"\s*:\s*"([^"]*)"/)
            const rfcMatch = cleanJson.match(/"rfc"\s*:\s*"([^"]*)"/)
            const cuentaMatch = cleanJson.match(/"cuenta"\s*:\s*"([^"]*)"/)
            const clabeMatch = cleanJson.match(/"clabe"\s*:\s*"([^"]*)"/)
            const periodoMatch = cleanJson.match(/"periodo"\s*:\s*"([^"]*)"/)
            const saldoIniMatch = cleanJson.match(/"saldo_inicial"\s*:\s*(-?\d+(?:\.\d+)?)/)
            const saldoFinMatch = cleanJson.match(/"saldo_final"\s*:\s*(-?\d+(?:\.\d+)?)/)
            
            data = {
              tipo: 'estado_de_cuenta',
              banco: bancoMatch?.[1] || 'Desconocido',
              titular: titularMatch?.[1] || '',
              rfc: rfcMatch?.[1] || '',
              cuenta: cuentaMatch?.[1] || '',
              clabe: clabeMatch?.[1] || '',
              periodo: periodoMatch?.[1] || '',
              saldo_inicial: parseFloat(saldoIniMatch?.[1] || '0'),
              saldo_final: parseFloat(saldoFinMatch?.[1] || '0'),
              transacciones: allTransactions,
              resumen: {
                total_depositos: allTransactions.reduce((sum, t) => sum + t.deposito, 0),
                total_retiros: allTransactions.reduce((sum, t) => sum + t.retiro, 0),
                num_transacciones: allTransactions.length
              },
              _nota: `DATOS PARCIALES - Se extrajeron ${allTransactions.length} transacciones (el documento puede tener más)`
            }
            
            console.log(`JSON reparado: ${allTransactions.length} transacciones extraídas`)
          } else {
            throw new Error('No se pudo reparar el JSON')
          }
        }
        
        // Generar CSV basado en el tipo de datos
        let csvContent = ''
        let csvFileName = 'datos_extraidos.csv'
        
        if (data.transacciones) {
          // Estado de cuenta
          const cuentaClean = (data.cuenta || 'extracto').replace(/[^a-zA-Z0-9]/g, '_')
          csvFileName = `estado_cuenta_${cuentaClean}.csv`
          
          // Header con información general
          csvContent = `ESTADO DE CUENTA\n`
          csvContent += `Banco,${data.banco || ''}\n`
          csvContent += `Titular,${data.titular || ''}\n`
          csvContent += `RFC,${data.rfc || ''}\n`
          csvContent += `Cuenta,${data.cuenta || ''}\n`
          csvContent += `CLABE,${data.clabe || ''}\n`
          csvContent += `Periodo,${data.periodo || ''}\n`
          csvContent += `Saldo Inicial,${data.saldo_inicial || 0}\n`
          csvContent += `Saldo Final,${data.saldo_final || 0}\n`
          csvContent += `\n`
          
          // Transacciones
          csvContent += `MOVIMIENTOS\n`
          csvContent += `Fecha,Descripcion,Deposito,Retiro,Saldo\n`
          for (const t of data.transacciones) {
            const descripcion = String(t.descripcion || '').replace(/,/g, ' ').replace(/"/g, "'").replace(/\n/g, ' ')
            csvContent += `${t.fecha || ''},${descripcion},${t.deposito || 0},${t.retiro || 0},${t.saldo || 0}\n`
          }
          
          // Resumen
          csvContent += `\n`
          csvContent += `RESUMEN\n`
          csvContent += `Total Depositos,${data.resumen?.total_depositos || 0}\n`
          csvContent += `Total Retiros,${data.resumen?.total_retiros || 0}\n`
          csvContent += `Num. Transacciones,${data.resumen?.num_transacciones || data.transacciones?.length || 0}\n`
          
          // Nota si los datos son parciales
          if (data._nota) {
            csvContent += `\nNOTA,${data._nota}\n`
          }
          
        } else if (data.facturas) {
          // Facturas organizadas
          csvFileName = 'facturas_organizadas.csv'
          csvContent = 'Fecha,Proveedor,RFC,Concepto,Categoria,Subtotal,IVA,Total\n'
          for (const f of data.facturas) {
            const concepto = String(f.concepto || '').replace(/,/g, ' ')
            csvContent += `${f.fecha || ''},${f.proveedor || ''},${f.rfc_proveedor || ''},${concepto},${f.categoria || ''},${f.subtotal || 0},${f.iva || 0},${f.total || 0}\n`
          }
          if (data.resumen) {
            csvContent += `\nRESUMEN\n`
            csvContent += `Total Facturas,${data.resumen.total_facturas || 0}\n`
            csvContent += `Suma Subtotales,${data.resumen.suma_subtotales || 0}\n`
            csvContent += `Suma IVA,${data.resumen.suma_iva || 0}\n`
            csvContent += `Suma Totales,${data.resumen.suma_totales || 0}\n`
          }
        } else if (data.conceptos) {
          // Factura individual
          csvFileName = `factura_${data.numero_factura || 'sin_numero'}.csv`
          csvContent = `FACTURA ${data.numero_factura || ''}\n`
          csvContent += `Fecha,${data.fecha || ''}\n`
          csvContent += `Emisor,${data.emisor?.nombre || ''}\n`
          csvContent += `RFC Emisor,${data.emisor?.rfc || ''}\n`
          csvContent += `Receptor,${data.receptor?.nombre || ''}\n`
          csvContent += `RFC Receptor,${data.receptor?.rfc || ''}\n\n`
          csvContent += `CONCEPTOS\n`
          csvContent += 'Cantidad,Descripcion,Precio Unitario,Importe\n'
          for (const c of data.conceptos) {
            csvContent += `${c.cantidad || 1},${c.descripcion || ''},${c.precio_unitario || 0},${c.importe || 0}\n`
          }
          csvContent += `\n,Subtotal,,${data.subtotal || 0}\n`
          csvContent += `,IVA,,${data.iva || 0}\n`
          csvContent += `,TOTAL,,${data.total || 0}\n`
        }

        if (csvContent) {
          return NextResponse.json({ 
            result: JSON.stringify(data, null, 2),
            csv: csvContent,
            csvFileName: csvFileName,
            jsonData: data
          })
        }
      } catch (parseError) {
        console.log('No se pudo parsear como JSON:', parseError)
        // Si no es JSON válido, devolver el texto normal
      }
    }

    return NextResponse.json({ result: resultText })
  } catch (error) {
    console.error('Error ejecutando skill:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
