import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { GuardedNavLink } from '../navigation/GuardedNavLink'
import { UserMenu } from './UserMenu'
import './AppLayout.css'

export function AppLayout() {
  const { session, setSession } = useAuth()

  return (
    <div className="shell">
      <header className="topbar">
        <GuardedNavLink to="/" className="wordmark">
          FLYBY / MISSION CONTROL
        </GuardedNavLink>
        <nav className="nav">
          <GuardedNavLink to="/missions" className={({ isActive }) => (isActive ? 'active' : '')}>
            Missions
          </GuardedNavLink>
          <GuardedNavLink to="/fleet" className={({ isActive }) => (isActive ? 'active' : '')}>
            Fleet
          </GuardedNavLink>
          {session?.role === 'admin' && (
            <GuardedNavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
              Dashboard
            </GuardedNavLink>
          )}
          {session?.role === 'admin' && (
            <GuardedNavLink to="/api-docs" className={({ isActive }) => (isActive ? 'active' : '')}>
              API
            </GuardedNavLink>
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
