import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { UserMenu } from './UserMenu'
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
          <NavLink to="/fleet" className={({ isActive }) => (isActive ? 'active' : '')}>
            Fleet
          </NavLink>
          {session?.role === 'admin' && (
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
              Dashboard
            </NavLink>
          )}
          {session?.role === 'admin' && (
            <NavLink to="/api-docs" className={({ isActive }) => (isActive ? 'active' : '')}>
              API
            </NavLink>
          )}
        </nav>
        {session && <UserMenu session={session} onSignOut={() => setSession(null)} />}
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
