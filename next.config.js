/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración para Next.js 15
  reactStrictMode: true,
  // Suprimir advertencias de desarrollo sobre searchParams/params
  // Estas advertencias aparecen cuando las herramientas de desarrollo inspeccionan componentes
  // pero no afectan la funcionalidad si no estamos usando estos parámetros
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
}

module.exports = nextConfig
