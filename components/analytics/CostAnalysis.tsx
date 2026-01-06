'use client'

interface CostAnalysisProps {
  data: Array<{
    provider: string
    model: string
    total_cost: number
    usage_count: number
  }>
}

export default function CostAnalysis({ data }: CostAnalysisProps) {
  const totalCost = data.reduce((sum, item) => sum + (parseFloat(item.total_cost?.toString()) || 0), 0)

  return (
    <div className="cost-analysis">
      {data.length === 0 ? (
        <p>No hay datos de costos disponibles</p>
      ) : (
        <>
          <div className="cost-summary">
            <div className="cost-total">
              <span className="cost-label">Costo Total:</span>
              <span className="cost-value">${totalCost.toFixed(2)}</span>
            </div>
          </div>
          <div className="cost-breakdown">
            {data.map((item, index) => {
              const cost = parseFloat(item.total_cost?.toString() || '0')
              const percentage = totalCost > 0 ? (cost / totalCost) * 100 : 0
              
              return (
                <div key={`${item.provider}-${item.model}-${index}`} className="cost-item">
                  <div className="cost-item-header">
                    <span className="cost-provider">{item.provider}</span>
                    <span className="cost-model">{item.model}</span>
                  </div>
                  <div className="cost-bar-container">
                    <div
                      className="cost-bar"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="cost-item-details">
                    <span>${cost.toFixed(2)}</span>
                    <span>{item.usage_count} usos</span>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
