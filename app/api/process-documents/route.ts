import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const DOCUMENT_PROMPT = `
Eres un experto en análisis y clasificación de documentos mexicanos.

Analiza cada documento y determina:
1. Tipo de documento:
   - NOMINA (recibo de nómina, talón de pago)
   - INE (identificación oficial INE/IFE)
   - ESTADO_DE_CUENTA (bancario)
   - CFE (recibo de luz)
   - AGUA (recibo de agua)
   - GAS (recibo de gas)
   - TELEFONO (recibo telefónico)
   - PREDIAL (pago de predial)
   - OTRO

2. Nombre completo del cliente/persona (titular)
3. Fecha del documento (formato AAAA_MM_DD, ejemplo: 2025_01_15)
4. Todos los datos importantes según el tipo

IMPORTANTE PARA COMPROBANTES DE NÓMINA:
- Extrae el SUELDO NETO (lo que recibe el empleado después de deducciones)
- Extrae el SUELDO BRUTO (antes de deducciones) si está disponible
- Identifica el PERIODO DE PAGO con sus fechas exactas
- Determina la PERIODICIDAD basándote en las fechas del periodo:
  * SEMANAL: periodos de ~7 días
  * DECENAL: periodos de ~10 días
  * CATORCENAL: periodos de ~14 días (cada 2 semanas)
  * QUINCENAL: periodos del 1-15 o 16-30/31 del mes
  * MENSUAL: periodos de un mes completo

RESPONDE ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{
  "tipo_documento": "NOMINA|INE|ESTADO_DE_CUENTA|CFE|AGUA|GAS|TELEFONO|PREDIAL|OTRO",
  "nombre_cliente": "NOMBRE COMPLETO EN MAYÚSCULAS",
  "fecha_documento": "AAAA_MM_DD",
  "datos_extraidos": {
    // Para NOMINA incluir obligatoriamente:
    // "sueldo_neto": número,
    // "sueldo_bruto": número (si está disponible),
    // "periodo_inicio": "AAAA-MM-DD",
    // "periodo_fin": "AAAA-MM-DD",
    // "periodicidad": "SEMANAL|DECENAL|CATORCENAL|QUINCENAL|MENSUAL",
    // "empresa": "nombre de la empresa",
    // "puesto": "puesto del empleado" (si está disponible)
    
    // Para otros documentos incluir datos relevantes
  }
}
`

// Función para analizar nóminas y calcular promedios
function analyzePayrollData(documentsData: any[]) {
  const nominas = documentsData.filter(doc => doc.tipo_documento === 'NOMINA')
  
  if (nominas.length === 0) {
    return null
  }

  const sueldosNetos: number[] = []
  const periodicidades: string[] = []

  for (const nomina of nominas) {
    const datos = nomina.datos_extraidos || {}
    
    if (datos.sueldo_neto && typeof datos.sueldo_neto === 'number') {
      sueldosNetos.push(datos.sueldo_neto)
    }
    
    if (datos.periodicidad) {
      periodicidades.push(datos.periodicidad)
    }
  }

  // Calcular promedio de ingresos
  const promedioIngreso = sueldosNetos.length > 0
    ? sueldosNetos.reduce((a, b) => a + b, 0) / sueldosNetos.length
    : 0

  // Determinar periodicidad más común
  const periodicidadConteo: Record<string, number> = {}
  for (const p of periodicidades) {
    periodicidadConteo[p] = (periodicidadConteo[p] || 0) + 1
  }
  
  let periodicidadPrincipal = 'NO DETERMINADA'
  let maxConteo = 0
  for (const [periodo, conteo] of Object.entries(periodicidadConteo)) {
    if (conteo > maxConteo) {
      maxConteo = conteo
      periodicidadPrincipal = periodo
    }
  }

  // Calcular ingreso mensual estimado
  const factorMensual: Record<string, number> = {
    'SEMANAL': 4.33,
    'DECENAL': 3,
    'CATORCENAL': 2.17,
    'QUINCENAL': 2,
    'MENSUAL': 1,
  }

  const factor = factorMensual[periodicidadPrincipal] || 1
  const ingresoMensualEstimado = promedioIngreso * factor

  return {
    cantidad_nominas: nominas.length,
    promedio_ingreso: Math.round(promedioIngreso * 100) / 100,
    periodicidad: periodicidadPrincipal,
    ingreso_mensual_estimado: Math.round(ingresoMensualEstimado * 100) / 100,
    sueldos_encontrados: sueldosNetos,
    descripcion_periodicidad: getPeriodicidadDescripcion(periodicidadPrincipal),
  }
}

function getPeriodicidadDescripcion(periodicidad: string): string {
  const descripciones: Record<string, string> = {
    'SEMANAL': 'Pago cada 7 días (~4 pagos al mes)',
    'DECENAL': 'Pago cada 10 días (~3 pagos al mes)',
    'CATORCENAL': 'Pago cada 14 días (~2 pagos al mes)',
    'QUINCENAL': 'Pago los días 15 y último de cada mes (2 pagos al mes)',
    'MENSUAL': 'Pago una vez al mes',
    'NO DETERMINADA': 'No se pudo determinar la periodicidad',
  }
  return descripciones[periodicidad] || periodicidad
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const formData = await request.formData()
        const files = formData.getAll('files') as File[]
        
        if (files.length === 0) {
          sendEvent({ type: 'error', message: 'No se subieron archivos' })
          controller.close()
          return
        }

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          sendEvent({ type: 'error', message: 'API Key no configurada' })
          controller.close()
          return
        }

        const client = new Anthropic({ apiKey })
        const documentsData: any[] = []
        const zip = new JSZip()
        let nombreClientePrincipal = ''
        
        // Enviar inicio
        sendEvent({ 
          type: 'start', 
          total: files.length,
          message: `Iniciando procesamiento de ${files.length} documentos...`
        })

        // Procesar cada archivo
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          
          sendEvent({ 
            type: 'progress', 
            current: i + 1, 
            total: files.length,
            percentage: Math.round(((i + 0.3) / files.length) * 100),
            message: `Procesando: ${file.name}`,
            step: 'reading'
          })

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
              text: 'Analiza este documento y extrae todos los datos importantes. Identifica el tipo de documento, nombre del cliente, fecha y todos los datos relevantes. Si es un comprobante de nómina, extrae el sueldo neto, bruto, periodo de pago y determina la periodicidad.',
            })

            sendEvent({ 
              type: 'progress', 
              current: i + 1, 
              total: files.length,
              percentage: Math.round(((i + 0.6) / files.length) * 100),
              message: `Analizando con IA: ${file.name}`,
              step: 'analyzing'
            })

            const response = await client.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 16000,
              system: DOCUMENT_PROMPT,
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
            
            // Guardar nombre del primer cliente como principal
            if (!nombreClientePrincipal && docData.nombre_cliente) {
              nombreClientePrincipal = docData.nombre_cliente
            }
            
            // Generar nombre de archivo nuevo: NOMBREDOC_NOMBRECLIENTE_AAAA_MM_DD
            const tipoDoc = docData.tipo_documento?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() || 'OTRO'
            const nombreCliente = docData.nombre_cliente?.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() || 'SIN_NOMBRE'
            const fecha = docData.fecha_documento || 'SIN_FECHA'
            const extension = file.name.split('.').pop() || 'pdf'
            
            // Formato: NOMBREDOC_NOMBRECLIENTE_AAAA_MM_DD
            const nombreArchivoNuevo = `${tipoDoc}_${nombreCliente}_${fecha}.${extension}`

            documentsData.push({
              nombre_cliente: docData.nombre_cliente || 'N/A',
              tipo_documento: docData.tipo_documento || 'OTRO',
              fecha_documento: docData.fecha_documento || 'N/A',
              datos_extraidos: docData.datos_extraidos || {},
              nombre_archivo_original: file.name,
              nombre_archivo_nuevo: nombreArchivoNuevo,
            })

            // Agregar archivo al ZIP con compresión DEFLATE
            zip.file(nombreArchivoNuevo, buffer, {
              compression: 'DEFLATE',
              compressionOptions: { level: 9 } // Máxima compresión
            })

            sendEvent({ 
              type: 'progress', 
              current: i + 1, 
              total: files.length,
              percentage: Math.round(((i + 1) / files.length) * 100),
              message: `Completado: ${file.name} → ${tipoDoc}`,
              step: 'complete',
              docInfo: {
                nombre: docData.nombre_cliente,
                tipo: docData.tipo_documento,
              }
            })

          } catch (error) {
            console.error(`Error procesando archivo ${file.name}:`, error)
            sendEvent({ 
              type: 'progress', 
              current: i + 1, 
              total: files.length,
              percentage: Math.round(((i + 1) / files.length) * 100),
              message: `Error en: ${file.name}`,
              step: 'error'
            })
          }
        }

        sendEvent({ 
          type: 'progress', 
          current: files.length, 
          total: files.length,
          percentage: 90,
          message: 'Generando reportes Excel y PDF...',
          step: 'generating_reports'
        })

        // Analizar datos de nóminas
        const payrollAnalysis = analyzePayrollData(documentsData)

        // Generar nombre base
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const nombreClienteZip = nombreClientePrincipal
          ? nombreClientePrincipal.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
          : 'CLIENTE'
        const baseFileName = `${nombreClienteZip}_REPORTE_${year}_${month}_${day}`

        // ========== GENERAR EXCEL CON XLSX ==========
        const wb = XLSX.utils.book_new()
        
        // Hoja de Resumen
        const resumenData = [
          ['REPORTE DE DOCUMENTOS'],
          ['Cliente:', nombreClientePrincipal || 'N/A'],
          ['Fecha de generación:', new Date().toLocaleDateString('es-MX')],
          ['Total de documentos:', documentsData.length],
          [],
        ]
        
        if (payrollAnalysis) {
          resumenData.push(
            ['=== ANÁLISIS DE INGRESOS ==='],
            ['Nóminas analizadas:', payrollAnalysis.cantidad_nominas],
            ['Promedio por periodo:', `$${payrollAnalysis.promedio_ingreso.toFixed(2)}`],
            ['Periodicidad:', payrollAnalysis.periodicidad],
            ['Descripción:', payrollAnalysis.descripcion_periodicidad],
            ['Ingreso mensual estimado:', `$${payrollAnalysis.ingreso_mensual_estimado.toFixed(2)}`],
            []
          )
        }
        
        const wsResumen = XLSX.utils.aoa_to_sheet(resumenData)
        wsResumen['!cols'] = [{ wch: 30 }, { wch: 50 }]
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

        // Agrupar por categoría
        const categorizedDocs: Record<string, typeof documentsData> = {}
        for (const doc of documentsData) {
          const cat = doc.tipo_documento || 'OTRO'
          if (!categorizedDocs[cat]) categorizedDocs[cat] = []
          categorizedDocs[cat].push(doc)
        }

        // Hoja de Nóminas
        const nominaDocs = categorizedDocs['NOMINA'] || categorizedDocs['COMPROBANTE_DE_NOMINA'] || []
        if (nominaDocs.length > 0) {
          const nominaData = [
            ['Fecha', 'No. Empleado', 'Puesto', 'Periodo', 'Sueldo', 'Propinas', 'Bonos', 'Total Percepciones', 'Total Deducciones', 'Total Depositado']
          ]
          
          let sumPercepciones = 0, sumDeducciones = 0, sumDepositado = 0
          
          for (const doc of nominaDocs) {
            const d = doc.datos_extraidos
            const percepciones = d.percepciones?.total_ingresos || d.total_ingresos || 0
            const deducciones = d.deducciones?.total_deducciones || d.total_deducciones || 0
            const depositado = d.montos_finales?.total_depositado || d.total_depositado || d.sueldo_neto || (percepciones - deducciones)
            
            sumPercepciones += percepciones
            sumDeducciones += deducciones
            sumDepositado += depositado
            
            nominaData.push([
              doc.fecha_documento.replace(/_/g, '/'),
              d.numero_empleado || '',
              d.puesto || '',
              d.periodo_pago || d.periodo || '',
              d.percepciones?.sueldo || d.sueldo || 0,
              d.percepciones?.propinas || d.propinas || 0,
              d.percepciones?.bonos || d.bonos || 0,
              percepciones,
              deducciones,
              depositado,
            ])
          }
          
          nominaData.push(['TOTAL', '', '', '', '', '', '', sumPercepciones.toString(), sumDeducciones.toString(), sumDepositado.toString()])
          
          const wsNomina = XLSX.utils.aoa_to_sheet(nominaData)
          wsNomina['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
          XLSX.utils.book_append_sheet(wb, wsNomina, 'Nominas')
        }

        // Hoja de Identificaciones
        const ineDocs = categorizedDocs['INE'] || categorizedDocs['IDENTIFICACION_OFICIAL'] || []
        if (ineDocs.length > 0) {
          const ineData = [
            ['Nombre', 'CURP', 'Clave Elector', 'Fecha Nacimiento', 'Domicilio', 'Estado', 'Municipio', 'Vigencia']
          ]
          
          for (const doc of ineDocs) {
            const d = doc.datos_extraidos
            ineData.push([
              d.nombre_completo || doc.nombre_cliente || '',
              d.curp || '',
              d.clave_de_elector || d.clave_elector || '',
              d.fecha_nacimiento || '',
              d.domicilio || '',
              d.estado || '',
              d.municipio || '',
              d.vigencia || '',
            ])
          }
          
          const wsINE = XLSX.utils.aoa_to_sheet(ineData)
          wsINE['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 15 }]
          XLSX.utils.book_append_sheet(wb, wsINE, 'Identificaciones')
        }

        // Hoja de Otros Documentos
        const otherCategories = Object.keys(categorizedDocs).filter(c => !c.includes('NOMINA') && !c.includes('INE') && !c.includes('IDENTIFICACION'))
        if (otherCategories.length > 0) {
          const otrosData = [['Cliente', 'Tipo', 'Fecha', 'Datos Principales']]
          
          for (const cat of otherCategories) {
            for (const doc of categorizedDocs[cat]) {
              const mainData = Object.entries(doc.datos_extraidos)
                .filter(([, v]) => typeof v !== 'object')
                .slice(0, 5)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ')
              
              otrosData.push([
                doc.nombre_cliente,
                doc.tipo_documento,
                doc.fecha_documento.replace(/_/g, '/'),
                mainData,
              ])
            }
          }
          
          const wsOtros = XLSX.utils.aoa_to_sheet(otrosData)
          wsOtros['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 80 }]
          XLSX.utils.book_append_sheet(wb, wsOtros, 'Otros')
        }

        // Hoja de Todos los Documentos (datos completos)
        const allDocsData = [['Cliente', 'Tipo', 'Fecha', 'Archivo Original', 'Archivo Nuevo', 'Datos Completos']]
        for (const doc of documentsData) {
          allDocsData.push([
            doc.nombre_cliente,
            doc.tipo_documento,
            doc.fecha_documento,
            doc.nombre_archivo_original,
            doc.nombre_archivo_nuevo,
            JSON.stringify(doc.datos_extraidos),
          ])
        }
        const wsAll = XLSX.utils.aoa_to_sheet(allDocsData)
        XLSX.utils.book_append_sheet(wb, wsAll, 'Datos Completos')

        // Generar buffer del Excel
        const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        
        // Agregar Excel al ZIP
        zip.file(`${baseFileName}.xlsx`, excelBuffer, {
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        })

        // ========== GENERAR PDF CON PDF-LIB ==========
        sendEvent({ 
          type: 'progress', 
          current: files.length, 
          total: files.length,
          percentage: 95,
          message: 'Generando archivo PDF...',
          step: 'generating_pdf'
        })

        const pdfDoc = await PDFDocument.create()
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
        
        const greenColor = rgb(16/255, 185/255, 129/255)
        const blueColor = rgb(59/255, 130/255, 246/255)
        const grayColor = rgb(107/255, 114/255, 128/255)
        const blackColor = rgb(0, 0, 0)
        const lightGray = rgb(0.4, 0.4, 0.4)

        // Primera página - Resumen
        let page = pdfDoc.addPage([612, 792]) // Tamaño carta
        let yPos = 750

        // Título
        page.drawText('REPORTE DE DOCUMENTOS', {
          x: 50,
          y: yPos,
          size: 20,
          font: helveticaBold,
          color: greenColor,
        })
        yPos -= 25

        page.drawText(nombreClientePrincipal || 'CLIENTE', {
          x: 50,
          y: yPos,
          size: 14,
          font: helveticaBold,
          color: blackColor,
        })
        yPos -= 18

        page.drawText(`Generado: ${new Date().toLocaleDateString('es-MX')}`, {
          x: 50,
          y: yPos,
          size: 10,
          font: helvetica,
          color: lightGray,
        })
        yPos -= 25

        // Línea separadora
        page.drawLine({
          start: { x: 50, y: yPos },
          end: { x: 562, y: yPos },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        })
        yPos -= 20

        page.drawText(`Total de documentos: ${documentsData.length}`, {
          x: 50,
          y: yPos,
          size: 11,
          font: helvetica,
          color: blackColor,
        })
        yPos -= 30

        // Resumen de Ingresos
        if (payrollAnalysis) {
          page.drawText('RESUMEN DE INGRESOS', {
            x: 50,
            y: yPos,
            size: 14,
            font: helveticaBold,
            color: greenColor,
          })
          yPos -= 20

          const incomeLines = [
            `Nominas analizadas: ${payrollAnalysis.cantidad_nominas}`,
            `Promedio por periodo: $${payrollAnalysis.promedio_ingreso.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
            `Periodicidad: ${payrollAnalysis.periodicidad}`,
            `Descripcion: ${payrollAnalysis.descripcion_periodicidad}`,
            `Ingreso mensual estimado: $${payrollAnalysis.ingreso_mensual_estimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          ]
          
          for (const line of incomeLines) {
            page.drawText(line, {
              x: 50,
              y: yPos,
              size: 10,
              font: helvetica,
              color: blackColor,
            })
            yPos -= 15
          }
          yPos -= 15
        }

        // Nóminas
        if (nominaDocs.length > 0) {
          if (yPos < 200) {
            page = pdfDoc.addPage([612, 792])
            yPos = 750
          }

          page.drawText(`NOMINAS (${nominaDocs.length} documento${nominaDocs.length > 1 ? 's' : ''})`, {
            x: 50,
            y: yPos,
            size: 14,
            font: helveticaBold,
            color: greenColor,
          })
          yPos -= 20

          for (const nominaDoc of nominaDocs) {
            if (yPos < 100) {
              page = pdfDoc.addPage([612, 792])
              yPos = 750
            }

            const d = nominaDoc.datos_extraidos
            const percepciones = d.percepciones?.total_ingresos || d.total_ingresos || 0
            const deducciones = d.deducciones?.total_deducciones || d.total_deducciones || 0
            const depositado = d.montos_finales?.total_depositado || d.total_depositado || d.sueldo_neto || (percepciones - deducciones)

            page.drawText(`Fecha: ${nominaDoc.fecha_documento.replace(/_/g, '/')} | Puesto: ${d.puesto || 'N/A'}`, {
              x: 50, y: yPos, size: 10, font: helvetica, color: blackColor,
            })
            yPos -= 14
            page.drawText(`Periodo: ${(d.periodo_pago || d.periodo || 'N/A').substring(0, 60)}`, {
              x: 50, y: yPos, size: 10, font: helvetica, color: blackColor,
            })
            yPos -= 14
            page.drawText(`Ingresos: $${percepciones.toLocaleString('es-MX')} | Deducciones: $${deducciones.toLocaleString('es-MX')} | Neto: $${depositado.toLocaleString('es-MX')}`, {
              x: 50, y: yPos, size: 10, font: helveticaBold, color: greenColor,
            })
            yPos -= 22
          }
        }

        // Identificaciones
        if (ineDocs.length > 0) {
          page = pdfDoc.addPage([612, 792])
          yPos = 750

          page.drawText(`IDENTIFICACIONES (${ineDocs.length} documento${ineDocs.length > 1 ? 's' : ''})`, {
            x: 50,
            y: yPos,
            size: 14,
            font: helveticaBold,
            color: blueColor,
          })
          yPos -= 25

          for (const ineDoc of ineDocs) {
            if (yPos < 150) {
              page = pdfDoc.addPage([612, 792])
              yPos = 750
            }

            const d = ineDoc.datos_extraidos
            const ineLines = [
              `Nombre: ${d.nombre_completo || ineDoc.nombre_cliente || 'N/A'}`,
              `CURP: ${d.curp || 'N/A'}`,
              `Clave Elector: ${d.clave_de_elector || d.clave_elector || 'N/A'}`,
              `Fecha Nacimiento: ${d.fecha_nacimiento || 'N/A'}`,
              `Domicilio: ${(d.domicilio || 'N/A').substring(0, 80)}`,
              `Estado: ${d.estado || 'N/A'} | Municipio: ${d.municipio || 'N/A'}`,
              `Vigencia: ${d.vigencia || 'N/A'}`,
            ]

            for (const line of ineLines) {
              page.drawText(line, {
                x: 50,
                y: yPos,
                size: 10,
                font: helvetica,
                color: blackColor,
              })
              yPos -= 14
            }
            yPos -= 15
          }
        }

        // Otros documentos
        if (otherCategories.length > 0) {
          page = pdfDoc.addPage([612, 792])
          yPos = 750

          page.drawText('OTROS DOCUMENTOS', {
            x: 50,
            y: yPos,
            size: 14,
            font: helveticaBold,
            color: grayColor,
          })
          yPos -= 25

          for (const cat of otherCategories) {
            if (yPos < 100) {
              page = pdfDoc.addPage([612, 792])
              yPos = 750
            }

            page.drawText(`${cat.replace(/_/g, ' ')} (${categorizedDocs[cat].length})`, {
              x: 50,
              y: yPos,
              size: 12,
              font: helveticaBold,
              color: rgb(245/255, 158/255, 11/255),
            })
            yPos -= 18

            for (const otherDoc of categorizedDocs[cat]) {
              if (yPos < 80) {
                page = pdfDoc.addPage([612, 792])
                yPos = 750
              }

              page.drawText(`Cliente: ${otherDoc.nombre_cliente} | Fecha: ${otherDoc.fecha_documento.replace(/_/g, '/')}`, {
                x: 50,
                y: yPos,
                size: 10,
                font: helvetica,
                color: blackColor,
              })
              yPos -= 14

              const mainData = Object.entries(otherDoc.datos_extraidos)
                .filter(([, v]) => typeof v !== 'object')
                .slice(0, 4)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ')

              if (mainData) {
                page.drawText(mainData.substring(0, 90), {
                  x: 50,
                  y: yPos,
                  size: 9,
                  font: helvetica,
                  color: lightGray,
                })
                yPos -= 12
              }
              yPos -= 8
            }
            yPos -= 10
          }
        }

        const pdfBuffer = Buffer.from(await pdfDoc.save())

        // Agregar PDF al ZIP
        zip.file(`${baseFileName}.pdf`, pdfBuffer, {
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        })

        sendEvent({ 
          type: 'progress', 
          current: files.length, 
          total: files.length,
          percentage: 98,
          message: 'Finalizando ZIP...',
          step: 'generating_zip'
        })

        // Generar ZIP final con compresión
        const zipBuffer = await zip.generateAsync({ 
          type: 'nodebuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        })
        
        // Guardar ZIP temporalmente
        const tempDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true })
        }
        
        const zipFileName = `${nombreClienteZip}_DOCUMENTOS_${year}_${month}_${day}.zip`
        const zipPath = path.join(tempDir, zipFileName)
        fs.writeFileSync(zipPath, zipBuffer)
        
        // Generar CSV para el frontend
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

        sendEvent({ 
          type: 'complete', 
          percentage: 100,
          message: `¡Listo! Se procesaron ${documentsData.length} documentos. El ZIP incluye el reporte Excel y PDF.`,
          result: {
            csv: csvContent,
            csvFileName: `${nombreClienteZip}_DATOS_${year}_${month}_${day}.csv`,
            documentsData,
            zipUrl: `/api/download-zip?file=${encodeURIComponent(zipFileName)}`,
            zipFileName,
            payrollAnalysis,
          }
        })

      } catch (error) {
        console.error('Error en procesamiento:', error)
        sendEvent({ 
          type: 'error', 
          message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
        })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
