import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { acceptInvite } from '../api/auth'
import { useAuth } from '../auth/useAuth'
import './AuthPage.css'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { setSession } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const session = await acceptInvite(token, password)
      setSession(session)
      navigate('/missions', { replace: true })
    } catch {
      setError('That invite link is invalid or expired')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <h1>Set your password</h1>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Set password'}
        </button>
      </form>
    </div>
  )
}
