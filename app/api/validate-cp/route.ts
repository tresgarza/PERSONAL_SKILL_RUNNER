import { NextRequest, NextResponse } from 'next/server'
import { searchByPostalCode, getColoniasByCP, getLocationByCP, isValidPostalCode } from '@/lib/sepomex'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const cp = searchParams.get('cp')

  if (!cp) {
    return NextResponse.json(
      { error: 'Código postal requerido' },
      { status: 400 }
    )
  }

  // Validar formato (5 dígitos)
  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json(
      { error: 'El código postal debe tener 5 dígitos' },
      { status: 400 }
    )
  }

  try {
    // Verificar si el CP existe
    const existe = isValidPostalCode(cp)
    
    if (!existe) {
      return NextResponse.json({
        cp,
        existe: false,
        mensaje: `El código postal ${cp} no existe en el catálogo oficial de SEPOMEX`
      })
    }

    // Obtener todos los registros para este CP
    const registros = searchByPostalCode(cp)
    
    // Obtener datos de ubicación
    const ubicacion = getLocationByCP(cp)
    
    // Obtener lista de colonias únicas
    const colonias = getColoniasByCP(cp)
    
    // Agrupar por tipo de asentamiento
    const porTipoAsentamiento: Record<string, string[]> = {}
    registros.forEach(r => {
      if (!porTipoAsentamiento[r.tipoAsentamiento]) {
        porTipoAsentamiento[r.tipoAsentamiento] = []
      }
      if (!porTipoAsentamiento[r.tipoAsentamiento].includes(r.colonia)) {
        porTipoAsentamiento[r.tipoAsentamiento].push(r.colonia)
      }
    })

    return NextResponse.json({
      cp,
      existe: true,
      total_registros: registros.length,
      ubicacion: ubicacion || {
        municipio: registros[0]?.municipio || '',
        estado: registros[0]?.estado || '',
        ciudad: registros[0]?.ciudad || ''
      },
      colonias: colonias,
      total_colonias: colonias.length,
      tipos_asentamiento: Object.keys(porTipoAsentamiento),
      colonias_por_tipo: porTipoAsentamiento,
      registros_completos: registros.slice(0, 50) // Limitar a 50 para no sobrecargar
    })
  } catch (error) {
    console.error('Error validando CP:', error)
    return NextResponse.json(
      { error: 'Error al validar el código postal' },
      { status: 500 }
    )
  }
}
