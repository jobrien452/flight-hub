import { useEffect, useState } from 'react'
import { getMapToken } from '../api/config'
import { loadSession } from '../auth/session'

export type MapTokenState = 'loading' | 'ready' | 'unavailable'

export interface MapToken {
  token: string | null
  state: MapTokenState
}

// the token is fetched rather than bundled, so a map has a moment where it has
// nothing to draw with. the state says which of the three situations that is
export function useMapToken(): MapToken {
  // read during render, so someone who is not signed in never flashes through
  // a loading state on the way to a map they were never going to get
  const sessionToken = loadSession()?.token ?? null
  const [token, setToken] = useState<string | null>(null)
  const [state, setState] = useState<MapTokenState>(sessionToken ? 'loading' : 'unavailable')

  useEffect(() => {
    if (!sessionToken) return

    let cancelled = false
    getMapToken(sessionToken)
      .then((fetched) => {
        if (cancelled) return
        setToken(fetched || null)
        setState(fetched ? 'ready' : 'unavailable')
      })
      .catch(() => {
        if (!cancelled) setState('unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [sessionToken])

  return { token, state }
}
