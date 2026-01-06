import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { PerformanceMonitor } from '../components/PerformanceMonitor'

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
      <body>
        <Providers>
          <PerformanceMonitor />
          {children}
        </Providers>
      </body>
    </html>
  )
}
