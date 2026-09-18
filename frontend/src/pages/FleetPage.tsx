import { useEffect, useState } from 'react'
import { createDrone, deleteDrone, listDrones, updateDrone } from '../api/drones'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AIRCRAFT } from '../fleet/aircraft'
import { statusLabel } from '../format/status'
import type { Drone, DroneStatus } from '../types/drone'
import './FleetPage.css'
import './MissionsPage.css'

const STATUSES: DroneStatus[] = ['available', 'in_flight', 'maintenance', 'retired']

// what removing this one really means, which depends on whether it has flown
function removalWarning(drone: Drone): string {
  const flown = drone.missions_flown > 0 || drone.flight_hours > 0
  const history = flown
    ? `${drone.name} has ${drone.missions_flown} missions and ${drone.flight_hours} hours on it, so it is retired rather than deleted. It leaves the fleet and the aircraft pickers, the missions it flew keep it, and you can bring it back by setting a status on it again.`
    : `${drone.name} has never flown, so there is nothing to keep and it goes for good. This cannot be undone.`
  const booking = drone.booked_on
    ? ' The mission holding it loses its aircraft and goes back to draft, and its pilots are told.'
    : ''
  return history + booking
}

export function FleetPage() {
  const { session } = useAuth()
  const [drones, setDrones] = useState<Drone[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [editing, setEditing] = useState<Drone | null>(null)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState<DroneStatus>('available')
  const [removing, setRemoving] = useState<Drone | null>(null)
  const [showRetired, setShowRetired] = useState(false)
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    if (!session) return
    let cancelled = false
    listDrones(session.token, showRetired)
      .then((fleet) => {
        if (!cancelled) setDrones(fleet)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the fleet')
      })
    return () => {
      cancelled = true
    }
  }, [session, showRetired])

  function closeAdd() {
    setAdding(false)
    setName('')
    setModel('')
    setSerial('')
    setStreamUrl('')
    setActionError(null)
  }

  async function handleAdd() {
    if (!session || !name.trim()) return
    setWorking(true)
    setActionError(null)
    try {
      const drone = await createDrone(
        { name: name.trim(), model, serial, stream_url: streamUrl.trim() },
        session.token,
      )
      setDrones((current) => [...(current ?? []), drone])
      closeAdd()
    } catch {
      setActionError('Could not add this drone')
    } finally {
      setWorking(false)
    }
  }

  function openEdit(drone: Drone) {
    setEditing(drone)
    setEditName(drone.name)
    setEditStatus(drone.status)
    setActionError(null)
  }

  async function handleEdit() {
    if (!session || !editing || !editName.trim()) return
    setWorking(true)
    setActionError(null)
    try {
      const updated = await updateDrone(
        editing.id,
        { name: editName.trim(), status: editStatus },
        session.token,
      )
      setDrones((current) => (current ?? []).map((d) => (d.id === editing.id ? updated : d)))
      setEditing(null)
    } catch {
      setActionError('Could not update this drone')
    } finally {
      setWorking(false)
    }
  }

  async function handleRemove() {
    if (!session || !removing) return
    setWorking(true)
    setActionError(null)
    try {
      await deleteDrone(removing.id, session.token)
      setDrones((current) => (current ?? []).filter((d) => d.id !== removing.id))
      setRemoving(null)
    } catch {
      setActionError('Could not remove this drone')
    } finally {
      setWorking(false)
    }
  }

  if (!session) return null

  return (
    <div>
      <div className="page-header">
        <h1>Fleet</h1>
        {isAdmin && (
          <div className="header-actions">
            <label className="fleet-toggle">
              <input
                type="checkbox"
                checked={showRetired}
                onChange={(e) => setShowRetired(e.target.checked)}
              />
              Show retired
            </label>
            <button type="button" className="button" onClick={() => setAdding(true)}>
              Add drone
            </button>
          </div>
        )}
      </div>

      {loadError && <p className="auth-error">{loadError}</p>}
      {!removing && actionError && <p className="auth-error">{actionError}</p>}
      {!loadError && drones === null && <p className="text-dim">Loading...</p>}
      {drones !== null && drones.length === 0 && (
        <p className="text-dim">
          {isAdmin ? 'No drones yet.' : 'No drones are booked on your missions.'}
        </p>
      )}

      {drones !== null && drones.length > 0 && (
        <table className="mission-table fleet-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Model</th>
              <th>Serial</th>
              <th>Status</th>
              <th>Flight hours</th>
              <th>Missions</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {drones.map((drone) => (
              <tr key={drone.id}>
                <td>{drone.name}</td>
                <td>{drone.model}</td>
                <td className="mono">{drone.serial}</td>
                <td>{statusLabel(drone.status)}</td>
                <td className="mono">{drone.flight_hours}</td>
                <td className="mono">{drone.missions_flown}</td>
                {isAdmin && (
                  <td className="row-action">
                    <button
                      type="button"
                      aria-label={`Edit ${drone.name}`}
                      onClick={() => openEdit(drone)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="fleet-remove"
                      aria-label={`Remove ${drone.name}`}
                      onClick={() => setRemoving(drone)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <ConfirmDialog
          title="Add drone"
          confirmLabel="Add drone"
          busy={working}
          error={actionError}
          body={
            <div className="fleet-form">
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Model
                <input
                  list="flyby-aircraft"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                <datalist id="flyby-aircraft">
                  {AIRCRAFT.map((aircraft) => (
                    <option key={aircraft.model} value={aircraft.model} />
                  ))}
                </datalist>
              </label>
              <label>
                Serial
                <input value={serial} onChange={(e) => setSerial(e.target.value)} />
              </label>
              <label>
                Video stream
                <input
                  placeholder="rtsp://192.168.35.1:8554/eo"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                />
              </label>
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
            <div className="fleet-form">
              <label>
                Name
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </label>
              <label>
                Status
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as DroneStatus)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              {/* the two the system sets itself, an admin only pulls one out or puts it back */}
              <p className="text-dim">
                Available and in flight follow the missions this aircraft is booked on.
              </p>
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
