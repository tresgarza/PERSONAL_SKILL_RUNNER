import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ErrorLog } from '../../../../lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      error_type,
      error_message,
      error_stack,
      page_path,
      metadata = {},
      session_id,
    } = body

    if (!error_type || !error_message || !page_path) {
      return NextResponse.json(
        { error: 'error_type, error_message, and page_path are required' },
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

    // Extraer user_agent del metadata si está presente
    const userAgent = metadata.user_agent || request.headers.get('user-agent') || null

    // Insertar error
    const { data, error } = await supabase
      .from('sr_errors')
      .insert({
        user_id: userId || null,
        session_id: session_id || null,
        error_type,
        error_message,
        error_stack: error_stack || null,
        page_path,
        user_agent: userAgent,
        metadata: {
          ...metadata,
          user_agent: undefined, // Ya lo tenemos en su propia columna
        },
        resolved: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting error log:', error)
      return NextResponse.json(
        { error: 'Failed to insert error log', details: error.message },
        { status: 500 }
      )
    }

    // Opcional: Enviar notificación para errores críticos
    if (error_type === 'api' || error_type === 'skill_execution') {
      // Aquí podrías integrar con un servicio de notificaciones
      // Por ejemplo, enviar email o Slack notification
    }

    return NextResponse.json({
      success: true,
      error_log: data,
    })
  } catch (error) {
    console.error('Error in error tracking endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
