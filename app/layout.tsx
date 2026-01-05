import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Skill Runner - Ejecuta Claude Skills',
  description: 'Herramienta simple para ejecutar Claude Skills',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
