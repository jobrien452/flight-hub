import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMission, updateMission } from '../api/missions'
import { useAuth } from '../auth/useAuth'
import { MapView } from '../map/MapView'
import { MissionPlanEditor, type MissionPlanEditorValue } from '../missions/MissionPlanEditor'
import type { Mission } from '../types/mission'
import './MissionsPage.css'

export function MissionDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const [mission, setMission] = useState<Mission | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !id) return
    getMission(id, session.token)
      .then(setMission)
      .catch(() => setLoadError('Could not load mission'))
  }, [session, id])

  async function handleSave(value: MissionPlanEditorValue) {
    if (!session || !id) return
    setSubmitting(true)
    setSaveError(null)
    try {
      const updated = await updateMission(
        id,
        {
          name: value.name,
          status: value.status,
          assigned_pilot_ids: value.assignedPilotIds,
          waypoints: value.waypoints,
          plan_params: value.planParams ?? undefined,
        },
        session.token,
      )
      setMission(updated)
      setEditing(false)
    } catch {
      setSaveError('Could not save changes')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) return <p className="auth-error">{loadError}</p>
  if (!mission) return <p className="text-dim">Loading...</p>

  if (editing) {
    return (
      <div>
        <h1>{mission.name}</h1>
        <MissionPlanEditor
          mission={mission}
          submitting={submitting}
          error={saveError}
          submitLabel="Save Changes"
          onSubmit={handleSave}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>{mission.name}</h1>
        {session?.role === 'admin' && (
          <button type="button" className="button" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <p className="text-dim mono">
        {mission.status} / {mission.waypoints.length} waypoints
      </p>
      <div style={{ height: 400 }}>
        <MapView waypoints={mission.waypoints} onMapClick={() => {}} />
      </div>
    </div>
  )
}
