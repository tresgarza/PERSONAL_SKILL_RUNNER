import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Prompts para generar datos estructurados (JSON)
const SKILL_PROMPTS: Record<string, string> = {
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
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const skillId = formData.get('skillId') as string
    const userInput = formData.get('userInput') as string
    const file = formData.get('file') as File | null

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
