'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true
    
    // Timeout para evitar que se quede colgado
    const timeoutId = setTimeout(() => {
      if (mounted) {
        setLoading(false)
      }
    }, 5000) // 5 segundos timeout

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return
        clearTimeout(timeoutId)
        
        // Error handling silencioso
        
        setSession(session)
        setUser(session?.user ?? null)
        checkAdminStatus(session?.user?.id)
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        clearTimeout(timeoutId)
        setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        clearTimeout(timeoutId)
        setSession(session)
        setUser(session?.user ?? null)
        checkAdminStatus(session?.user?.id)
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  async function checkAdminStatus(userId?: string) {
    if (!userId) {
      console.log('🔐 checkAdminStatus: No userId provided')
      setIsAdmin(false)
      return
    }

    try {
      console.log('🔐 checkAdminStatus: Checking role for userId:', userId)
      const { data, error } = await supabase
        .from('sr_users')
        .select('role')
        .eq('id', userId)
        .single()

      console.log('🔐 checkAdminStatus: Query result - data:', JSON.stringify(data), 'error:', JSON.stringify(error))
      
      if (error || !data) {
        console.error('🔐 checkAdminStatus: Error fetching role:', JSON.stringify(error))
        setIsAdmin(false)
        return
      }

      const role = (data as { role: string }).role
      const adminStatus = role === 'admin' || role === 'super_admin'
      console.log('🔐 checkAdminStatus: isAdmin =', adminStatus, '(role:', role, ')')
      setIsAdmin(adminStatus)
    } catch (err) {
      console.error('🔐 checkAdminStatus: Exception:', err)
      setIsAdmin(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  async function signUp(email: string, password: string, fullName?: string) {
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

    // Create user profile in sr_users
    if (data.user) {
      const { error: profileError } = await supabase
        .from('sr_users')
        .insert({
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName,
          role: 'user',
        })
      
      if (profileError) {
        console.error('Error creating user profile:', profileError)
      }
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
