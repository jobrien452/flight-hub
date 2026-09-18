import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import './AuthPage.css'

// the server shuts the door after a run of failed attempts, which is worth
// saying plainly rather than reading as another wrong password
function loginError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong, try again'
  if (err.status === 429) return 'Too many attempts, wait a few minutes and try again'
  if (err.status === 401) return 'Incorrect email or password'
  return 'Something went wrong, try again'
}

export function LoginPage() {
  const [email, setEmail] = useState('')
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
      const session = await login(email, password)
      setSession(session)
      navigate('/missions', { replace: true })
    } catch (err) {
      setError(loginError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
        <Link className="auth-link" to="/request-password-reset">
          Forgot your password?
        </Link>
      </form>
    </div>
  )
}
