'use client'

import { useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface DocumentData {
  nombre_cliente: string
  tipo_documento: string
  fecha_documento: string
  datos_extraidos: Record<string, any>
  nombre_archivo_original: string
  nombre_archivo_nuevo: string
}

interface PayrollAnalysis {
  cantidad_nominas: number
  promedio_ingreso: number
  periodicidad: string
  ingreso_mensual_estimado: number
  sueldos_encontrados: number[]
  descripcion_periodicidad: string
}

interface DocumentViewerProps {
  documents: DocumentData[]
  clientName?: string
  payrollAnalysis?: PayrollAnalysis
}

const DOCUMENT_ICONS: Record<string, string> = {
  'NOMINA': '💰',
  'COMPROBANTE_DE_NOMINA': '💰',
  'INE': '🪪',
  'IDENTIFICACION_OFICIAL': '🪪',
  'ESTADO_DE_CUENTA': '🏦',
  'CFE': '💡',
  'AGUA': '💧',
  'GAS': '🔥',
  'TELEFONO': '📱',
  'PREDIAL': '🏠',
  'OTRO': '📄',
}

const DOCUMENT_COLORS: Record<string, string> = {
  'NOMINA': '#10b981',
  'COMPROBANTE_DE_NOMINA': '#10b981',
  'INE': '#3b82f6',
  'IDENTIFICACION_OFICIAL': '#3b82f6',
  'ESTADO_DE_CUENTA': '#8b5cf6',
  'CFE': '#f59e0b',
  'AGUA': '#06b6d4',
  'GAS': '#ef4444',
  'TELEFONO': '#ec4899',
  'PREDIAL': '#84cc16',
  'OTRO': '#6b7280',
}

export default function DocumentViewer({ documents, clientName, payrollAnalysis }: DocumentViewerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null)

  // Agrupar documentos por tipo
  const categorizedDocs = documents.reduce((acc, doc) => {
    const type = doc.tipo_documento || 'OTRO'
    if (!acc[type]) acc[type] = []
    acc[type].push(doc)
    return acc
  }, {} as Record<string, DocumentData[]>)

  const categories = Object.keys(categorizedDocs)
  
  const filteredDocs = activeCategory === 'all' 
    ? documents 
    : categorizedDocs[activeCategory] || []

  // Función para formatear valores
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'number') {
      return value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  // Función para renderizar datos extraídos de forma estructurada
  const renderExtractedData = (datos: Record<string, any>, tipoDoc: string) => {
    if (!datos || Object.keys(datos).length === 0) return null

    // Para nóminas, mostrar de forma especial
    if (tipoDoc.includes('NOMINA')) {
      return (
        <div className="nomina-data">
          {/* Info General */}
          <div className="data-section">
            <h5>📋 Información General</h5>
            <div className="data-grid">
              {datos.numero_empleado && <DataItem label="No. Empleado" value={datos.numero_empleado} />}
              {datos.puesto && <DataItem label="Puesto" value={datos.puesto} />}
              {datos.empresa && <DataItem label="Empresa" value={datos.empresa} />}
              {datos.periodo_pago && <DataItem label="Periodo" value={datos.periodo_pago} />}
              {datos.salario_diario && <DataItem label="Salario Diario" value={`$${formatValue(datos.salario_diario)}`} />}
            </div>
          </div>

          {/* Percepciones */}
          {datos.percepciones && (
            <div className="data-section percepciones">
              <h5>💵 Percepciones</h5>
              <div className="data-grid">
                {Object.entries(datos.percepciones).map(([key, value]) => (
                  <DataItem 
                    key={key} 
                    label={formatLabel(key)} 
                    value={typeof value === 'number' ? `$${formatValue(value)}` : String(value)}
                    highlight={key === 'total_ingresos'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Deducciones */}
          {datos.deducciones && (
            <div className="data-section deducciones">
              <h5>📉 Deducciones</h5>
              <div className="data-grid">
                {Object.entries(datos.deducciones).map(([key, value]) => (
                  <DataItem 
                    key={key} 
                    label={formatLabel(key)} 
                    value={typeof value === 'number' ? `$${formatValue(value)}` : String(value)}
                    highlight={key === 'total_deducciones'}
                    negative
                  />
                ))}
              </div>
            </div>
          )}

          {/* Montos Finales */}
          {datos.montos_finales && (
            <div className="data-section montos-finales">
              <h5>✅ Montos Finales</h5>
              <div className="data-grid">
                {Object.entries(datos.montos_finales).map(([key, value]) => (
                  <DataItem 
                    key={key} 
                    label={formatLabel(key)} 
                    value={typeof value === 'number' ? `$${formatValue(value)}` : String(value)}
                    highlight={key === 'total_depositado'}
                    success
                  />
                ))}
              </div>
            </div>
          )}

          {/* Otros campos */}
          {renderOtherFields(datos, ['numero_empleado', 'puesto', 'empresa', 'periodo_pago', 'salario_diario', 'percepciones', 'deducciones', 'montos_finales'])}
        </div>
      )
    }

    // Para identificaciones
    if (tipoDoc.includes('INE') || tipoDoc.includes('IDENTIFICACION')) {
      return (
        <div className="ine-data">
          <div className="data-section">
            <h5>🪪 Datos de Identificación</h5>
            <div className="data-grid">
              {datos.nombre_completo && <DataItem label="Nombre" value={datos.nombre_completo} />}
              {datos.curp && <DataItem label="CURP" value={datos.curp} highlight />}
              {datos.clave_de_elector && <DataItem label="Clave Elector" value={datos.clave_de_elector} />}
              {datos.fecha_nacimiento && <DataItem label="Fecha Nacimiento" value={datos.fecha_nacimiento} />}
              {datos.sexo && <DataItem label="Sexo" value={datos.sexo === 'H' ? 'Hombre' : datos.sexo === 'M' ? 'Mujer' : datos.sexo} />}
              {datos.domicilio && <DataItem label="Domicilio" value={datos.domicilio} wide />}
              {datos.estado && <DataItem label="Estado" value={datos.estado} />}
              {datos.municipio && <DataItem label="Municipio" value={datos.municipio} />}
              {datos.seccion && <DataItem label="Sección" value={datos.seccion} />}
              {datos.vigencia && <DataItem label="Vigencia" value={datos.vigencia} />}
            </div>
          </div>
          {renderOtherFields(datos, ['nombre_completo', 'curp', 'clave_de_elector', 'fecha_nacimiento', 'sexo', 'domicilio', 'estado', 'municipio', 'seccion', 'vigencia', 'tipo_identificacion', 'institucion_emisora', 'año_registro'])}
        </div>
      )
    }

    // Para otros documentos - mostrar todo
    return (
      <div className="generic-data">
        <div className="data-section">
          <h5>📋 Datos Extraídos</h5>
          <div className="data-grid">
            {Object.entries(datos).map(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                return (
                  <div key={key} className="nested-data">
                    <h6>{formatLabel(key)}</h6>
                    <div className="data-grid nested">
                      {Object.entries(value).map(([k, v]) => (
                        <DataItem key={k} label={formatLabel(k)} value={formatValue(v)} />
                      ))}
                    </div>
                  </div>
                )
              }
              return <DataItem key={key} label={formatLabel(key)} value={formatValue(value)} />
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderOtherFields = (datos: Record<string, any>, excludeKeys: string[]) => {
    const otherFields = Object.entries(datos).filter(([key]) => !excludeKeys.includes(key))
    if (otherFields.length === 0) return null

    return (
      <div className="data-section other-fields">
        <h5>📎 Información Adicional</h5>
        <div className="data-grid">
          {otherFields.map(([key, value]) => {
            if (typeof value === 'object') return null
            return <DataItem key={key} label={formatLabel(key)} value={formatValue(value)} />
          })}
        </div>
      </div>
    )
  }

  // Helper para extraer valores de nómina de diferentes estructuras posibles
  const extractNominaData = (d: Record<string, any>) => {
    // Función auxiliar para parsear números
    const parseNum = (val: any): number => {
      if (val === null || val === undefined) return 0
      if (typeof val === 'number') return val
      const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''))
      return isNaN(parsed) ? 0 : parsed
    }

    // Buscar sueldo en múltiples ubicaciones
    const sueldo = parseNum(
      d.percepciones?.sueldo || d.percepciones?.salario || d.percepciones?.sueldo_base ||
      d.sueldo || d.salario || d.sueldo_base || d.salario_base || 0
    )
    
    const propinas = parseNum(d.percepciones?.propinas || d.propinas || 0)
    const bonos = parseNum(d.percepciones?.bonos || d.percepciones?.bono || d.bonos || d.bono || 0)
    const subsidio = parseNum(d.percepciones?.subsidio_al_empleo || d.subsidio_al_empleo || d.subsidio || 0)
    
    // Total de percepciones - buscar en múltiples lugares
    const totalPercepciones = parseNum(
      d.percepciones?.total_ingresos ||
      d.percepciones?.total_percepciones ||
      d.percepciones?.total ||
      d.total_ingresos || 
      d.total_percepciones ||
      d.ingresos ||
      d.bruto ||
      d.sueldo_bruto ||
      (sueldo + propinas + bonos + subsidio)
    )
    
    // Total de deducciones - buscar en múltiples lugares
    const totalDeducciones = parseNum(
      d.deducciones?.total_deducciones ||
      d.deducciones?.total ||
      d.total_deducciones ||
      d.descuentos ||
      d.total_descuentos ||
      0
    )
    
    // Total depositado - buscar en múltiples lugares
    let totalDepositado = parseNum(
      d.montos_finales?.total_depositado ||
      d.montos_finales?.neto ||
      d.montos_finales?.total ||
      d.total_depositado ||
      d.neto ||
      d.sueldo_neto ||
      d.pago_neto ||
      d.total_a_pagar ||
      d.liquido ||
      0
    )
    
    // Si no encontramos el depositado pero tenemos percepciones y deducciones, calcularlo
    if (totalDepositado === 0 && totalPercepciones > 0) {
      totalDepositado = totalPercepciones - totalDeducciones
    }

    return {
      sueldo,
      propinas,
      bonos,
      subsidio,
      totalPercepciones,
      totalDeducciones,
      totalDepositado,
    }
  }

  // Helper para extraer datos de INE de diferentes estructuras
  const extractINEData = (d: Record<string, any>, nombreCliente: string) => {
    // Función auxiliar para obtener string o N/A
    const getStr = (...vals: any[]): string => {
      for (const val of vals) {
        if (val !== null && val !== undefined && val !== '') {
          return String(val)
        }
      }
      return 'N/A'
    }

    return {
      nombre: getStr(d.nombre_completo, d.nombre, d.titular, nombreCliente),
      curp: getStr(d.curp, d.CURP, d.Curp),
      claveElector: getStr(d.clave_de_elector, d.clave_elector, d.claveElector, d.clave_electoral, d.ClaveElector),
      fechaNacimiento: getStr(d.fecha_nacimiento, d.fechaNacimiento, d.nacimiento, d.fecha_nac),
      domicilio: getStr(d.domicilio, d.direccion, d.address, d.ubicacion),
      estado: getStr(d.estado, d.entidad, d.entidad_federativa),
      municipio: getStr(d.municipio, d.ciudad, d.localidad),
      vigencia: getStr(d.vigencia, d.validez, d.vencimiento, d.fecha_vigencia),
      seccion: getStr(d.seccion, d.seccion_electoral),
      sexo: getStr(d.sexo, d.genero),
      emision: getStr(d.emision, d.fecha_emision, d.año_registro),
    }
  }

  // Exportar a Excel estructurado
  const exportToExcel = () => {
    // Crear CSV con múltiples secciones
    let csvContent = ''
    
    // Encabezado general
    csvContent += `REPORTE DE DOCUMENTOS - ${clientName || 'CLIENTE'}\n`
    csvContent += `Fecha de generación: ${new Date().toLocaleDateString('es-MX')}\n`
    csvContent += `Total de documentos: ${documents.length}\n\n`

    // ANÁLISIS DE INGRESOS al inicio si está disponible
    if (payrollAnalysis) {
      csvContent += '=== RESUMEN DE INGRESOS ===\n'
      csvContent += 'Concepto,Valor\n'
      csvContent += `"Nóminas analizadas","${payrollAnalysis.cantidad_nominas}"\n`
      csvContent += `"Promedio por periodo","$${payrollAnalysis.promedio_ingreso.toFixed(2)}"\n`
      csvContent += `"Periodicidad","${payrollAnalysis.periodicidad}"\n`
      csvContent += `"Descripción","${payrollAnalysis.descripcion_periodicidad}"\n`
      csvContent += `"Ingreso mensual estimado","$${payrollAnalysis.ingreso_mensual_estimado.toFixed(2)}"\n`
      csvContent += '\n'
    }

    // Por cada categoría
    for (const [category, docs] of Object.entries(categorizedDocs)) {
      csvContent += `\n=== ${category.replace(/_/g, ' ')} (${docs.length} documento${docs.length > 1 ? 's' : ''}) ===\n\n`
      
      if (category.includes('NOMINA')) {
        // Headers específicos para nóminas
        csvContent += 'Fecha,No. Empleado,Puesto,Periodo,Sueldo,Propinas,Bonos,Total Percepciones,Total Deducciones,Total Depositado\n'
        
        let sumPercepciones = 0
        let sumDeducciones = 0
        let sumDepositado = 0
        
        for (const doc of docs) {
          const d = doc.datos_extraidos
          const nominaData = extractNominaData(d)
          
          sumPercepciones += nominaData.totalPercepciones
          sumDeducciones += nominaData.totalDeducciones
          sumDepositado += nominaData.totalDepositado
          
          csvContent += [
            doc.fecha_documento.replace(/_/g, '/'),
            d.numero_empleado || d.no_empleado || '',
            d.puesto || '',
            d.periodo_pago || d.periodo || '',
            nominaData.sueldo.toFixed(2),
            nominaData.propinas.toFixed(2),
            nominaData.bonos.toFixed(2),
            nominaData.totalPercepciones.toFixed(2),
            nominaData.totalDeducciones.toFixed(2),
            nominaData.totalDepositado.toFixed(2),
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
        }
        
        // Totales para nóminas
        csvContent += `"TOTAL","","","","","","","$${sumPercepciones.toFixed(2)}","$${sumDeducciones.toFixed(2)}","$${sumDepositado.toFixed(2)}"\n`
        
      } else if (category.includes('INE') || category.includes('IDENTIFICACION')) {
        csvContent += 'Nombre,CURP,Clave Elector,Fecha Nacimiento,Sexo,Domicilio,Estado,Municipio,Seccion,Vigencia,Emision\n'
        for (const doc of docs) {
          const ineData = extractINEData(doc.datos_extraidos, doc.nombre_cliente)
          csvContent += [
            ineData.nombre,
            ineData.curp,
            ineData.claveElector,
            ineData.fechaNacimiento,
            ineData.sexo === 'H' ? 'Hombre' : ineData.sexo === 'M' ? 'Mujer' : ineData.sexo,
            ineData.domicilio,
            ineData.estado,
            ineData.municipio,
            ineData.seccion,
            ineData.vigencia,
            ineData.emision,
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
        }
      } else {
        // Genérico - mostrar todos los campos importantes
        // Primero, recopilar todos los campos únicos de todos los documentos
        const allKeys = new Set<string>()
        for (const doc of docs) {
          Object.keys(doc.datos_extraidos).forEach(key => {
            if (typeof doc.datos_extraidos[key] !== 'object') {
              allKeys.add(key)
            }
          })
        }
        
        const keysList = ['Cliente', 'Fecha', ...Array.from(allKeys).slice(0, 8)]
        csvContent += keysList.join(',') + '\n'
        
        for (const doc of docs) {
          const values = [
            doc.nombre_cliente,
            doc.fecha_documento.replace(/_/g, '/'),
            ...Array.from(allKeys).slice(0, 8).map(key => {
              const val = doc.datos_extraidos[key]
              return val !== undefined && val !== null ? String(val) : ''
            })
          ]
          csvContent += values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
        }
      }
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${clientName || 'REPORTE'}_DOCUMENTOS_${new Date().toISOString().split('T')[0]}.xls`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Exportar a PDF
  const exportToPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 20

    // Título principal
    doc.setFontSize(20)
    doc.setTextColor(16, 185, 129)
    doc.setFont('helvetica', 'bold')
    doc.text('REPORTE DE DOCUMENTOS', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Nombre del cliente
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(clientName || 'CLIENTE', pageWidth / 2, yPos, { align: 'center' })
    yPos += 8

    // Fecha de generación
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX')}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 12

    // Línea separadora
    doc.setDrawColor(200, 200, 200)
    doc.line(14, yPos, pageWidth - 14, yPos)
    yPos += 10

    // Resumen general
    doc.setFontSize(11)
    doc.setTextColor(0)
    doc.text(`Total de documentos: ${documents.length}`, 14, yPos)
    yPos += 12

    // ANÁLISIS DE INGRESOS al inicio si está disponible
    if (payrollAnalysis) {
      if (yPos > 240) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(16, 185, 129)
      doc.setFont('helvetica', 'bold')
      doc.text('RESUMEN DE INGRESOS', 14, yPos)
      yPos += 8

      autoTable(doc, {
        startY: yPos,
        head: [['Concepto', 'Valor']],
        body: [
          ['Nóminas analizadas', String(payrollAnalysis.cantidad_nominas)],
          ['Promedio por periodo', `$${payrollAnalysis.promedio_ingreso.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
          ['Periodicidad', payrollAnalysis.periodicidad],
          ['Descripción', payrollAnalysis.descripcion_periodicidad],
          ['Ingreso mensual estimado', `$${payrollAnalysis.ingreso_mensual_estimado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 10 },
        columnStyles: { 
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { halign: 'right', cellWidth: 60 }
        },
        margin: { left: 14, right: 14 },
      })

      yPos = (doc as any).lastAutoTable.finalY + 15
    }

    // Por categoría
    for (const [category, docs] of Object.entries(categorizedDocs)) {
      // Verificar si necesitamos nueva página
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      // Título de categoría con color según tipo
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      
      // Colores por categoría
      if (category.includes('NOMINA')) {
        doc.setTextColor(16, 185, 129) // Verde
      } else if (category.includes('INE') || category.includes('IDENTIFICACION')) {
        doc.setTextColor(59, 130, 246) // Azul
      } else if (category.includes('CFE')) {
        doc.setTextColor(245, 158, 11) // Amarillo
      } else {
        doc.setTextColor(107, 114, 128) // Gris
      }

      // Texto sin emoji
      const categoryLabel = category.replace(/_/g, ' ')
      doc.text(`${categoryLabel} (${docs.length} documento${docs.length > 1 ? 's' : ''})`, 14, yPos)
      yPos += 8

      // Línea separadora de categoría
      doc.setDrawColor(220, 220, 220)
      doc.line(14, yPos, pageWidth - 14, yPos)
      yPos += 6

      if (category.includes('NOMINA')) {
        // Usar el helper para extraer datos de nómina correctamente
        const tableData = docs.map(d => {
          const nominaData = extractNominaData(d.datos_extraidos)
          return [
            d.fecha_documento.replace(/_/g, '/'),
            d.datos_extraidos.puesto || 'N/A',
            (d.datos_extraidos.periodo_pago || d.datos_extraidos.periodo || 'N/A').substring(0, 30),
            `$${nominaData.totalPercepciones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
            `$${nominaData.totalDeducciones.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
            `$${nominaData.totalDepositado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          ]
        })

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha', 'Puesto', 'Periodo', 'Ingresos', 'Deducciones', 'Neto']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 8 },
          columnStyles: {
            2: { cellWidth: 50 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right', fontStyle: 'bold' },
          },
        })

        yPos = (doc as any).lastAutoTable.finalY + 12
      } else if (category.includes('INE') || category.includes('IDENTIFICACION')) {
        for (const d of docs) {
          // Usar el helper para extraer datos de INE correctamente
          const ineData = extractINEData(d.datos_extraidos, d.nombre_cliente)
          
          // Verificar espacio antes de agregar tabla
          if (yPos > 240) {
            doc.addPage()
            yPos = 20
          }

          autoTable(doc, {
            startY: yPos,
            head: [['Campo', 'Valor']],
            body: [
              ['Nombre', ineData.nombre.substring(0, 60)],
              ['CURP', ineData.curp],
              ['Clave Elector', ineData.claveElector],
              ['Fecha Nacimiento', ineData.fechaNacimiento],
              ['Sexo', ineData.sexo === 'H' ? 'Hombre' : ineData.sexo === 'M' ? 'Mujer' : ineData.sexo],
              ['Domicilio', ineData.domicilio.substring(0, 100)],
              ['Estado', ineData.estado],
              ['Municipio', ineData.municipio],
              ['Sección', ineData.seccion],
              ['Vigencia', ineData.vigencia],
              ['Emisión', ineData.emision],
            ].filter(([, v]) => v !== 'N/A'),
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8 },
            columnStyles: { 
              0: { fontStyle: 'bold', cellWidth: 45 },
              1: { cellWidth: 120 }
            },
          })
          yPos = (doc as any).lastAutoTable.finalY + 12
        }
      } else {
        // Para otros documentos, mostrar los datos más importantes sin truncar
        const tableData = docs.map(d => {
          // Extraer los primeros 4 campos que no sean objetos
          const importantData = Object.entries(d.datos_extraidos)
            .filter(([, v]) => typeof v !== 'object')
            .slice(0, 4)
            .map(([k, v]) => `${formatLabel(k)}: ${v}`)
            .join(' | ')
          
          return [
            d.nombre_cliente.substring(0, 35),
            d.fecha_documento.replace(/_/g, '/'),
            importantData.substring(0, 80),
          ]
        })

        autoTable(doc, {
          startY: yPos,
          head: [['Cliente', 'Fecha', 'Datos Principales']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [107, 114, 128], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 8 },
          columnStyles: {
            2: { cellWidth: 100 },
          },
        })

        yPos = (doc as any).lastAutoTable.finalY + 12
      }
    }

    doc.save(`${clientName || 'REPORTE'}_DOCUMENTOS_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  // Copiar JSON formateado
  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(documents, null, 2))
  }

  return (
    <div className="document-viewer">
      {/* Header con estadísticas */}
      <div className="viewer-header">
        <div className="viewer-title">
          <h3>📊 Visor de Documentos</h3>
          <span className="doc-count">{documents.length} documentos procesados</span>
        </div>
        
        <div className="export-buttons">
          <button className="export-btn excel" onClick={exportToExcel}>
            📊 Excel
          </button>
          <button className="export-btn pdf" onClick={exportToPDF}>
            📕 PDF
          </button>
          <button className="export-btn json" onClick={copyJSON}>
            📋 JSON
          </button>
        </div>
      </div>

      {/* Filtros por categoría */}
      <div className="category-filters">
        <button 
          className={`category-btn ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          📁 Todos ({documents.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            style={{ '--cat-color': DOCUMENT_COLORS[cat] || '#6b7280' } as React.CSSProperties}
          >
            {DOCUMENT_ICONS[cat] || '📄'} {cat.replace(/_/g, ' ')} ({categorizedDocs[cat].length})
          </button>
        ))}
      </div>

      {/* Lista de documentos */}
      <div className="documents-list">
        {filteredDocs.map((doc, index) => (
          <div 
            key={index} 
            className={`document-card ${expandedDoc === index ? 'expanded' : ''}`}
            style={{ '--doc-color': DOCUMENT_COLORS[doc.tipo_documento] || '#6b7280' } as React.CSSProperties}
          >
            <div 
              className="card-header"
              onClick={() => setExpandedDoc(expandedDoc === index ? null : index)}
            >
              <div className="card-icon">
                {DOCUMENT_ICONS[doc.tipo_documento] || '📄'}
              </div>
              <div className="card-info">
                <span className="card-type">{doc.tipo_documento.replace(/_/g, ' ')}</span>
                <span className="card-date">📅 {doc.fecha_documento}</span>
              </div>
              <div className="card-summary">
                {doc.tipo_documento.includes('NOMINA') && (() => {
                  const nominaData = extractNominaData(doc.datos_extraidos)
                  return nominaData.totalDepositado > 0 ? (
                    <span className="amount-badge">
                      💰 ${nominaData.totalDepositado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  ) : null
                })()}
                {doc.tipo_documento.includes('NOMINA') && doc.datos_extraidos.puesto && (
                  <span className="info-badge">{doc.datos_extraidos.puesto}</span>
                )}
                {(doc.tipo_documento.includes('INE') || doc.tipo_documento.includes('IDENTIFICACION')) && (() => {
                  const ineData = extractINEData(doc.datos_extraidos, doc.nombre_cliente)
                  return ineData.curp !== 'N/A' ? (
                    <span className="info-badge">{ineData.curp}</span>
                  ) : null
                })()}
              </div>
              <div className="expand-icon">
                {expandedDoc === index ? '▼' : '▶'}
              </div>
            </div>
            
            {expandedDoc === index && (
              <div className="card-content">
                <div className="file-info">
                  <span>📁 Original: {doc.nombre_archivo_original}</span>
                  <span>📝 Nuevo: {doc.nombre_archivo_nuevo}</span>
                </div>
                {renderExtractedData(doc.datos_extraidos, doc.tipo_documento)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente auxiliar para items de datos
function DataItem({ label, value, highlight, negative, success, wide }: { 
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
  success?: boolean
  wide?: boolean
}) {
  return (
    <div className={`data-item ${highlight ? 'highlight' : ''} ${negative ? 'negative' : ''} ${success ? 'success' : ''} ${wide ? 'wide' : ''}`}>
      <span className="data-label">{label}</span>
      <span className="data-value">{value}</span>
    </div>
  )
}

// Función para formatear labels
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim()
}
