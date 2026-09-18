import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { createUser, listUsers } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { statusLabel } from '../format/status'
import type { Role } from '../types/auth'
import type { User } from '../types/user'
import './UsersPage.css'
import './MissionsPage.css'

const ROLES: Role[] = ['pilot', 'admin']

// invite hands them a link to pick their own password, password means the admin
// sets one now and the account works straight away
type Access = 'invite' | 'password'

export function UsersPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('pilot')
  const [access, setAccess] = useState<Access>('invite')
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    if (!session || !isAdmin) return
    let cancelled = false
    listUsers(session.token)
      .then((people) => {
        if (!cancelled) setUsers(people)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the people on this account')
      })
    return () => {
      cancelled = true
    }
  }, [session, isAdmin])

  function closeAdd() {
    setAdding(false)
    setName('')
    setEmail('')
    setRole('pilot')
    setAccess('invite')
    setPassword('')
    setActionError(null)
  }

  async function handleAdd() {
    if (!session || !name.trim() || !email.trim()) return
    if (access === 'password' && password.length < 8) {
      setActionError('A password needs at least 8 characters')
      return
    }
    setWorking(true)
    setActionError(null)
    try {
      const created = await createUser(
        {
          name: name.trim(),
          email: email.trim(),
          role,
          ...(access === 'password' ? { password } : {}),
        },
        session.token,
      )
      setUsers((current) => [...(current ?? []), created])
      closeAdd()
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status === 409
          ? 'That email already has an account'
          : 'Could not add this user',
      )
    } finally {
      setWorking(false)
    }
  }

  if (!session) return null

  if (!isAdmin) {
    return (
      <div>
        <h1>Users</h1>
        <p className="text-dim">The people on this account are visible to admins only.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <div className="header-actions">
          <button type="button" className="button" onClick={() => setAdding(true)}>
            Add user
          </button>
        </div>
      </div>

      {loadError && <p className="auth-error">{loadError}</p>}
      {!loadError && users === null && <p className="text-dim">Loading...</p>}
      {users !== null && users.length === 0 && <p className="text-dim">Nobody here yet.</p>}

      {users !== null && users.length > 0 && (
        <table className="mission-table users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td className="mono">{user.email}</td>
                <td>{statusLabel(user.role)}</td>
                <td className={user.has_password ? undefined : 'text-dim'}>
                  {user.has_password ? 'Active' : 'Invite pending'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <ConfirmDialog
          title="Add user"
          confirmLabel="Add user"
          busy={working}
          error={actionError}
          body={
            <div className="dialog-form">
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((option) => (
                    <option key={option} value={option}>
                      {statusLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Access
                <select value={access} onChange={(e) => setAccess(e.target.value as Access)}>
                  <option value="invite">Email an invite link</option>
                  <option value="password">Set a password now</option>
                </select>
              </label>
              {access === 'password' && (
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <p className="text-dim">
                {access === 'invite'
                  ? 'They get a link to set their own password. It is good for seven days.'
                  : 'They can sign in right away with this password, so pass it on yourself.'}
              </p>
              {/* the role is what the account is, changing it later would change who owns what */}
              <p className="text-dim">A role is picked once here and stays with the account.</p>
            </div>
          }
          onConfirm={handleAdd}
          onCancel={closeAdd}
        />
      )}
    </div>
  )
}
