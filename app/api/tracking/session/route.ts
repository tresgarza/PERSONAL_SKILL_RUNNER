import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { UserSession } from '../../../../lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, device_type, browser, os, screen_width, screen_height, referrer } = body

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
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

    // Crear sesión
    const { data, error } = await supabase
      .from('sr_user_sessions')
      .insert({
        user_id: userId || null,
        session_id,
        device_type: device_type || 'unknown',
        browser: browser || null,
        os: os || null,
        screen_width: screen_width || null,
        screen_height: screen_height || null,
        referrer: referrer || null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // Si la sesión ya existe, actualizar en lugar de crear
      if (error.code === '23505') { // Unique violation
        const { data: existingSession } = await supabase
          .from('sr_user_sessions')
          .select()
          .eq('session_id', session_id)
          .single()

        return NextResponse.json({
          success: true,
          session: existingSession,
          message: 'Session already exists',
        })
      }

      console.error('Error creating session:', error)
      return NextResponse.json(
        { error: 'Failed to create session', details: error.message },
        { status: 500 }
      )
    }

    // Actualizar contador de sesiones del usuario
    if (userId) {
      try {
        const { error: rpcError } = await supabase.rpc('increment_user_sessions', { user_id: userId })
        if (rpcError) {
          // Si la función no existe, hacer update manual
          const { data: userData } = await supabase
            .from('sr_users')
            .select('total_sessions')
            .eq('id', userId)
            .single()
          
          if (userData) {
            await supabase
              .from('sr_users')
              .update({ total_sessions: (userData.total_sessions || 0) + 1 })
              .eq('id', userId)
          }
        }
      } catch (error) {
        // Si falla, intentar update manual
        const { data: userData } = await supabase
          .from('sr_users')
          .select('total_sessions')
          .eq('id', userId)
          .single()
        
        if (userData) {
          await supabase
            .from('sr_users')
            .update({ total_sessions: (userData.total_sessions || 0) + 1 })
            .eq('id', userId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      session: data,
    })
  } catch (error) {
    console.error('Error in session endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, ended_at } = body

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Actualizar sesión
    const updateData: Partial<UserSession> = {}
    if (ended_at) {
      updateData.ended_at = ended_at
    }

    const { data, error } = await supabase
      .from('sr_user_sessions')
      .update(updateData)
      .eq('session_id', session_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating session:', error)
      return NextResponse.json(
        { error: 'Failed to update session', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session: data,
    })
  } catch (error) {
    console.error('Error in session update endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
