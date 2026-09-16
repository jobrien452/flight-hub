import { useEffect, useMemo, useState } from 'react'
import { listUsers } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { MapView } from '../map/MapView'
import { generateSurveyPlan } from '../planning/flightPlanGenerators'
import {
  createRectangleSurveyTool,
  createWaypointTool,
  type LngLat,
  type MapTool,
  type ToolOverlay,
} from '../tools/MapTool'
import type { Mission, MissionStatus, PlanParams, Waypoint } from '../types/mission'
import type { User } from '../types/user'
import './MissionPlanEditor.css'

export interface MissionPlanEditorValue {
  name: string
  status: MissionStatus
  assignedPilotIds: string[]
  waypoints: Waypoint[]
  planParams: PlanParams | null
}

interface MissionPlanEditorProps {
  mission?: Mission
  submitting: boolean
  error: string | null
  submitLabel: string
  onSubmit: (value: MissionPlanEditorValue) => void
}

export function MissionPlanEditor({
  mission,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: MissionPlanEditorProps) {
  const { session } = useAuth()
  const [pilots, setPilots] = useState<User[]>([])
  const [name, setName] = useState(mission?.name ?? '')
  const [status, setStatus] = useState<MissionStatus>(mission?.status ?? 'draft')
  const [assignedPilotIds, setAssignedPilotIds] = useState<string[]>(
    mission?.assigned_pilot_ids ?? [],
  )
  const [waypoints, setWaypoints] = useState<Waypoint[]>(mission?.waypoints ?? [])
  const [planParams, setPlanParams] = useState<PlanParams | null>(mission?.plan_params ?? null)
  const [activeToolId, setActiveToolId] = useState<'waypoint' | 'rectangle_survey'>('waypoint')
  const [altitude, setAltitude] = useState(50)
  const [spacing, setSpacing] = useState(20)
  const [surveyGenerated, setSurveyGenerated] = useState(false)
  const [overlay, setOverlay] = useState<ToolOverlay>({ markers: [] })

  useEffect(() => {
    // pilots aren't assignable until the mission exists, no point fetching yet
    if (!session || !mission) return
    listUsers(session.token, 'pilot').then(setPilots).catch(() => setPilots([]))
  }, [session, mission])

  const tools = useMemo<Record<string, MapTool>>(
    () => ({
      waypoint: createWaypointTool({ altitude }, (points, params) => {
        setWaypoints(points)
        setPlanParams(params)
      }),
      rectangle_survey: createRectangleSurveyTool({ altitude, spacing }, (points, params) => {
        // points here are just the snapped box outline, not a generated sweep yet
        setWaypoints(points)
        setPlanParams(params)
        setSurveyGenerated(false)
      }),
    }),
    [altitude, spacing],
  )

  const activeTool = tools[activeToolId]

  // the tool keeps its own draft state, so pull the overlay after every click
  // to get the corners on screen as they land
  function handleMapClick(point: LngLat) {
    activeTool.onMapClick(point)
    setOverlay(activeTool.renderOverlay())
  }

  function handleCornerGrab(index: number) {
    activeTool.onHandleDragStart(index)
  }

  function handleCornerMove(point: LngLat) {
    activeTool.onHandleDrag(point)
    setOverlay(activeTool.renderOverlay())
  }

  function handleCornerRelease() {
    activeTool.onHandleDragEnd()
  }

  // switching tools always starts a fresh plan, no partial-append across tools
  function handleToolSelect(id: 'waypoint' | 'rectangle_survey') {
    activeTool.onDeactivate()
    tools[id].onActivate()
    setActiveToolId(id)
    setWaypoints([])
    setPlanParams(null)
    setSurveyGenerated(false)
    setOverlay({ markers: [] })
  }

  // the box is just an outline until this runs, uses whatever altitude/spacing
  // are set right now so tweaking settings and regenerating works
  function handleGenerateSurvey() {
    if (planParams?.type !== 'survey') return
    const params = { ...planParams, altitude, spacing }
    setWaypoints(generateSurveyPlan(params))
    setPlanParams(params)
    setSurveyGenerated(true)
  }

  function togglePilot(pilotId: string) {
    setAssignedPilotIds((current) =>
      current.includes(pilotId)
        ? current.filter((id) => id !== pilotId)
        : [...current, pilotId],
    )
  }

  function handleSubmit() {
    onSubmit({ name, status, assignedPilotIds, waypoints, planParams })
  }

  return (
    <div className="plan-editor">
      <aside className="plan-editor-panel">
        <label>
          Name
          <input
            value={name}
            placeholder="New Mission"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as MissionStatus)}>
            <option value="draft">Draft</option>
            <option value="planned">Planned</option>
            <option value="complete">Complete</option>
          </select>
        </label>

        {mission && (
          <fieldset>
            <legend>Pilots</legend>
            {pilots.map((pilot) => (
              <label key={pilot.id} className="pilot-row">
                <input
                  type="checkbox"
                  checked={assignedPilotIds.includes(pilot.id)}
                  onChange={() => togglePilot(pilot.id)}
                />
                {pilot.name}
              </label>
            ))}
            {pilots.length === 0 && <p className="text-dim">No pilots yet.</p>}
          </fieldset>
        )}

        <fieldset>
          <legend>Tool</legend>
          <div className="tool-row">
            <button
              type="button"
              className={activeToolId === 'waypoint' ? 'active' : ''}
              onClick={() => handleToolSelect('waypoint')}
            >
              Waypoint
            </button>
            <button
              type="button"
              className={activeToolId === 'rectangle_survey' ? 'active' : ''}
              onClick={() => handleToolSelect('rectangle_survey')}
            >
              Rectangle Survey
            </button>
          </div>
          <label>
            Altitude (m)
            <input
              type="number"
              value={altitude}
              onChange={(e) => setAltitude(Number(e.target.value))}
            />
          </label>
          {activeToolId === 'rectangle_survey' && (
            <label>
              Line spacing (m)
              <input
                type="number"
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
              />
            </label>
          )}
          {planParams?.type === 'survey' && (
            <button type="button" onClick={handleGenerateSurvey}>
              Generate Survey
            </button>
          )}
          {planParams?.type === 'survey' && !surveyGenerated ? (
            <p className="text-dim mono">box placed, click Generate Survey</p>
          ) : (
            <p className="text-dim mono">{waypoints.length} waypoints</p>
          )}
        </fieldset>

        {error && <p className="auth-error">{error}</p>}
        <button type="button" className="button" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </aside>

      <div className="plan-editor-map">
        <MapView
          waypoints={waypoints}
          onMapClick={handleMapClick}
          overlay={overlay}
          onHandleDragStart={handleCornerGrab}
          onHandleDrag={handleCornerMove}
          onHandleDragEnd={handleCornerRelease}
        />
      </div>
    </div>
  )
}
