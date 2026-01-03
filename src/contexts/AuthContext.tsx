/**
 * Auth Context Provider
 * Centralizes authentication state and logic to prevent duplication
 * and memory leaks from multiple onAuthStateChanged subscriptions
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import db from '../lib/db-client'
import { AuthState, DbUser, LoginCredentials, RegisterPayload, AuthContextType } from '../types/auth'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    tokens: null
  })
  const [dbUser, setDbUser] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Single subscription to auth state - runs only once
  useEffect(() => {
    let mounted = true
    // Ref to track the latest user ID we are trying to load
    let currentUserId: string | null = null;

    console.log('[AuthContext] Subscribing to auth state changes')
    const unsubscribe = db.auth.onAuthStateChanged((state) => {
      if (!mounted) return
      
      console.log('[AuthContext] Auth state changed:', {
        hasUser: !!state.user,
        isLoading: state.isLoading,
        isAuthenticated: state.isAuthenticated
      })

      setAuthState({
        user: state.user,
        isLoading: state.isLoading,
        isAuthenticated: state.isAuthenticated,
        tokens: state.tokens || null
      })

      // Load full user data if authenticated
      if (state.user?.id) {
        currentUserId = state.user.id
        loadDbUser(state.user.id, () => mounted && currentUserId === state.user?.id)
      } else {
        currentUserId = null
        setDbUser(null)
      }

      setLoading(state.isLoading)
    })

    // Cleanup subscription on unmount
    return () => {
      console.log('[AuthContext] Unsubscribing from auth state changes')
      mounted = false
      unsubscribe()
    }
  }, []) // Empty deps - subscribe only once on mount

  /**
   * Load extended user data from database
   */
  const loadDbUser = useCallback(async (userId: string, shouldContinue?: () => boolean) => {
    try {
      // Basic check
      if (shouldContinue && !shouldContinue()) return

      const users = await db.db.users.list({
        where: { id: userId },
        limit: 1
      })

      // Check again after async op
      if (shouldContinue && !shouldContinue()) return

      if (users && users.length > 0) {
        console.log('[AuthContext] Loaded db user:', { id: userId })
        setDbUser(users[0])
      }
    } catch (error) {
      // Check again
      if (shouldContinue && !shouldContinue()) return

      console.error('[AuthContext] Failed to load user data:', error)
      // Continue even if db load fails - auth still valid
    }
  }, [])

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      console.log('[AuthContext] Signing in with email:', email)
      await db.auth.signInWithEmail(email, password)
      console.log('[AuthContext] Sign in successful')
    } catch (error) {
      console.error('[AuthContext] Sign in failed:', error)
      throw error
    }
  }, [])

  /**
   * Sign up with email and password
   */
  const signUp = useCallback(async (payload: RegisterPayload) => {
    try {
      console.log('[AuthContext] Signing up with email:', payload.email)
      const user = await db.auth.signUp({
        email: payload.email,
        password: payload.password,
        displayName: payload.displayName,
        metadata: payload.metadata
      })
      console.log('[AuthContext] Sign up successful:', { id: user?.id })
      return user || null
    } catch (error) {
      console.error('[AuthContext] Sign up failed:', error)
      throw error
    }
  }, [])

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      console.log('[AuthContext] Signing out')
      await db.auth.signOut()
      console.log('[AuthContext] Sign out successful')
    } catch (error) {
      console.error('[AuthContext] Sign out failed:', error)
      throw error
    }
  }, [])

  const value: AuthContextType = {
    authState,
    dbUser,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: authState.isAuthenticated
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 * Ensures it's used within AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export default AuthContext