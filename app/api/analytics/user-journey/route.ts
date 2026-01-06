import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const sessionId = searchParams.get('session_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

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

    // Si no es admin y está consultando otro usuario, rechazar
    if (!isAdmin && userId !== currentUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Usar función SQL para obtener journey
    const startDateParam = startDate || null
    const endDateParam = endDate || null

    const { data: journey, error } = await supabase.rpc('get_user_journey', {
      p_user_id: userId,
      p_start_date: startDateParam,
      p_end_date: endDateParam,
    })

    if (error) {
      console.error('Error getting user journey:', error)
      // Fallback: consulta directa
      let query = supabase
        .from('sr_page_events')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true })

      if (sessionId) {
        query = query.eq('session_id', sessionId)
      }
      if (startDate) {
        query = query.gte('timestamp', startDate)
      }
      if (endDate) {
        query = query.lte('timestamp', endDate)
      }

      const { data: events, error: eventsError } = await query

      if (eventsError) {
        return NextResponse.json(
          { error: 'Failed to get user journey', details: eventsError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        journey: events || [],
      })
    }

    // Filtrar por session_id si se proporciona
    let filteredJourney = journey || []
    if (sessionId) {
      filteredJourney = filteredJourney.filter((event: any) => event.session_id === sessionId)
    }

    // Obtener información de sesiones del usuario
    let sessionsQuery = supabase
      .from('sr_user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    if (startDate) {
      sessionsQuery = sessionsQuery.gte('started_at', startDate)
    }
    if (endDate) {
      sessionsQuery = sessionsQuery.lte('started_at', endDate)
    }

    const { data: sessions } = await sessionsQuery

    return NextResponse.json({
      success: true,
      journey: filteredJourney,
      sessions: sessions || [],
      total_events: filteredJourney.length,
      unique_sessions: new Set(filteredJourney.map((e: any) => e.session_id)).size,
    })
  } catch (error) {
    console.error('Error in user-journey endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
