import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getMission, publishMission, updateMission } from '../api/missions'
import { listUsers } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { statusLabel } from '../format/status'
import { MapView } from '../map/MapView'
import { MissionAircraft } from '../missions/MissionAircraft'
import { downloadPlan } from '../missions/downloadPlan'
import { MissionPlanEditor, type MissionPlanEditorValue } from '../missions/MissionPlanEditor'
import { PilotMissionPanel } from '../missions/PilotMissionPanel'
import { PlanSummary } from '../missions/PlanSummary'
import type { Mission } from '../types/mission'
import type { User } from '../types/user'
import './MissionDetailPage.css'
import './MissionsPage.css'

export function MissionDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mission, setMission] = useState<Mission | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // arriving with ?edit=1 means the warning was already given on the missions table
  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmingEdit, setConfirmingEdit] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [offerAssignment, setOfferAssignment] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [pilots, setPilots] = useState<User[]>([])

  useEffect(() => {
    if (!session || !id) return
    getMission(id, session.token)
      .then(setMission)
      .catch(() => setLoadError('Could not load mission'))
  }, [session, id])

  useEffect(() => {
    // only admins may list users, so pilots viewing a mission skip this
    if (session?.role !== 'admin') return
    listUsers(session.token, 'pilot').then(setPilots).catch(() => setPilots([]))
  }, [session])

  async function save(value: MissionPlanEditorValue): Promise<Mission | null> {
    if (!session || !id) return null
    return updateMission(
      id,
      {
        name: value.name,
        assigned_pilot_ids: value.assignedPilotIds,
        drone_id: value.droneId,
        payload: value.payload,
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

  // publishing straight from the view, nothing on screen to save first
  async function handlePublishFromView() {
    if (!session || !id) return
    setPublishing(true)
    setSaveError(null)
    try {
      setMission(await publishMission(id, session.token))
      setOfferAssignment(true)
    } catch {
      setSaveError('Could not publish this mission')
    } finally {
      setPublishing(false)
    }
  }

  async function handleExport() {
    if (!session || !mission) return
    setExporting(true)
    setSaveError(null)
    try {
      await downloadPlan(mission.id, mission.name, session.token)
    } catch {
      setSaveError('Could not export this plan')
    } finally {
      setExporting(false)
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

  const isDraft = mission.status === 'draft'
  const assignedPilots = pilots.filter((p) => mission.assigned_pilot_ids.includes(p.id))

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
      <div className="plan-page">
        <h1>Mission planning</h1>
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
        <div className="header-actions">
          {/* the plan in the format the aircraft reads, whoever is looking at it */}
          <button
            type="button"
            className="button button-secondary"
            disabled={mission.waypoints.length === 0 || exporting}
            onClick={handleExport}
          >
            {exporting ? 'Exporting...' : 'Export .waypoints'}
          </button>
          {session?.role === 'admin' && (
            <>
              <button type="button" className="button" onClick={handleEditClick}>
                Edit
              </button>
              {isDraft && (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={mission.waypoints.length === 0 || publishing}
                  onClick={handlePublishFromView}
                >
                  {publishing ? 'Publishing...' : 'Publish'}
                </button>
              )}
              {/* nothing to plan against until the mission is published */}
              {!isDraft && (
                <Link className="button button-secondary" to={`/missions/${mission.id}/plan`}>
                  Plan
                </Link>
              )}
            </>
          )}
        </div>
      </div>
      {saveError && <p className="auth-error">{saveError}</p>}
      <p className="text-dim">{statusLabel(mission.status)}</p>

      <PlanSummary waypoints={mission.waypoints} />

      <div style={{ height: 400 }}>
        <MapView waypoints={mission.waypoints} onMapClick={() => {}} />
      </div>

      <MissionAircraft mission={mission} />

      {session?.role === 'pilot' && (
        <PilotMissionPanel mission={mission} onMissionChange={setMission} />
      )}

      {session?.role === 'admin' && (
        <section className="mission-pilots">
          <h2>Pilots</h2>
          {assignedPilots.length === 0 ? (
            <p className="text-dim">No pilots assigned yet.</p>
          ) : (
            <ul>
              {assignedPilots.map((pilot) => (
                <li key={pilot.id}>
                  {pilot.name} <span className="text-dim mono">{pilot.email}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
