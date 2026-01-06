import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const exportType = searchParams.get('type') || 'events' // 'events', 'sessions', 'costs', 'errors'
    const format = searchParams.get('format') || 'csv' // 'csv', 'json'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const userId = searchParams.get('user_id')
    const skillId = searchParams.get('skill_id')

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

    let data: any[] = []
    let filename = 'export'

    switch (exportType) {
      case 'events': {
        let query = supabase
          .from('sr_page_events')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10000) // Límite para evitar timeouts

        if (startDate) query = query.gte('timestamp', startDate)
        if (endDate) query = query.lte('timestamp', endDate)
        if (userId) query = query.eq('user_id', userId)

        const { data: events } = await query
        data = events || []
        filename = `events_${new Date().toISOString().split('T')[0]}.${format}`
        break
      }

      case 'sessions': {
        let query = supabase
          .from('sr_user_sessions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(10000)

        if (startDate) query = query.gte('started_at', startDate)
        if (endDate) query = query.lte('started_at', endDate)
        if (userId) query = query.eq('user_id', userId)

        const { data: sessions } = await query
        data = sessions || []
        filename = `sessions_${new Date().toISOString().split('T')[0]}.${format}`
        break
      }

      case 'costs': {
        let query = supabase
          .from('sr_api_costs')
          .select(`
            *,
            sr_skill_usage(skill_id, user_id)
          `)
          .order('created_at', { ascending: false })
          .limit(10000)

        if (startDate) query = query.gte('created_at', startDate)
        if (endDate) query = query.lte('created_at', endDate)
        if (skillId) {
          query = query.eq('sr_skill_usage.skill_id', skillId)
        }

        const { data: costs } = await query
        data = costs || []
        filename = `costs_${new Date().toISOString().split('T')[0]}.${format}`
        break
      }

      case 'errors': {
        let query = supabase
          .from('sr_errors')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10000)

        if (startDate) query = query.gte('created_at', startDate)
        if (endDate) query = query.lte('created_at', endDate)
        if (userId) query = query.eq('user_id', userId)

        const { data: errors } = await query
        data = errors || []
        filename = `errors_${new Date().toISOString().split('T')[0]}.${format}`
        break
      }

      default:
        return NextResponse.json(
          { error: 'Invalid export type' },
          { status: 400 }
        )
    }

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data,
        filename,
      })
    } else {
      // Convertir a CSV
      if (data.length === 0) {
        return NextResponse.json(
          { error: 'No data to export' },
          { status: 404 }
        )
      }

      // Obtener todas las claves únicas de todos los objetos
      const allKeys = new Set<string>()
      data.forEach(item => {
        Object.keys(item).forEach(key => allKeys.add(key))
      })

      const headers = Array.from(allKeys)
      
      // Crear CSV
      const csvRows = [
        headers.join(','), // Header row
        ...data.map(row => {
          return headers.map(header => {
            const value = row[header]
            if (value === null || value === undefined) return ''
            if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""')
            return String(value).replace(/"/g, '""').replace(/,/g, ';')
          }).map(v => `"${v}"`).join(',')
        }),
      ]

      const csv = csvRows.join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }
  } catch (error) {
    console.error('Error in export endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
