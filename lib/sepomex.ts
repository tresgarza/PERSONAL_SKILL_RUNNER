import fs from 'fs'
import path from 'path'

export interface SepomexRecord {
  codigoPostal: string      // d_codigo
  colonia: string           // d_asenta
  tipoAsentamiento: string  // d_tipo_asenta
  municipio: string         // D_mnpio
  estado: string            // d_estado
  ciudad: string            // d_ciudad
}

// Cache para evitar leer el archivo múltiples veces
let sepomexCache: SepomexRecord[] | null = null

// Cargar catálogo de SEPOMEX desde el archivo TXT
export function loadSepomexCatalog(): SepomexRecord[] {
  if (sepomexCache) {
    return sepomexCache
  }

  const filePath = path.join(process.cwd(), 'data', 'CPdescarga.txt')
  
  if (!fs.existsSync(filePath)) {
    console.warn('Archivo SEPOMEX no encontrado:', filePath)
    return []
  }

  const content = fs.readFileSync(filePath, 'latin1') // Encoding para caracteres especiales
  const lines = content.split('\n')
  
  const records: SepomexRecord[] = []
  
  // Saltar línea 0 (aviso legal) y línea 1 (headers)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const parts = line.split('|')
    if (parts.length >= 6) {
      records.push({
        codigoPostal: parts[0],
        colonia: parts[1],
        tipoAsentamiento: parts[2],
        municipio: parts[3],
        estado: parts[4],
        ciudad: parts[5] || ''
      })
    }
  }
  
  sepomexCache = records
  console.log(`SEPOMEX: ${records.length} registros cargados`)
  return records
}

// Buscar información por código postal
export function searchByPostalCode(cp: string): SepomexRecord[] {
  const catalog = loadSepomexCatalog()
  return catalog.filter(r => r.codigoPostal === cp)
}

// Validar si un código postal existe
export function isValidPostalCode(cp: string): boolean {
  const results = searchByPostalCode(cp)
  return results.length > 0
}

// Buscar colonias por código postal
export function getColoniasByCP(cp: string): string[] {
  const results = searchByPostalCode(cp)
  return [...new Set(results.map(r => r.colonia))]
}

// Obtener municipio y estado por código postal
export function getLocationByCP(cp: string): { municipio: string; estado: string; ciudad: string } | null {
  const results = searchByPostalCode(cp)
  if (results.length === 0) return null
  
  return {
    municipio: results[0].municipio,
    estado: results[0].estado,
    ciudad: results[0].ciudad
  }
}

// Normalizar texto para comparación
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Validar dirección completa contra SEPOMEX
export function validateAddressWithSepomex(address: {
  codigoPostal?: string
  colonia?: string
  municipio?: string
  estado?: string
}): {
  isValid: boolean
  cpExists: boolean
  coloniaMatch: boolean
  municipioMatch: boolean
  estadoMatch: boolean
  suggestions: string[]
  officialData: SepomexRecord | null
} {
  const result = {
    isValid: false,
    cpExists: false,
    coloniaMatch: false,
    municipioMatch: false,
    estadoMatch: false,
    suggestions: [] as string[],
    officialData: null as SepomexRecord | null
  }

  if (!address.codigoPostal) {
    result.suggestions.push('No se proporcionó código postal')
    return result
  }

  const sepomexRecords = searchByPostalCode(address.codigoPostal)
  
  if (sepomexRecords.length === 0) {
    result.suggestions.push(`El CP ${address.codigoPostal} no existe en el catálogo de SEPOMEX`)
    return result
  }

  result.cpExists = true
  result.officialData = sepomexRecords[0]

  // Verificar colonia
  if (address.colonia) {
    const normalizedColonia = normalizeText(address.colonia)
    const matchingColonia = sepomexRecords.find(r => 
      normalizeText(r.colonia).includes(normalizedColonia) ||
      normalizedColonia.includes(normalizeText(r.colonia))
    )
    
    if (matchingColonia) {
      result.coloniaMatch = true
      result.officialData = matchingColonia
    } else {
      const colonias = sepomexRecords.map(r => r.colonia)
      result.suggestions.push(`La colonia "${address.colonia}" no corresponde al CP ${address.codigoPostal}. Colonias válidas: ${colonias.slice(0, 5).join(', ')}${colonias.length > 5 ? '...' : ''}`)
    }
  }

  // Verificar municipio
  if (address.municipio) {
    const normalizedMunicipio = normalizeText(address.municipio)
    const officialMunicipio = normalizeText(sepomexRecords[0].municipio)
    
    if (officialMunicipio.includes(normalizedMunicipio) || normalizedMunicipio.includes(officialMunicipio)) {
      result.municipioMatch = true
    } else {
      result.suggestions.push(`El municipio debería ser "${sepomexRecords[0].municipio}", no "${address.municipio}"`)
    }
  }

  // Verificar estado
  if (address.estado) {
    const normalizedEstado = normalizeText(address.estado)
    const officialEstado = normalizeText(sepomexRecords[0].estado)
    
    // También verificar abreviaturas comunes
    const estadoAbbrevs: Record<string, string[]> = {
      'nuevo leon': ['nl', 'n.l.'],
      'ciudad de mexico': ['cdmx', 'df', 'd.f.'],
      'estado de mexico': ['edomex', 'mex'],
      // Agregar más según sea necesario
    }
    
    const isMatch = officialEstado.includes(normalizedEstado) || 
                    normalizedEstado.includes(officialEstado) ||
                    (estadoAbbrevs[officialEstado]?.some(abbr => normalizedEstado.includes(abbr)))
    
    if (isMatch) {
      result.estadoMatch = true
    } else {
      result.suggestions.push(`El estado debería ser "${sepomexRecords[0].estado}", no "${address.estado}"`)
    }
  }

  // Determinar si la dirección es válida en general
  result.isValid = result.cpExists && (result.coloniaMatch || !address.colonia)

  return result
}

// Buscar código postal por colonia y municipio (búsqueda inversa)
export function searchPostalCode(colonia: string, municipio?: string, estado?: string): SepomexRecord[] {
  const catalog = loadSepomexCatalog()
  const normalizedColonia = normalizeText(colonia)
  
  let results = catalog.filter(r => {
    const rColonia = normalizeText(r.colonia)
    return rColonia.includes(normalizedColonia) || normalizedColonia.includes(rColonia)
  })

  if (municipio) {
    const normalizedMunicipio = normalizeText(municipio)
    results = results.filter(r => {
      const rMunicipio = normalizeText(r.municipio)
      return rMunicipio.includes(normalizedMunicipio) || normalizedMunicipio.includes(rMunicipio)
    })
  }

  if (estado) {
    const normalizedEstado = normalizeText(estado)
    results = results.filter(r => {
      const rEstado = normalizeText(r.estado)
      return rEstado.includes(normalizedEstado) || normalizedEstado.includes(rEstado)
    })
  }

  return results.slice(0, 10) // Limitar resultados
}
