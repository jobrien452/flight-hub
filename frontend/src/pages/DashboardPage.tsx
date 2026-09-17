import { useEffect, useState } from 'react'
import { getStats } from '../api/stats'
import { useAuth } from '../auth/useAuth'
import type { DashboardStats } from '../types/stats'
import './DashboardPage.css'
import './MissionsPage.css'

interface BreakdownProps {
  title: string
  counts: Record<string, number>
}

// one measure, one hue, every row labelled. the bar is there for the comparison,
// the number next to it is there for the exact value
function Breakdown({ title, counts }: BreakdownProps) {
  const rows = Object.entries(counts)
  const biggest = Math.max(...rows.map(([, count]) => count), 1)

  return (
    <section className="breakdown">
      <h2>{title}</h2>
      <table>
        <tbody>
          {rows.map(([label, count]) => (
            <tr key={label}>
              <th scope="row">{label.replace('_', ' ')}</th>
              <td className="breakdown-track">
                <span
                  role="presentation"
                  className="breakdown-bar"
                  style={{ width: `${(count / biggest) * 100}%` }}
                />
              </td>
              <td className="breakdown-count mono">{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function DashboardPage() {
  const { session } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    if (!session || !isAdmin) return
    getStats(session.token)
      .then(setStats)
      .catch(() => setError('Could not load the dashboard'))
  }, [session, isAdmin])

  if (!session) return null

  if (!isAdmin) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p className="text-dim">The dashboard is available to admins only.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {!error && !stats && <p className="text-dim">Loading...</p>}

      {stats && (
        <>
          <div className="plan-summary">
            <div>
              <span className="text-dim">Missions</span>
              <strong className="mono">{stats.missions_total}</strong>
            </div>
            <div>
              <span className="text-dim">Completed</span>
              <strong className="mono">{stats.missions_by_status.completed ?? 0}</strong>
            </div>
            <div>
              <span className="text-dim">Fleet hours</span>
              <strong className="mono">{stats.fleet_flight_hours}</strong>
            </div>
            <div>
              <span className="text-dim">Flights flown</span>
              <strong className="mono">{stats.fleet_missions_flown}</strong>
            </div>
            <div>
              <span className="text-dim">Drones</span>
              <strong className="mono">{stats.drones_total}</strong>
            </div>
          </div>

          <div className="dashboard-breakdowns">
            <Breakdown title="Missions by status" counts={stats.missions_by_status} />
            <Breakdown title="Fleet by status" counts={stats.drones_by_status} />
          </div>

          <h2>Pilots</h2>
          <table className="mission-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Missions assigned</th>
                <th>Reports filed</th>
                <th>Flight hours</th>
              </tr>
            </thead>
            <tbody>
              {stats.pilots.map((pilot) => (
                <tr key={pilot.pilot_id}>
                  <td>{pilot.name}</td>
                  <td className="mono">{pilot.email}</td>
                  <td className="mono">{pilot.missions_assigned}</td>
                  <td className="mono">{pilot.reports_submitted}</td>
                  <td className="mono">{pilot.flight_hours}</td>
                </tr>
              ))}
              {stats.pilots.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-dim">
                    No pilots yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
