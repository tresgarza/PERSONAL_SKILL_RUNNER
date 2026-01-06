'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth-context'
import MetricsCard from '../../components/analytics/MetricsCard'
import UsageChart from '../../components/analytics/UsageChart'
import CostAnalysis from '../../components/analytics/CostAnalysis'
import ErrorTable from '../../components/analytics/ErrorTable'

interface DashboardData {
  metrics: {
    total_events: number
    active_sessions: number
    total_skill_uses: number
    total_api_cost: number
    unresolved_errors: number
  }
  daily_metrics: Array<{
    date: string
    unique_users: number
    unique_sessions: number
    total_events: number
  }>
  skill_stats: Array<{
    skill_id: string
    skill_name: string
    total_uses: number
    unique_users: number
    total_cost: number
  }>
  cost_by_model: Array<{
    provider: string
    model: string
    total_cost: number
    usage_count: number
  }>
}

export default function AnalyticsPage() {
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    if (!user) return

    loadDashboardData()
  }, [user, dateRange])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (dateRange.start) params.append('start_date', dateRange.start)
      if (dateRange.end) params.append('end_date', dateRange.end)

      const response = await fetch(`/api/analytics/dashboard?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (type: string) => {
    try {
      const params = new URLSearchParams()
      params.append('type', type)
      params.append('format', 'csv')
      if (dateRange.start) params.append('start_date', dateRange.start)
      if (dateRange.end) params.append('end_date', dateRange.end)

      const response = await fetch(`/api/analytics/export?${params.toString()}`)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error exporting data: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (!user) {
    return (
      <div className="container">
        <div className="login-container">
          <p>Por favor inicia sesión para ver analytics</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container">
        <div className="login-container">
          <p>No tienes permisos para ver analytics. Se requiere rol de administrador.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <h1>📊 Analytics Dashboard</h1>
        <p>Análisis completo de uso, costos y rendimiento</p>
      </header>

      {/* Filtros de fecha */}
      <div className="analytics-filters">
        <div className="filter-group">
          <label>Fecha inicio:</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Fecha fin:</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <button onClick={() => setDateRange({ start: '', end: '' })}>
            Limpiar filtros
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando datos...</p>
        </div>
      )}

      {error && (
        <div className="error-container">
          <p>❌ Error: {error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Métricas principales */}
          <div className="metrics-grid">
            <MetricsCard
              title="Total Eventos"
              value={data.metrics.total_events.toLocaleString()}
              icon="📊"
              trend={null}
            />
            <MetricsCard
              title="Sesiones Activas"
              value={data.metrics.active_sessions.toString()}
              icon="👥"
              trend={null}
            />
            <MetricsCard
              title="Uso de Skills"
              value={data.metrics.total_skill_uses.toLocaleString()}
              icon="⚡"
              trend={null}
            />
            <MetricsCard
              title="Costo Total API"
              value={`$${data.metrics.total_api_cost.toFixed(2)}`}
              icon="💰"
              trend={null}
            />
            <MetricsCard
              title="Errores Sin Resolver"
              value={data.metrics.unresolved_errors.toString()}
              icon="⚠️"
              trend={null}
            />
          </div>

          {/* Gráficos */}
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Uso de Skills</h3>
              <UsageChart data={data.skill_stats} />
            </div>

            <div className="chart-card">
              <h3>Análisis de Costos</h3>
              <CostAnalysis data={data.cost_by_model} />
            </div>
          </div>

          {/* Tabla de errores */}
          <div className="errors-section">
            <h2>Errores Recientes</h2>
            <ErrorTable />
          </div>

          {/* Exportación */}
          <div className="export-section">
            <h2>Exportar Datos</h2>
            <div className="export-buttons">
              <button onClick={() => handleExport('events')}>
                📊 Exportar Eventos (CSV)
              </button>
              <button onClick={() => handleExport('sessions')}>
                👥 Exportar Sesiones (CSV)
              </button>
              <button onClick={() => handleExport('costs')}>
                💰 Exportar Costos (CSV)
              </button>
              <button onClick={() => handleExport('errors')}>
                ⚠️ Exportar Errores (CSV)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
