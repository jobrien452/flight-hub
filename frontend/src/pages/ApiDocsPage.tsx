import { useEffect, useRef, useState } from 'react'
import { SwaggerUIBundle } from 'swagger-ui-dist'
import { getOpenApiSpec } from '../api/apiTokens'
import { API_URL } from '../api/client'
import { useAuth } from '../auth/useAuth'
import 'swagger-ui-dist/swagger-ui.css'
import './ApiDocsPage.css'

// the spec route is admin only, so swagger cannot fetch it by url on its own.
// it gets fetched here with the session token and handed over already loaded
export function ApiDocsPage() {
  const { session } = useAuth()
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    if (!session || !isAdmin) return
    let cancelled = false

    getOpenApiSpec(session.token)
      .then((spec) => {
        if (cancelled) return
        SwaggerUIBundle({
          domNode: container.current,
          // fastapi's spec names no server, so swagger would resolve paths
          // against this page and miss the /api prefix nginx proxies on
          spec: { ...spec, servers: [{ url: API_URL }] },
          deepLinking: true,
          tryItOutEnabled: true,
          docExpansion: 'list',
          // so "try it out" calls go out authenticated as the signed in admin
          requestInterceptor: (request) => {
            request.headers.Authorization = `Bearer ${session.token}`
            return request
          },
        })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the API spec')
      })

    return () => {
      cancelled = true
    }
  }, [session, isAdmin])

  if (!session) return null

  if (!isAdmin) {
    return (
      <div>
        <h1>API</h1>
        <p className="text-dim">The API reference is available to admins only.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>API</h1>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <p className="text-dim api-docs-hint">
        Calls made from here are signed with your current session. To call the API from elsewhere,
        create a token on your profile.
      </p>
      <div className="api-docs" ref={container} />
    </div>
  )
}
