import type { Session } from './context'

const STORAGE_KEY = 'flyby.session'

// kept out of AuthContext so things that need the stored session without being
// inside the provider, like the map token fetch, have one place to read it from
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function storeSession(session: Session | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // a browser with storage blocked still works for this session, it just
    // will not be signed in on the next page load
  }
}
