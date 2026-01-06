import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

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

type FincentivaDocType = typeof FINCENTIVA_DOC_TYPES[number]

// Patrones para identificar cada tipo de documento
const DOC_PATTERNS: Record<FincentivaDocType, RegExp[]> = {
  'SOLICITUD': [
    /solicitud/i,
    /solicitud\s*de?\s*credito/i,
    /solicitud\s*credito/i,
    /request/i,
    /application/i
  ],
  'ANEXO A': [
    /anexo\s*a/i,
    /anexo_a/i,
    /anexoa/i,
    /annex\s*a/i
  ],
  'TABLA DE AMORTIZACION': [
    /tabla\s*de?\s*amortizacion/i,
    /amortizacion/i,
    /amortization/i,
    /schedule/i,
    /payment\s*schedule/i
  ],
  'CARATULA': [
    /caratula/i,
    /car[aá]tula/i,
    /cover/i,
    /portada/i,
    /front\s*page/i
  ],
  'CONTRATO': [
    /contrato/i,
    /contract/i,
    /agreement/i,
    /convenio/i
  ],
  'PAGARE': [
    /pagar[eé]/i,
    /pagare/i,
    /promissory/i,
    /note/i
  ],
  'BURO': [
    /bur[oó]/i,
    /buro/i,
    /credit\s*bureau/i,
    /credit\s*report/i,
    /reporte\s*de?\s*credito/i
  ],
  'MANDATO': [
    /mandato/i,
    /mandate/i,
    /power\s*of\s*attorney/i,
    /poder/i,
    /authorization/i,
    /autorizacion/i
  ]
}

// Función para identificar el tipo de documento basándose en el nombre del archivo
function identifyDocumentType(fileName: string): FincentivaDocType | null {
  // Normalizar el nombre del archivo
  const normalizedName = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .toLowerCase()

  // Buscar coincidencias en orden de prioridad (el orden importa)
  for (const docType of FINCENTIVA_DOC_TYPES) {
    const patterns = DOC_PATTERNS[docType]
    for (const pattern of patterns) {
      if (pattern.test(normalizedName)) {
        return docType
      }
    }
  }

  return null
}

// Función para analizar todos los archivos y clasificarlos
function analyzeFiles(files: File[]): {
  identified: Map<FincentivaDocType, { index: number; file: File }>;
  unidentified: Array<{ index: number; file: File }>;
  missing: FincentivaDocType[];
  duplicates: Map<FincentivaDocType, Array<{ index: number; file: File }>>;
} {
  const identified = new Map<FincentivaDocType, { index: number; file: File }>()
  const unidentified: Array<{ index: number; file: File }> = []
  const duplicates = new Map<FincentivaDocType, Array<{ index: number; file: File }>>()

  files.forEach((file, index) => {
    const docType = identifyDocumentType(file.name)
    
    if (docType) {
      if (identified.has(docType)) {
        // Es un duplicado
        if (!duplicates.has(docType)) {
          duplicates.set(docType, [identified.get(docType)!])
        }
        duplicates.get(docType)!.push({ index, file })
      } else {
        identified.set(docType, { index, file })
      }
    } else {
      unidentified.push({ index, file })
    }
  })

  // Determinar documentos faltantes
  const missing = FINCENTIVA_DOC_TYPES.filter(type => !identified.has(type))

  return { identified, unidentified, missing, duplicates }
}

// Función para generar el orden Fincentiva
function generateFincentivaOrder(
  identified: Map<FincentivaDocType, { index: number; file: File }>,
  unidentified: Array<{ index: number; file: File }>
): number[] {
  const order: number[] = []

  // Agregar documentos identificados en orden Fincentiva
  for (const docType of FINCENTIVA_DOC_TYPES) {
    const doc = identified.get(docType)
    if (doc) {
      order.push(doc.index)
    }
  }

  // Agregar documentos no identificados al final
  for (const doc of unidentified) {
    order.push(doc.index)
  }

  return order
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const order = formData.get('order') as string
    const mode = formData.get('mode') as string // 'fincentiva' | 'general'
    const analyzeOnly = formData.get('analyzeOnly') === 'true'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron archivos PDF' }, { status: 400 })
    }

    // Si es modo Fincentiva, analizar los archivos
    if (mode === 'fincentiva') {
      const analysis = analyzeFiles(files)

      // Si solo es análisis, devolver la información sin combinar
      if (analyzeOnly) {
        const identifiedArray = Array.from(analysis.identified.entries()).map(([type, data]) => ({
          type,
          index: data.index,
          fileName: data.file.name
        }))

        const unidentifiedArray = analysis.unidentified.map(data => ({
          index: data.index,
          fileName: data.file.name
        }))

        const suggestedOrder = generateFincentivaOrder(analysis.identified, analysis.unidentified)

        return NextResponse.json({
          success: true,
          analysis: {
            identified: identifiedArray,
            unidentified: unidentifiedArray,
            missing: analysis.missing,
            suggestedOrder,
            totalExpected: FINCENTIVA_DOC_TYPES.length,
            totalFound: analysis.identified.size
          }
        })
      }

      // Si no es solo análisis, usar el orden sugerido
      const suggestedOrder = generateFincentivaOrder(analysis.identified, analysis.unidentified)
      
      // Crear un nuevo documento PDF
      const mergedPdf = await PDFDocument.create()

      // Procesar cada PDF en el orden Fincentiva
      for (const index of suggestedOrder) {
        const file = files[index]
        
        if (!file || file.type !== 'application/pdf') {
          console.warn(`Archivo ${index} no es un PDF válido, saltando...`)
          continue
        }

        try {
          const arrayBuffer = await file.arrayBuffer()
          const pdfDoc = await PDFDocument.load(arrayBuffer)
          
          // Copiar todas las páginas del PDF al documento combinado
          const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
          pages.forEach((page) => mergedPdf.addPage(page))
        } catch (error) {
          console.error(`Error procesando archivo ${file.name}:`, error)
          return NextResponse.json(
            { error: `Error procesando ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}` },
            { status: 500 }
          )
        }
      }

      // Generar el PDF combinado
      const pdfBytes = await mergedPdf.save()

      // Convertir a base64 para enviar al cliente
      const base64 = Buffer.from(pdfBytes).toString('base64')

      // Generar información sobre documentos identificados
      const identifiedArray = Array.from(analysis.identified.entries()).map(([type, data]) => ({
        type,
        index: data.index,
        fileName: data.file.name
      }))

      return NextResponse.json({
        success: true,
        pdf: base64,
        filename: `expediente_fincentiva_${Date.now()}.pdf`,
        totalPages: mergedPdf.getPageCount(),
        totalFiles: files.length,
        analysis: {
          identified: identifiedArray,
          unidentified: analysis.unidentified.map(d => ({ index: d.index, fileName: d.file.name })),
          missing: analysis.missing,
          mode: 'fincentiva'
        }
      })
    }

    // Modo general: analizar tipos de documentos y usar el orden proporcionado
    
    // Si es análisis para modo general, devolver los tipos detectados
    if (analyzeOnly && mode === 'general') {
      const analysis = analyzeFiles(files)
      
      const identifiedArray = Array.from(analysis.identified.entries()).map(([type, data]) => ({
        type,
        index: data.index,
        fileName: data.file.name
      }))

      const unidentifiedArray = analysis.unidentified.map(data => ({
        index: data.index,
        fileName: data.file.name
      }))

      return NextResponse.json({
        success: true,
        analysis: {
          identified: identifiedArray,
          unidentified: unidentifiedArray,
          mode: 'general'
        }
      })
    }
    
    let fileOrder: number[] = []
    if (order) {
      try {
        fileOrder = JSON.parse(order)
      } catch {
        // Si no se puede parsear, usar el orden por defecto
        fileOrder = files.map((_, i) => i)
      }
    } else {
      fileOrder = files.map((_, i) => i)
    }

    // Validar que todos los índices sean válidos
    if (fileOrder.length !== files.length || 
        fileOrder.some(idx => idx < 0 || idx >= files.length)) {
      return NextResponse.json({ error: 'Orden de archivos inválido' }, { status: 400 })
    }

    // Crear un nuevo documento PDF
    const mergedPdf = await PDFDocument.create()

    // Procesar cada PDF en el orden especificado
    for (const index of fileOrder) {
      const file = files[index]
      
      if (!file || file.type !== 'application/pdf') {
        console.warn(`Archivo ${index} no es un PDF válido, saltando...`)
        continue
      }

      try {
        const arrayBuffer = await file.arrayBuffer()
        const pdfDoc = await PDFDocument.load(arrayBuffer)
        
        // Copiar todas las páginas del PDF al documento combinado
        const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices())
        pages.forEach((page) => mergedPdf.addPage(page))
      } catch (error) {
        console.error(`Error procesando archivo ${file.name}:`, error)
        return NextResponse.json(
          { error: `Error procesando ${file.name}: ${error instanceof Error ? error.message : 'Error desconocido'}` },
          { status: 500 }
        )
      }
    }

    // Generar el PDF combinado
    const pdfBytes = await mergedPdf.save()

    // Convertir a base64 para enviar al cliente
    const base64 = Buffer.from(pdfBytes).toString('base64')

    return NextResponse.json({
      success: true,
      pdf: base64,
      filename: `pdf_combinado_${Date.now()}.pdf`,
      totalPages: mergedPdf.getPageCount(),
      totalFiles: files.length,
    })
  } catch (error) {
    console.error('Error combinando PDFs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al combinar PDFs' },
      { status: 500 }
    )
  }
}
