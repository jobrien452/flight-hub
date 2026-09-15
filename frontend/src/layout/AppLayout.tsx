import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
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
