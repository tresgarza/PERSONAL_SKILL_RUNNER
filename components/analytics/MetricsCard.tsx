interface MetricsCardProps {
  title: string
  value: string | number
  icon: string
  trend?: {
    value: number
    isPositive: boolean
  } | null
}

export default function MetricsCard({ title, value, icon, trend }: MetricsCardProps) {
  return (
    <div className="metrics-card">
      <div className="metrics-card-header">
        <span className="metrics-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="metrics-value">{value}</div>
      {trend && (
        <div className={`metrics-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  )
}
