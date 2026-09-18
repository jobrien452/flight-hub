import { useEffect, useState, type ReactNode } from 'react'
import { SIGNED_OUT_EVENT } from '../api/client'
import { AuthContext, type Session } from './context'
import { loadSession, storeSession } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(loadSession)

  // the api clears storage when the server says the session is over, this is
  // what makes the app notice and show the sign in screen
  useEffect(() => {
    function onSignedOut() {
      setSessionState(null)
    }
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

  function setSession(next: Session | null) {
    setSessionState(next)
    storeSession(next)
  }

  return <AuthContext.Provider value={{ session, setSession }}>{children}</AuthContext.Provider>
}
