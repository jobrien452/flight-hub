import { createContext } from 'react'
import type { LoginResponse } from '../types/auth'

export type Session = LoginResponse

export interface AuthContextValue {
  session: Session | null
  setSession: (session: Session | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
