import { createContext, useContext, useState, type ReactNode } from 'react'
import type { LoginResponse } from '../types/auth'

type Session = LoginResponse

interface AuthContextValue {
  session: Session | null
  setSession: (session: Session | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'flyby.session'

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(loadSession)

  function setSession(next: Session | null) {
    setSessionState(next)
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return <AuthContext.Provider value={{ session, setSession }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
