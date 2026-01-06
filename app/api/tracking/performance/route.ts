import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PerformanceMetric } from '../../../../lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      page_path,
      metric_type,
      metric_name,
      value,
      unit = 'ms',
      metadata = {},
      session_id,
    } = body

    if (!page_path || !metric_type || !metric_name || value === undefined) {
      return NextResponse.json(
        { error: 'page_path, metric_type, metric_name, and value are required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener user_id del header si está disponible
    const authHeader = request.headers.get('authorization')
    let userId: string | undefined

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    // Insertar métrica
    const { data, error } = await supabase
      .from('sr_performance_metrics')
      .insert({
        user_id: userId || null,
        session_id: session_id || null,
        page_path,
        metric_type,
        metric_name,
        value: parseFloat(value),
        unit,
        metadata,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting performance metric:', error)
      return NextResponse.json(
        { error: 'Failed to insert performance metric', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      metric: data,
    })
  } catch (error) {
    console.error('Error in performance endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
