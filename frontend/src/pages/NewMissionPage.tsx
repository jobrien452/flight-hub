import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createMission } from '../api/missions'
import { useAuth } from '../auth/useAuth'
import { MissionPlanEditor, type MissionPlanEditorValue } from '../missions/MissionPlanEditor'

export function NewMissionPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(value: MissionPlanEditorValue) {
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      const mission = await createMission(
        {
          name: value.name,
          assigned_pilot_ids: value.assignedPilotIds,
          waypoints: value.waypoints,
          plan_params: value.planParams ?? undefined,
        },
        session.token,
      )
      navigate(`/missions/${mission.id}`, { replace: true })
    } catch {
      setError('Could not create the mission')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="plan-page">
      <h1>Mission planning</h1>
      <MissionPlanEditor
        submitting={submitting}
        error={error}
        submitLabel="Create Mission"
        onSubmit={handleSubmit}
      />
    </div>
  )
}
