import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { assignPilot, getMission, unassignPilot } from '../api/missions'
import { listUsers } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MapView } from '../map/MapView'
import { formatDistance, formatDuration, summarisePlan } from '../planning/missionStats'
import type { Mission } from '../types/mission'
import type { User } from '../types/user'
import './MissionPlanPage.css'
import './MissionsPage.css'

// which pilot the admin is about to assign or unassign, null when no dialog is up
interface PendingChange {
  pilot: User
  assigning: boolean
}

export function MissionPlanPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const [mission, setMission] = useState<Mission | null>(null)
  const [pilots, setPilots] = useState<User[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [working, setWorking] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !id) return
    getMission(id, session.token)
      .then(setMission)
      .catch(() => setLoadError('Could not load mission'))
    listUsers(session.token, 'pilot').then(setPilots).catch(() => setPilots([]))
  }, [session, id])

  const stats = useMemo(() => summarisePlan(mission?.waypoints ?? []), [mission])

  const visiblePilots = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return pilots
    return pilots.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle),
    )
  }, [pilots, search])

  async function handleConfirm(message: string | null) {
    if (!session || !id || !pending) return
    setWorking(true)
    setChangeError(null)
    try {
      const change = pending.assigning ? assignPilot : unassignPilot
      setMission(await change(id, pending.pilot.id, message, session.token))
      setPending(null)
    } catch {
      setChangeError(`Could not ${pending.assigning ? 'assign' : 'unassign'} this pilot`)
    } finally {
      setWorking(false)
    }
  }

  if (loadError) return <p className="auth-error">{loadError}</p>
  if (!mission) return <p className="text-dim">Loading...</p>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{mission.name}</h1>
          <p className="text-dim mono">{mission.status}</p>
        </div>
        <Link className="button" to={`/missions/${mission.id}`}>
          Back to mission
        </Link>
      </div>

      <div className="plan-summary">
        <div>
          <span className="text-dim">Waypoints</span>
          <strong className="mono">{stats.waypointCount}</strong>
        </div>
        <div>
          <span className="text-dim">Distance</span>
          <strong className="mono">{formatDistance(stats.distanceMeters)}</strong>
        </div>
        <div>
          <span className="text-dim">Est. flight time</span>
          <strong className="mono">{formatDuration(stats.durationSeconds)}</strong>
        </div>
        <div>
          <span className="text-dim">Altitude</span>
          <strong className="mono">
            {stats.minAltitude === stats.maxAltitude
              ? `${stats.maxAltitude} m`
              : `${stats.minAltitude}-${stats.maxAltitude} m`}
          </strong>
        </div>
      </div>

      <div className="plan-map">
        <MapView waypoints={mission.waypoints} onMapClick={() => {}} />
      </div>

      <div className="page-header plan-pilots-header">
        <h2>Pilots</h2>
        <input
          className="pilot-search"
          type="search"
          placeholder="Search pilots..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="mission-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visiblePilots.map((pilot) => {
            const assigned = mission.assigned_pilot_ids.includes(pilot.id)
            return (
              <tr key={pilot.id}>
                <td>{pilot.name}</td>
                <td className="mono">{pilot.email}</td>
                <td className="mono text-dim">{assigned ? 'assigned' : 'available'}</td>
                <td className="row-action">
                  <button
                    type="button"
                    onClick={() => {
                      setChangeError(null)
                      setPending({ pilot, assigning: !assigned })
                    }}
                  >
                    {assigned ? 'Unassign' : 'Assign'}
                  </button>
                </td>
              </tr>
            )
          })}
          {visiblePilots.length === 0 && (
            <tr>
              <td colSpan={4} className="text-dim">
                No pilots match that search.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pending && (
        <ConfirmDialog
          title={`${pending.assigning ? 'Assign' : 'Unassign'} ${pending.pilot.name}?`}
          body={`${pending.pilot.name} gets an email with a link to this mission.`}
          confirmLabel={pending.assigning ? 'Assign' : 'Unassign'}
          messageLabel="Message to the pilot"
          messagePlaceholder="Optional note to include in the email"
          busy={working}
          error={changeError}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
