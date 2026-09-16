import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import './AppLayout.css'

export function AppLayout() {
  const { session, setSession } = useAuth()

  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">FLYBY / MISSION CONTROL</span>
        <nav className="nav">
          <NavLink to="/missions" className={({ isActive }) => (isActive ? 'active' : '')}>
            Missions
          </NavLink>
          {session && (
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
              Profile
            </NavLink>
          )}
          {session?.role === 'admin' && (
            <NavLink to="/api-docs" className={({ isActive }) => (isActive ? 'active' : '')}>
              API
            </NavLink>
          )}
        </nav>
        {session && (
          <div className="user">
            <span>{session.name}</span>
            <span className="role mono">{session.role}</span>
            <button type="button" onClick={() => setSession(null)}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
