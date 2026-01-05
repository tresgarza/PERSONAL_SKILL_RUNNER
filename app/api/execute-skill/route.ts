import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

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

// Función para calcular similitud entre direcciones
function calculateAddressSimilarity(addr1: string, addr2: string): { percentage: number; differences: string[] } {
  const normalize = (s: string) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[.,#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  const n1 = normalize(addr1)
  const n2 = normalize(addr2)
  
  const words1 = n1.split(' ').filter(w => w.length > 1)
  const words2 = n2.split(' ').filter(w => w.length > 1)
  
  // Palabras que coinciden
  const matches = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)))
  const percentage = Math.round((matches.length / Math.max(words1.length, words2.length)) * 100)
  
  // Encontrar diferencias
  const differences: string[] = []
  
  // Palabras en documento pero no en Google
  const missingInGoogle = words1.filter(w => !words2.some(w2 => w2.includes(w) || w.includes(w2)))
  if (missingInGoogle.length > 0) {
    differences.push(`"${missingInGoogle.join(', ')}" no aparece en Google Maps`)
  }
  
  // Palabras en Google pero no en documento
  const missingInDoc = words2.filter(w => !words1.some(w1 => w1.includes(w) || w.includes(w1)))
  if (missingInDoc.length > 0) {
    differences.push(`Google Maps incluye: "${missingInDoc.join(', ')}"`)
  }
  
  return { percentage, differences }
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
        
        // Verificar con Google Maps
        const googleResult = await verifyAddressWithGoogleMaps(direccionDocumento)
        
        if (googleResult.success) {
          const similarity = calculateAddressSimilarity(direccionDocumento, googleResult.formatted_address)
          
          return NextResponse.json({
            result: JSON.stringify(extractedData, null, 2),
            addressVerification: {
              direccion_documento: direccionDocumento,
              tipo_documento: extractedData.tipo_documento,
              nombre_servicio: extractedData.nombre_servicio,
              direccion_google: googleResult.formatted_address,
              coordenadas: { lat: googleResult.lat, lng: googleResult.lng },
              coincidencia: similarity.percentage,
              diferencias: similarity.differences,
              link_google_maps: `https://www.google.com/maps?q=${googleResult.lat},${googleResult.lng}`
            }
          })
        } else {
          return NextResponse.json({
            result: JSON.stringify(extractedData, null, 2),
            addressVerification: {
              direccion_documento: direccionDocumento,
              tipo_documento: extractedData.tipo_documento,
              nombre_servicio: extractedData.nombre_servicio,
              direccion_google: googleResult.formatted_address,
              coordenadas: { lat: 0, lng: 0 },
              coincidencia: 0,
              diferencias: ['No se pudo verificar la dirección con Google Maps. Verifica que la API Key esté configurada correctamente.'],
              link_google_maps: `https://www.google.com/maps/search/${encodeURIComponent(direccionDocumento)}`
            }
          })
        }
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
