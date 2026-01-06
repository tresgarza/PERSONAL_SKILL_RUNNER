'use client'

interface UsageChartProps {
  data: Array<{
    skill_id: string
    skill_name: string
    total_uses: number
    unique_users: number
    total_cost: number
  }>
}

export default function UsageChart({ data }: UsageChartProps) {
  const maxUses = Math.max(...data.map(d => d.total_uses || 0), 1)

  return (
    <div className="usage-chart">
      {data.length === 0 ? (
        <p>No hay datos disponibles</p>
      ) : (
        <div className="usage-bars">
          {data.slice(0, 10).map((item) => (
            <div key={item.skill_id} className="usage-bar-item">
              <div className="usage-bar-label">
                <span>{item.skill_name}</span>
                <span className="usage-count">{item.total_uses}</span>
              </div>
              <div className="usage-bar-container">
                <div
                  className="usage-bar"
                  style={{
                    width: `${((item.total_uses || 0) / maxUses) * 100}%`,
                  }}
                />
              </div>
              <div className="usage-bar-details">
                <span>{item.unique_users} usuarios</span>
                <span>${(item.total_cost || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
