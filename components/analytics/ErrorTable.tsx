'use client'

import { useState, useEffect } from 'react'

interface ErrorLog {
  id: string
  error_type: string
  error_message: string
  page_path: string
  created_at: string
  resolved: boolean
}

export default function ErrorTable() {
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadErrors()
  }, [])

  const loadErrors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/analytics/export?type=errors&format=json&limit=20')
      if (!response.ok) throw new Error('Failed to load errors')
      
      const result = await response.json()
      setErrors(result.data || [])
    } catch (error) {
      console.error('Error loading errors:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="error-table-loading">Cargando errores...</div>
  }

  if (errors.length === 0) {
    return <div className="error-table-empty">No hay errores registrados</div>
  }

  return (
    <div className="error-table">
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Mensaje</th>
            <th>Página</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error) => (
            <tr key={error.id} className={error.resolved ? 'resolved' : 'unresolved'}>
              <td>{error.error_type}</td>
              <td className="error-message-cell">
                {error.error_message.length > 100
                  ? `${error.error_message.substring(0, 100)}...`
                  : error.error_message}
              </td>
              <td>{error.page_path}</td>
              <td>{new Date(error.created_at).toLocaleString()}</td>
              <td>
                <span className={`error-status ${error.resolved ? 'resolved' : 'unresolved'}`}>
                  {error.resolved ? '✅ Resuelto' : '⚠️ Pendiente'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
