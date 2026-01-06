import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const userId = searchParams.get('user_id')
    const skillId = searchParams.get('skill_id')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar si el usuario es admin
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

    // Construir query de eventos con filtros
    let eventsQuery = supabase
      .from('sr_page_events')
      .select('*', { count: 'exact', head: false })

    if (startDate) {
      eventsQuery = eventsQuery.gte('timestamp', startDate)
    }
    if (endDate) {
      eventsQuery = eventsQuery.lte('timestamp', endDate)
    }
    if (userId) {
      eventsQuery = eventsQuery.eq('user_id', userId)
    }

    // Métricas generales
    const [eventsResult, sessionsResult, skillsResult, costsResult, errorsResult] = await Promise.all([
      // Total de eventos
      eventsQuery.then(r => ({ count: r.count || 0 })),
      
      // Sesiones activas
      supabase
        .from('sr_user_sessions')
        .select('*', { count: 'exact', head: false })
        .is('ended_at', null)
        .then(r => ({ count: r.count || 0 })),
      
      // Skills más usados
      supabase
        .from('sr_skill_usage')
        .select('skill_id, status', { count: 'exact' })
        .then(async (r) => {
          if (skillId) {
            return { data: r.data?.filter(s => s.skill_id === skillId) || [], count: r.count || 0 }
          }
          return r
        }),
      
      // Costos totales
      supabase
        .from('sr_api_costs')
        .select('cost_usd')
        .then(r => ({
          total: r.data?.reduce((sum, c) => sum + (parseFloat(c.cost_usd.toString()) || 0), 0) || 0,
          count: r.data?.length || 0,
        })),
      
      // Errores no resueltos
      supabase
        .from('sr_errors')
        .select('*', { count: 'exact', head: false })
        .eq('resolved', false)
        .then(r => ({ count: r.count || 0 })),
    ])

    // Usar vistas materializadas si están disponibles
    const [dailyMetrics, skillStats, costByModel] = await Promise.all([
      supabase.from('v_daily_metrics').select('*').order('date', { ascending: false }).limit(30),
      supabase.from('v_skill_usage_stats').select('*').order('total_uses', { ascending: false }),
      supabase.from('v_api_costs_by_model').select('*').order('total_cost', { ascending: false }),
    ])

    return NextResponse.json({
      success: true,
      metrics: {
        total_events: eventsResult.count || 0,
        active_sessions: sessionsResult.count || 0,
        total_skill_uses: skillsResult.count || 0,
        total_api_cost: costsResult.total || 0,
        unresolved_errors: errorsResult.count || 0,
      },
      daily_metrics: dailyMetrics.data || [],
      skill_stats: skillStats.data || [],
      cost_by_model: costByModel.data || [],
    })
  } catch (error) {
    console.error('Error in dashboard endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
