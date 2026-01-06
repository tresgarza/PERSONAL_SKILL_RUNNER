import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fileName = searchParams.get('file')

    if (!fileName) {
      return NextResponse.json({ error: 'Nombre de archivo requerido' }, { status: 400 })
    }

    // Validar que el archivo esté en el directorio tmp
    // En Vercel/serverless, usar /tmp (único directorio escribible)
    const tmpDir = '/tmp'
    const filePath = path.join(tmpDir, fileName)
    
    // Validar que el archivo existe y está en el directorio correcto
    if (!fs.existsSync(filePath) || !filePath.startsWith(tmpDir)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    // Eliminar el archivo después de leerlo (opcional, para limpiar)
    // fs.unlinkSync(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Error descargando ZIP:', error)
    return NextResponse.json(
      { error: 'Error al descargar el archivo ZIP' },
      { status: 500 }
    )
  }
}
