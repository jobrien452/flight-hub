import { useEffect, useState } from 'react'
import { createDrone, deleteDrone, listDrones, updateDrone } from '../api/drones'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AIRCRAFT } from '../fleet/aircraft'
import type { Drone, DroneStatus } from '../types/drone'
import './FleetPage.css'
import './MissionsPage.css'

const STATUSES: DroneStatus[] = ['available', 'in_flight', 'maintenance', 'retired']

export function FleetPage() {
  const { session } = useAuth()
  const [drones, setDrones] = useState<Drone[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [removing, setRemoving] = useState<Drone | null>(null)
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isAdmin = session?.role === 'admin'

  useEffect(() => {
    if (!session) return
    listDrones(session.token)
      .then(setDrones)
      .catch(() => setLoadError('Could not load the fleet'))
  }, [session])

  function closeAdd() {
    setAdding(false)
    setName('')
    setModel('')
    setSerial('')
    setActionError(null)
  }

  async function handleAdd() {
    if (!session || !name.trim()) return
    setWorking(true)
    setActionError(null)
    try {
      const drone = await createDrone({ name: name.trim(), model, serial }, session.token)
      setDrones((current) => [...(current ?? []), drone])
      closeAdd()
    } catch {
      setActionError('Could not add this drone')
    } finally {
      setWorking(false)
    }
  }

  async function handleStatus(drone: Drone, status: DroneStatus) {
    if (!session) return
    setActionError(null)
    try {
      const updated = await updateDrone(drone.id, { status }, session.token)
      setDrones((current) => (current ?? []).map((d) => (d.id === drone.id ? updated : d)))
    } catch {
      setActionError('Could not update this drone')
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
      // the only refusal the server makes here is an aircraft that is still up
      setActionError('This drone is out on a mission and cannot be removed yet.')
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
          <button type="button" className="button" onClick={() => setAdding(true)}>
            Add drone
          </button>
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
                <td>
                  {isAdmin ? (
                    <select
                      aria-label={`Status for ${drone.name}`}
                      value={drone.status}
                      onChange={(e) => handleStatus(drone, e.target.value as DroneStatus)}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="mono">{drone.status}</span>
                  )}
                </td>
                <td className="mono">{drone.flight_hours}</td>
                <td className="mono">{drone.missions_flown}</td>
                {isAdmin && (
                  <td className="row-action">
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
            </div>
          }
          onConfirm={handleAdd}
          onCancel={closeAdd}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          body="This takes the aircraft out of the fleet along with its recorded hours."
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
