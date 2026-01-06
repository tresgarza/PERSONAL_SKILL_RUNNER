import { createClient } from '@supabase/supabase-js'

// Types for our database
export interface User {
  id: string
  email: string
  full_name?: string
  company?: string
  role: 'user' | 'admin' | 'super_admin'
  avatar_url?: string
  created_at: string
  updated_at: string
  last_login?: string
  is_active: boolean
  total_sessions?: number
  last_active_at?: string
  total_api_cost?: number
}

export interface Skill {
  id: string
  name: string
  description?: string
  icon?: string
  category: string
  accepted_files?: string
  placeholder?: string
  is_tested: boolean
  is_active: boolean
  external_link?: string
  skill_reference?: string
  created_at: string
  updated_at: string
}

export interface SkillUsage {
  id: string
  user_id?: string
  skill_id?: string
  session_id?: string
  input_type?: string
  input_size_bytes?: number
  execution_time_ms?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
  created_at: string
  completed_at?: string
  cost_usd?: number
  api_provider?: string
  model_used?: string
}

export interface SkillData {
  id: string
  usage_id?: string
  skill_id?: string
  data_type: string
  data_payload: Record<string, unknown>
  metadata?: Record<string, unknown>
  created_at: string
}

// Supabase client for browser - safe initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  // During build time, create a placeholder client to prevent build errors
  // In runtime, this will fail gracefully and show an error message
  if (typeof window === 'undefined') {
    // Server-side: create placeholder for build
    console.warn('[Build] Supabase env vars not found, using placeholder')
  } else {
    // Client-side: show clear error
    console.error(
      '❌ Supabase configuration error:\n' +
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.\n' +
      'Please configure these in your Vercel project settings.'
    )
  }
}

// Create client - will use placeholder values if env vars are missing
// This allows build to complete, but runtime will fail if vars aren't set
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
)

// Helper functions
export async function signUp(email: string, password: string, fullName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })
  
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Skill functions
export async function getSkills(activeOnly = false) {
  let query = supabase.from('sr_skills').select('*')
  
  if (activeOnly) {
    query = query.eq('is_active', true)
  }
  
  const { data, error } = await query.order('category').order('name')
  
  if (error) throw error
  return data as Skill[]
}

export async function getTestedSkills() {
  const { data, error } = await supabase
    .from('sr_skills')
    .select('*')
    .eq('is_tested', true)
    .eq('is_active', true)
    .order('category')
    .order('name')
  
  if (error) throw error
  return data as Skill[]
}

// Usage tracking functions
export async function trackSkillUsage(
  skillId: string,
  inputType?: string,
  inputSizeBytes?: number,
  sessionId?: string
): Promise<SkillUsage> {
  const user = await getCurrentUser()
  
  // Obtener session_id del storage si no se proporciona
  let finalSessionId = sessionId
  if (!finalSessionId && typeof window !== 'undefined') {
    finalSessionId = sessionStorage.getItem('tracking_session_id') || undefined
  }
  
  const { data, error } = await supabase
    .from('sr_skill_usage')
    .insert({
      user_id: user?.id,
      skill_id: skillId,
      input_type: inputType,
      input_size_bytes: inputSizeBytes,
      session_id: finalSessionId,
      status: 'pending',
    })
    .select()
    .single()
  
  if (error) throw error
  return data as SkillUsage
}

export async function updateSkillUsage(
  usageId: string,
  status: 'processing' | 'completed' | 'failed',
  executionTimeMs?: number,
  errorMessage?: string,
  apiCost?: {
    provider: 'anthropic' | 'openai' | 'google' | 'other'
    model: string
    inputTokens: number
    outputTokens: number
  }
) {
  const updateData: Partial<SkillUsage> = { status }
  
  if (executionTimeMs !== undefined) {
    updateData.execution_time_ms = executionTimeMs
  }
  
  if (errorMessage) {
    updateData.error_message = errorMessage
  }
  
  if (status === 'completed' || status === 'failed') {
    updateData.completed_at = new Date().toISOString()
  }

  // Si se proporciona información de API, calcular y guardar costo
  if (apiCost && status === 'completed') {
    try {
      const cost = await calculateAndSaveApiCost(usageId, apiCost)
      updateData.cost_usd = cost.cost_usd
      updateData.api_provider = apiCost.provider
      updateData.model_used = apiCost.model
    } catch (error) {
      console.error('Error calculating API cost:', error)
      // Continuar sin costo si falla el cálculo
    }
  }
  
  const { data, error } = await supabase
    .from('sr_skill_usage')
    .update(updateData)
    .eq('id', usageId)
    .select()
    .single()
  
  if (error) throw error
  return data as SkillUsage
}

// Función helper para calcular y guardar costo de API
export async function calculateAndSaveApiCost(
  usageId: string,
  apiInfo: {
    provider: 'anthropic' | 'openai' | 'google' | 'other'
    model: string
    inputTokens: number
    outputTokens: number
  }
): Promise<ApiCost> {
  // Calcular costo usando función SQL
  let { data: costData, error: costError } = await supabase.rpc('calculate_api_cost', {
    p_provider: apiInfo.provider,
    p_model: apiInfo.model,
    p_input_tokens: apiInfo.inputTokens,
    p_output_tokens: apiInfo.outputTokens,
  })

  if (costError) {
    console.error('Error calculating cost:', costError)
    // Fallback: cálculo manual básico (solo Anthropic)
    let cost = 0
    if (apiInfo.provider === 'anthropic') {
      // Precios aproximados por 1K tokens
      const inputPrice = 0.003
      const outputPrice = 0.015
      cost = (apiInfo.inputTokens / 1000) * inputPrice + (apiInfo.outputTokens / 1000) * outputPrice
    }
    costData = cost
  }

  const totalTokens = apiInfo.inputTokens + apiInfo.outputTokens
  const costUsd = typeof costData === 'number' ? costData : parseFloat(costData?.toString() || '0')

  // Guardar en sr_api_costs
  const { data: apiCost, error: insertError } = await supabase
    .from('sr_api_costs')
    .insert({
      usage_id: usageId,
      provider: apiInfo.provider,
      model: apiInfo.model,
      input_tokens: apiInfo.inputTokens,
      output_tokens: apiInfo.outputTokens,
      total_tokens: totalTokens,
      cost_usd: costUsd,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error saving API cost:', insertError)
    throw insertError
  }

  // Actualizar total_api_cost del usuario
  const { data: usageData } = await supabase
    .from('sr_skill_usage')
    .select('user_id')
    .eq('id', usageId)
    .single()

  if (usageData?.user_id) {
    try {
      // Leer el valor actual
      const { data: userData } = await supabase
        .from('sr_users')
        .select('total_api_cost')
        .eq('id', usageData.user_id)
        .single()

      const currentCost = parseFloat(userData?.total_api_cost?.toString() || '0')
      const newCost = currentCost + costUsd

      await supabase
        .from('sr_users')
        .update({
          total_api_cost: newCost,
        })
        .eq('id', usageData.user_id)
    } catch (err) {
      console.error('Error updating user total cost:', err)
    }
  }

  return apiCost as ApiCost
}

// Data collection functions
export async function saveSkillData(
  usageId: string,
  skillId: string,
  dataType: string,
  dataPayload: Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('sr_skill_data')
    .insert({
      usage_id: usageId,
      skill_id: skillId,
      data_type: dataType,
      data_payload: dataPayload,
      metadata,
    })
    .select()
    .single()
  
  if (error) throw error
  return data as SkillData
}

// Get usage statistics
export async function getUsageStats(skillId?: string) {
  let query = supabase
    .from('sr_skill_usage')
    .select('skill_id, status, execution_time_ms')
  
  if (skillId) {
    query = query.eq('skill_id', skillId)
  }
  
  const { data, error } = await query
  
  if (error) throw error
  return data
}

// ============================================
// Tracking Types
// ============================================

export interface PageEvent {
  id: string
  user_id?: string
  session_id: string
  event_type: 'click' | 'navigation' | 'form_submit' | 'download' | 'view' | 'scroll' | 'hover' | 'focus' | 'blur' | 'custom'
  event_name: string
  page_path: string
  element_id?: string
  element_type?: string
  element_text?: string
  metadata?: Record<string, unknown>
  timestamp: string
  user_agent?: string
  ip_address?: string
  created_at: string
}

export interface UserSession {
  id: string
  user_id?: string
  session_id: string
  started_at: string
  ended_at?: string
  duration_seconds?: number
  page_views: number
  events_count: number
  referrer?: string
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  browser?: string
  os?: string
  screen_width?: number
  screen_height?: number
  created_at: string
  updated_at: string
}

export interface ApiCost {
  id: string
  usage_id?: string
  provider: 'anthropic' | 'openai' | 'google' | 'other'
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  pricing_tier?: string
  created_at: string
}

export interface PerformanceMetric {
  id: string
  user_id?: string
  session_id?: string
  page_path: string
  metric_type: 'page_load' | 'api_response' | 'skill_execution' | 'custom'
  metric_name: string
  value: number
  unit: string
  metadata?: Record<string, unknown>
  timestamp: string
  created_at: string
}

export interface ErrorLog {
  id: string
  user_id?: string
  session_id?: string
  error_type: 'javascript' | 'api' | 'skill_execution' | 'network' | 'validation' | 'other'
  error_message: string
  error_stack?: string
  page_path: string
  user_agent?: string
  metadata?: Record<string, unknown>
  resolved: boolean
  resolved_at?: string
  resolved_by?: string
  created_at: string
}
