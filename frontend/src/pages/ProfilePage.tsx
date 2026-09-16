import { useEffect, useState } from 'react'
import { createApiToken, listApiTokens, revokeApiToken } from '../api/apiTokens'
import { getMe } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { ApiToken, ApiTokenCreated } from '../types/apiToken'
import type { User } from '../types/user'
import './ProfilePage.css'
import './MissionsPage.css'

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : 'never'
}

export function ProfilePage() {
  const { session } = useAuth()
  const [me, setMe] = useState<User | null>(null)
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  // held only until dismissed, the server will never hand it back again
  const [issued, setIssued] = useState<ApiTokenCreated | null>(null)
  const [revoking, setRevoking] = useState<ApiToken | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!session) return
    getMe(session.token).then(setMe).catch(() => setMe(null))
    listApiTokens(session.token).then(setTokens).catch(() => setTokens([]))
  }, [session])

  async function handleCreate() {
    if (!session || !name.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createApiToken(name.trim(), session.token)
      setIssued(created)
      setTokens((current) => [...current, created])
      setName('')
    } catch {
      setCreateError('Could not create the token')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke() {
    if (!session || !revoking) return
    setWorking(true)
    setRevokeError(null)
    try {
      await revokeApiToken(revoking.id, session.token)
      setTokens((current) => current.filter((t) => t.id !== revoking.id))
      setRevoking(null)
    } catch {
      setRevokeError('Could not revoke the token')
    } finally {
      setWorking(false)
    }
  }

  if (!session) return null

  return (
    <div>
      <div className="page-header">
        <h1>Profile</h1>
      </div>

      <dl className="profile-details">
        <div>
          <dt>Name</dt>
          <dd>{me?.name ?? session.name}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd className="mono">{me?.email ?? '-'}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd className="mono">{me?.role ?? session.role}</dd>
        </div>
      </dl>

      <div className="page-header profile-tokens-header">
        <h2>API tokens</h2>
      </div>
      <p className="text-dim profile-hint">
        Use a token as a bearer credential to call the API outside the browser. It carries the
        same permissions as your account.
      </p>

      {issued && (
        <div className="token-issued">
          <strong>Copy your new token now.</strong>
          <p className="text-dim">
            This is the only time it will be shown. If you lose it, revoke it and make another.
          </p>
          <code className="mono">{issued.token}</code>
          <button type="button" className="button" onClick={() => setIssued(null)}>
            Done
          </button>
        </div>
      )}

      <div className="token-create">
        <label>
          Token name
          <input
            value={name}
            placeholder="CI pipeline"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          disabled={!name.trim() || creating}
          onClick={handleCreate}
        >
          {creating ? 'Creating...' : 'Create token'}
        </button>
      </div>
      {createError && <p className="auth-error">{createError}</p>}

      {tokens.length === 0 ? (
        <p className="text-dim">No API tokens yet.</p>
      ) : (
        <table className="mission-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Token</th>
              <th>Created</th>
              <th>Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id}>
                <td>{token.name}</td>
                <td className="mono text-dim">{token.prefix}...</td>
                <td className="mono">{formatDate(token.created_at)}</td>
                <td className="mono">{formatDate(token.last_used_at)}</td>
                <td className="row-action">
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeError(null)
                      setRevoking(token)
                    }}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {revoking && (
        <ConfirmDialog
          title={`Revoke ${revoking.name}?`}
          body="Anything using this token will stop working immediately. This cannot be undone."
          confirmLabel="Revoke"
          danger
          busy={working}
          error={revokeError}
          onConfirm={handleRevoke}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  )
}
