/**
 * Auth type definitions for Haichan
 * Centralized types for type safety across auth-related code
 */

/**
 * User object from Blink SDK auth
 */
export interface BlinkUser {
  id: string
  email: string
  displayName?: string
  photoURL?: string
  emailVerified?: boolean
  createdAt?: string
  lastSignInAt?: string
  role?: string
  username?: string
  isAdmin?: number | string
}

/**
 * The auth state object returned by onAuthStateChanged
 */
export interface AuthState {
  user: BlinkUser | null
  isLoading: boolean
  isAuthenticated: boolean
  tokens?: {
    accessToken: string
    refreshToken?: string
  } | null
}

/**
 * Extended user data from the users table
 */
export interface DbUser {
  id: string
  username: string
  email?: string
  displayName?: string
  bitcoinAddress?: string
  publicKey?: string
  totalPowPoints: number
  diamondLevel: number
  isAdmin: string | number
  createdAt: string
  updatedAt: string
  emailVerified: string | number
  lastSignIn: string
  twitterBadgeHolder?: string | number
  hashleScore?: number
  hashleWins?: number
  hashleLosses?: number
  [key: string]: any
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string
  password: string
}

/**
 * Registration payload
 */
export interface RegisterPayload {
  email: string
  password: string
  displayName: string
  metadata?: {
    username: string
    bitcoinAddress?: string
    addressType?: string
    publicKey?: string
    keySalt?: string
    keyHash?: string
    [key: string]: any
  }
}

/**
 * Auth context type
 */
export interface AuthContextType {
  authState: AuthState
  dbUser: DbUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (payload: RegisterPayload) => Promise<BlinkUser | null>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}
