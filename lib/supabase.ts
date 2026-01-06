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
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build time, if env vars are missing, create a client with placeholder values
    // This prevents build errors - the actual client will be created at runtime with correct values
    // Note: This client won't work, but it allows the build to complete
    console.warn('Supabase environment variables not found. Using placeholder client.')
    return createClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase = createSupabaseClient()

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
  inputSizeBytes?: number
): Promise<SkillUsage> {
  const user = await getCurrentUser()
  
  const { data, error } = await supabase
    .from('sr_skill_usage')
    .insert({
      user_id: user?.id,
      skill_id: skillId,
      input_type: inputType,
      input_size_bytes: inputSizeBytes,
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
  errorMessage?: string
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
  
  const { data, error } = await supabase
    .from('sr_skill_usage')
    .update(updateData)
    .eq('id', usageId)
    .select()
    .single()
  
  if (error) throw error
  return data as SkillUsage
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
