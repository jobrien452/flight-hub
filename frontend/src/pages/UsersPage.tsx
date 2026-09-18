import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users'
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

const ROLE_IS_FOREVER = 'A role is picked once and stays with the account.'

// what removing this one really means, which depends on what they were doing
function removalWarning(user: User): string {
  return user.role === 'pilot'
    ? `${user.name} comes off any missions they are down to fly. The reports they filed stay with those missions as the record of what was flown. This cannot be undone.`
    : `${user.name} is an admin, so the missions and aircraft they own move to you. This cannot be undone.`
}

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
  const [editing, setEditing] = useState<User | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [removing, setRemoving] = useState<User | null>(null)
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

  // the backend is the one that knows, this just saves a round trip on the obvious case
  function takenMessage(err: unknown, fallback: string): string {
    return err instanceof ApiError && err.status === 409
      ? 'That email already has an account'
      : fallback
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
      setActionError(takenMessage(err, 'Could not add this user'))
    } finally {
      setWorking(false)
    }
  }

  function openEdit(user: User) {
    setEditing(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setActionError(null)
  }

  async function handleEdit() {
    if (!session || !editing || !editName.trim() || !editEmail.trim()) return
    setWorking(true)
    setActionError(null)
    try {
      const updated = await updateUser(
        editing.id,
        { name: editName.trim(), email: editEmail.trim() },
        session.token,
      )
      setUsers((current) => (current ?? []).map((u) => (u.id === editing.id ? updated : u)))
      setEditing(null)
    } catch (err) {
      setActionError(takenMessage(err, 'Could not update this user'))
    } finally {
      setWorking(false)
    }
  }

  async function handleRemove() {
    if (!session || !removing) return
    setWorking(true)
    setActionError(null)
    try {
      await deleteUser(removing.id, session.token)
      setUsers((current) => (current ?? []).filter((u) => u.id !== removing.id))
      setRemoving(null)
    } catch {
      setActionError('Could not remove this user')
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
              <th />
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
                <td className="row-action">
                  <button
                    type="button"
                    aria-label={`Edit ${user.name}`}
                    onClick={() => openEdit(user)}
                  >
                    Edit
                  </button>
                  {/* signing yourself out of your own account is not an accident worth allowing */}
                  {user.id !== session.user_id && (
                    <button
                      type="button"
                      className="user-remove"
                      aria-label={`Remove ${user.name}`}
                      onClick={() => setRemoving(user)}
                    >
                      Remove
                    </button>
                  )}
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
              <p className="text-dim">{ROLE_IS_FOREVER}</p>
            </div>
          }
          onConfirm={handleAdd}
          onCancel={closeAdd}
        />
      )}

      {editing && (
        <ConfirmDialog
          title={`Edit ${editing.name}`}
          confirmLabel="Save"
          busy={working}
          error={actionError}
          body={
            <div className="dialog-form">
              <label>
                Name
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </label>
              <p className="text-dim">
                {editing.has_password
                  ? 'A new email is what they sign in with from now on.'
                  : 'Changing this sends the invite again, to the new address.'}
              </p>
              <p className="text-dim">{ROLE_IS_FOREVER}</p>
            </div>
          }
          onConfirm={handleEdit}
          onCancel={() => {
            setEditing(null)
            setActionError(null)
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          body={removalWarning(removing)}
          confirmLabel="Remove"
          danger
          busy={working}
          error={actionError}
          onConfirm={handleRemove}
          onCancel={() => {
            setRemoving(null)
            setActionError(null)
          }}
        />
      )}
    </div>
  )
}
