import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PageEvent } from '../../../../lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { events } = await request.json()

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Events array is required' },
        { status: 400 }
      )
    }

    // Crear cliente con service role para bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener user_id del header si está disponible
    const authHeader = request.headers.get('authorization')
    let userId: string | undefined

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    // Preparar eventos para inserción
    const eventsToInsert = events.map((event: Omit<PageEvent, 'id' | 'created_at'>) => ({
      user_id: userId || event.user_id || null,
      session_id: event.session_id,
      event_type: event.event_type,
      event_name: event.event_name,
      page_path: event.page_path,
      element_id: event.element_id || null,
      element_type: event.element_type || null,
      element_text: event.element_text || null,
      metadata: event.metadata || {},
      timestamp: event.timestamp || new Date().toISOString(),
      user_agent: event.user_agent || request.headers.get('user-agent') || null,
      // No incluir ip_address por privacidad, o hashearlo
    }))

    // Insertar eventos en batch
    const { data, error } = await supabase
      .from('sr_page_events')
      .insert(eventsToInsert)
      .select()

    if (error) {
      console.error('Error inserting events:', error)
      return NextResponse.json(
        { error: 'Failed to insert events', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length || 0,
    })
  } catch (error) {
    console.error('Error in tracking event endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
