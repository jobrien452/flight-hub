import { useState, type ReactNode } from 'react'
import { AuthContext, type Session } from './context'
import { loadSession, storeSession } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(loadSession)

  function setSession(next: Session | null) {
    setSessionState(next)
    storeSession(next)
  }

  return <AuthContext.Provider value={{ session, setSession }}>{children}</AuthContext.Provider>
}
