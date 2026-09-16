import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getMission, publishMission, updateMission } from '../api/missions'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MapView } from '../map/MapView'
import { MissionPlanEditor, type MissionPlanEditorValue } from '../missions/MissionPlanEditor'
import type { Mission } from '../types/mission'
import './MissionsPage.css'

export function MissionDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [mission, setMission] = useState<Mission | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingEdit, setConfirmingEdit] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [offerAssignment, setOfferAssignment] = useState(false)

  useEffect(() => {
    if (!session || !id) return
    getMission(id, session.token)
      .then(setMission)
      .catch(() => setLoadError('Could not load mission'))
  }, [session, id])

  async function save(value: MissionPlanEditorValue): Promise<Mission | null> {
    if (!session || !id) return null
    return updateMission(
      id,
      {
        name: value.name,
        assigned_pilot_ids: value.assignedPilotIds,
        waypoints: value.waypoints,
        plan_params: value.planParams ?? undefined,
      },
      session.token,
    )
  }

  async function handleSave(value: MissionPlanEditorValue) {
    setSubmitting(true)
    setSaveError(null)
    try {
      const updated = await save(value)
      if (updated) setMission(updated)
      setEditing(false)
    } catch {
      setSaveError('Could not save changes')
    } finally {
      setSubmitting(false)
    }
  }

  // save first so what gets published is what's on screen, not the last saved copy
  async function handlePublish(value: MissionPlanEditorValue) {
    if (!session || !id) return
    setPublishing(true)
    setSaveError(null)
    try {
      await save(value)
      setMission(await publishMission(id, session.token))
      setEditing(false)
      setOfferAssignment(true)
    } catch {
      setSaveError('Could not publish this mission')
    } finally {
      setPublishing(false)
    }
  }

  function handleEditClick() {
    // editing a mission pilots are already flying against deserves a second look
    if (mission?.assigned_pilot_ids.length) {
      setConfirmingEdit(true)
      return
    }
    setEditing(true)
  }

  if (loadError) return <p className="auth-error">{loadError}</p>
  if (!mission) return <p className="text-dim">Loading...</p>

  const assignmentOffer = offerAssignment && (
    <ConfirmDialog
      title="Mission published"
      body="Ready to assign pilots to it now?"
      confirmLabel="Assign pilots"
      onConfirm={() => navigate(`/missions/${mission.id}/plan`)}
      onCancel={() => setOfferAssignment(false)}
    />
  )

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
          onPublish={handlePublish}
          publishing={publishing}
        />
        {assignmentOffer}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>{mission.name}</h1>
        {session?.role === 'admin' && (
          <div className="header-actions">
            <button type="button" className="button" onClick={handleEditClick}>
              Edit
            </button>
            <Link className="button button-secondary" to={`/missions/${mission.id}/plan`}>
              Plan
            </Link>
          </div>
        )}
      </div>
      {saveError && <p className="auth-error">{saveError}</p>}
      <p className="text-dim mono">
        {mission.status} / {mission.waypoints.length} waypoints
      </p>
      <div style={{ height: 400 }}>
        <MapView waypoints={mission.waypoints} onMapClick={() => {}} />
      </div>

      {confirmingEdit && (
        <ConfirmDialog
          title="Edit this mission?"
          body="This mission has already been assigned. Changing the plan now affects pilots who are working from it."
          confirmLabel="Edit anyway"
          onConfirm={() => {
            setConfirmingEdit(false)
            setEditing(true)
          }}
          onCancel={() => setConfirmingEdit(false)}
        />
      )}
      {assignmentOffer}
    </div>
  )
}
