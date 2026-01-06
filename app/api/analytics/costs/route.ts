import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const periodDays = parseInt(searchParams.get('period_days') || '30', 10)
    const groupBy = searchParams.get('group_by') || 'day'
    const userId = searchParams.get('user_id')
    const skillId = searchParams.get('skill_id')
    const provider = searchParams.get('provider')
    const model = searchParams.get('model')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar autorización
    const authHeader = request.headers.get('authorization')
    let isAdmin = false
    let currentUserId: string | undefined

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      currentUserId = user?.id

      if (user) {
        const { data: userData } = await supabase
          .from('sr_users')
          .select('role')
          .eq('id', user.id)
          .single()

        isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin'
      }
    }

    // Si no es admin y está filtrando por otro usuario, rechazar
    if (!isAdmin && userId && userId !== currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Usar función SQL para obtener resumen de costos
    const { data: costSummary, error } = await supabase.rpc('get_cost_summary', {
      p_period_days: periodDays,
      p_group_by: groupBy,
    })

    if (error) {
      console.error('Error getting cost summary:', error)
      // Fallback: consulta directa
      let query = supabase
        .from('sr_api_costs')
        .select('*')
        .gte('created_at', new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString())

      if (provider) {
        query = query.eq('provider', provider)
      }
      if (model) {
        query = query.eq('model', model)
      }

      const { data: costs, error: costsError } = await query

      if (costsError) {
        return NextResponse.json(
          { error: 'Failed to get cost summary', details: costsError.message },
          { status: 500 }
        )
      }

      // Agrupar manualmente
      const grouped = costs?.reduce((acc: any, cost: any) => {
        const key = groupBy === 'provider' ? cost.provider : `${cost.provider}_${cost.model}`
        if (!acc[key]) {
          acc[key] = {
            provider: cost.provider,
            model: cost.model,
            total_tokens: 0,
            total_cost: 0,
            usage_count: 0,
          }
        }
        acc[key].total_tokens += cost.total_tokens || 0
        acc[key].total_cost += parseFloat(cost.cost_usd.toString()) || 0
        acc[key].usage_count += 1
        return acc
      }, {})

      return NextResponse.json({
        success: true,
        summary: Object.values(grouped || {}),
        total_cost: Object.values(grouped || {}).reduce((sum: number, item: any) => sum + item.total_cost, 0),
      })
    }

    // Filtrar por usuario si se proporciona
    let filteredSummary = costSummary || []
    if (userId) {
      // Necesitamos hacer join con skill_usage para filtrar por usuario
      const { data: userCosts } = await supabase
        .from('sr_api_costs')
        .select(`
          *,
          sr_skill_usage!inner(user_id)
        `)
        .eq('sr_skill_usage.user_id', userId)
        .gte('created_at', new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString())

      // Agrupar según groupBy
      const grouped = userCosts?.reduce((acc: any, cost: any) => {
        const key = groupBy === 'provider' ? cost.provider : `${cost.provider}_${cost.model}`
        if (!acc[key]) {
          acc[key] = {
            period_start: cost.created_at,
            provider: cost.provider,
            model: cost.model,
            total_tokens: 0,
            total_cost: 0,
            usage_count: 0,
          }
        }
        acc[key].total_tokens += cost.total_tokens || 0
        acc[key].total_cost += parseFloat(cost.cost_usd.toString()) || 0
        acc[key].usage_count += 1
        return acc
      }, {})

      filteredSummary = Object.values(grouped || {})
    }

    // Filtrar por skill si se proporciona
    if (skillId) {
      const { data: skillCosts } = await supabase
        .from('sr_api_costs')
        .select(`
          *,
          sr_skill_usage!inner(skill_id)
        `)
        .eq('sr_skill_usage.skill_id', skillId)
        .gte('created_at', new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString())

      const grouped = skillCosts?.reduce((acc: any, cost: any) => {
        const key = groupBy === 'provider' ? cost.provider : `${cost.provider}_${cost.model}`
        if (!acc[key]) {
          acc[key] = {
            period_start: cost.created_at,
            provider: cost.provider,
            model: cost.model,
            total_tokens: 0,
            total_cost: 0,
            usage_count: 0,
          }
        }
        acc[key].total_tokens += cost.total_tokens || 0
        acc[key].total_cost += parseFloat(cost.cost_usd.toString()) || 0
        acc[key].usage_count += 1
        return acc
      }, {})

      filteredSummary = Object.values(grouped || {})
    }

    // Calcular totales
    const totalCost = filteredSummary.reduce((sum: number, item: any) => sum + (parseFloat(item.total_cost?.toString()) || 0), 0)
    const totalTokens = filteredSummary.reduce((sum: number, item: any) => sum + (item.total_tokens || 0), 0)

    return NextResponse.json({
      success: true,
      summary: filteredSummary,
      totals: {
        total_cost: totalCost,
        total_tokens: totalTokens,
        usage_count: filteredSummary.reduce((sum: number, item: any) => sum + (item.usage_count || 0), 0),
      },
      period_days: periodDays,
      group_by: groupBy,
    })
  } catch (error) {
    console.error('Error in costs endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
