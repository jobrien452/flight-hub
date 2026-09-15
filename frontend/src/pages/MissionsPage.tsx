import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMissions } from '../api/missions'
import { useAuth } from '../auth/useAuth'
import type { Mission } from '../types/mission'
import './MissionsPage.css'

export function MissionsPage() {
  const { session } = useAuth()
  const [missions, setMissions] = useState<Mission[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    listMissions(session.token)
      .then(setMissions)
      .catch(() => setError('Could not load missions'))
  }, [session])

  if (!session) return null

  return (
    <div>
      <div className="page-header">
        <h1>Missions</h1>
        {session.role === 'admin' && (
          <Link className="button" to="/missions/new">
            New Mission
          </Link>
        )}
      </div>

      {error && <p className="auth-error">{error}</p>}
      {!error && missions === null && <p className="text-dim">Loading...</p>}
      {missions !== null && missions.length === 0 && (
        <p className="text-dim">No missions yet.</p>
      )}
      {missions !== null && missions.length > 0 && (
        <table className="mission-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Pilots</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {missions.map((mission) => (
              <tr key={mission.id}>
                <td>
                  <Link to={`/missions/${mission.id}`}>{mission.name}</Link>
                </td>
                <td className="mono">{mission.status}</td>
                <td>{mission.assigned_pilot_ids.length}</td>
                <td className="mono">{new Date(mission.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
