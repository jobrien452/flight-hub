import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from '../map/MapView'
import { generateCorridorPlan, generateSurveyPlan } from '../planning/flightPlanGenerators'
import {
  createCorridorTool,
  createRectangleSurveyTool,
  createSelectTool,
  createWaypointTool,
  type LngLat,
  type MapTool,
  type ToolOverlay,
} from '../tools/MapTool'
import type {
  CorridorPlanParams,
  Mission,
  PlanParams,
  SurveyPlanParams,
  Waypoint,
} from '../types/mission'
import { ToolIcon } from './ToolIcon'
import { WaypointDrawer } from './WaypointDrawer'
import './MissionPlanEditor.css'

type ToolId = 'waypoint' | 'rectangle_survey' | 'corridor' | 'select'

// a shape being drawn but not yet turned into a route. kept apart from
// planParams, which describes the plan as actually saved
type DraftParams = SurveyPlanParams | CorridorPlanParams

// toolbar order, select first since it is what the editor opens on
const TOOL_ORDER: ToolId[] = ['select', 'waypoint', 'rectangle_survey', 'corridor']

// the tooltip names the tool, this says what it does once you are on it
const TOOL_HELP: Record<ToolId, string> = {
  select: 'click a waypoint to edit or drag it',
  waypoint: 'click to drop a waypoint, one per click',
  rectangle_survey: 'four clicks to box an area, then generate the sweep',
  corridor: 'trace a line, then generate passes either side of it',
}

export interface MissionPlanEditorValue {
  name: string
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
  onPublish?: (value: MissionPlanEditorValue) => void
  publishing?: boolean
}

export function MissionPlanEditor({
  mission,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onPublish,
  publishing = false,
}: MissionPlanEditorProps) {
  const [name, setName] = useState(mission?.name ?? '')
  // carried through untouched, pilots are assigned from the plan page, not here
  const assignedPilotIds = mission?.assigned_pilot_ids ?? []
  const [waypoints, setWaypoints] = useState<Waypoint[]>(mission?.waypoints ?? [])
  const [planParams, setPlanParams] = useState<PlanParams | null>(mission?.plan_params ?? null)
  const [activeToolId, setActiveToolId] = useState<ToolId>('select')
  const [altitude, setAltitude] = useState(50)
  const [spacing, setSpacing] = useState(20)
  const [corridorWidth, setCorridorWidth] = useState(40)
  const [planGenerated, setPlanGenerated] = useState(false)
  const [draftParams, setDraftParams] = useState<DraftParams | null>(null)
  // the plan as it was before the current draft generated anything, so a second
  // Generate replaces that output instead of stacking another copy on top
  const [baseWaypoints, setBaseWaypoints] = useState<Waypoint[] | null>(null)
  const [overlay, setOverlay] = useState<ToolOverlay>({ markers: [] })
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // tools are built once and read these through the refs, so changing the
  // altitude doesn't rebuild them and wipe out what's already been placed
  const settingsRef = useRef({ altitude, spacing, width: corridorWidth })
  const waypointsRef = useRef(waypoints)

  useEffect(() => {
    settingsRef.current.altitude = altitude
    settingsRef.current.spacing = spacing
    settingsRef.current.width = corridorWidth
  }, [altitude, spacing, corridorWidth])

  useEffect(() => {
    waypointsRef.current = waypoints
  }, [waypoints])

  const getSettings = useCallback(() => settingsRef.current, [])
  const getWaypoints = useCallback(() => waypointsRef.current, [])

  // the getters below read refs, which reads as render-time ref access, but they
  // only ever run inside map events, which is the point: the tools are built
  // once and still see live settings and waypoints
  /* oxlint-disable react/refs */
  const tools = useMemo<Record<ToolId, MapTool>>(
    () => ({
      waypoint: createWaypointTool(getSettings, getWaypoints, (points, params) => {
        setWaypoints(points)
        setPlanParams(params)
      }),
      rectangle_survey: createRectangleSurveyTool(getSettings, (_points, params) => {
        // the snapped box is a draft drawn by the overlay, it must not wipe the
        // waypoints already planned. only Generate turns it into a route
        setDraftParams(params)
        setPlanGenerated(false)
      }),
      corridor: createCorridorTool(getSettings, (_points, params) => {
        // same for the traced centre line, a draft until Generate Corridor runs
        setDraftParams(params)
        setPlanGenerated(false)
      }),
      select: createSelectTool({
        onSelect: setSelectedIndex,
        onMove: (index, point) => {
          setWaypoints((current) =>
            current.map((w, i) => (i === index ? { ...w, lat: point.lat, lng: point.lng } : w)),
          )
        },
      }),
    }),
    [getSettings, getWaypoints],
  )
  /* oxlint-enable react/refs */

  const activeTool = tools[activeToolId]

  function handleMapClick(point: LngLat) {
    activeTool.onMapClick(point)
    setOverlay(activeTool.renderOverlay())
  }

  function handleCornerGrab(index: number) {
    activeTool.onHandleDragStart(index)
    setOverlay(activeTool.renderOverlay())
  }

  function handleCornerMove(point: LngLat) {
    activeTool.onHandleDrag(point)
    setOverlay(activeTool.renderOverlay())
  }

  function handleCornerRelease() {
    activeTool.onHandleDragEnd()
  }

  // switching tools keeps whatever is already planned, so a generated survey can
  // be topped up by hand. placing a fresh box is what replaces a plan
  function handleToolSelect(id: ToolId) {
    activeTool.onDeactivate()
    tools[id].onActivate()
    setActiveToolId(id)
    // a new tool starts a new draft, whatever is planned now is what it builds on
    setBaseWaypoints(null)
    // a shape that was never generated goes with the tool that drew it, so coming
    // back offers nothing to generate until a fresh one is drawn
    setDraftParams(null)
    setSelectedIndex(null)
    setDrawerOpen(false)
    setOverlay(tools[id].renderOverlay())
  }

  // the box is just an outline until this runs, uses whatever altitude/spacing
  // are set right now so tweaking settings and regenerating works
  function handleGenerateSurvey() {
    if (draftParams?.type !== 'survey') return
    const params = { ...draftParams, altitude, spacing }
    setDraftParams(params)
    setPlanParams(params)
    appendGenerated(generateSurveyPlan(params))
  }

  // same two step shape as the survey, the traced line is not a flight plan yet
  function handleGenerateCorridor() {
    if (draftParams?.type !== 'corridor') return
    const params = { ...draftParams, altitude, spacing, width: corridorWidth }
    setDraftParams(params)
    setPlanParams(params)
    appendGenerated(generateCorridorPlan(params))
  }

  // generated points land on the end of the plan rather than over the top of it,
  // and regenerating swaps out the last lot instead of adding a second copy
  function appendGenerated(generated: Waypoint[]) {
    const base = baseWaypoints ?? waypoints
    setBaseWaypoints(base)
    setWaypoints([...base, ...generated])
    setPlanGenerated(true)
  }

  function updateSetting(apply: (value: number) => void, raw: string) {
    apply(Number(raw))
    // the generated route used the old numbers, so let it be generated again
    setPlanGenerated(false)
  }

  function handleWaypointChange(changes: Partial<Waypoint>) {
    if (selectedIndex === null) return
    setWaypoints((current) =>
      current.map((w, i) => (i === selectedIndex ? { ...w, ...changes } : w)),
    )
  }

  function handleWaypointDelete() {
    if (selectedIndex === null) return
    setWaypoints((current) => current.filter((_, i) => i !== selectedIndex))
    setSelectedIndex(null)
    setDrawerOpen(false)
  }

  function currentValue(): MissionPlanEditorValue {
    return { name, assignedPilotIds, waypoints, planParams }
  }

  const selectedWaypoint = selectedIndex === null ? undefined : waypoints[selectedIndex]
  const readyToPublish = name.trim().length > 0 && waypoints.length > 0
  const canPublish = onPublish && mission && mission.status === 'draft'

  // the generate step belongs to the tool that drew the draft, so it is offered
  // only while that tool is up and only until its output is actually generated
  const drafting =
    (activeToolId === 'rectangle_survey' && draftParams?.type === 'survey') ||
    (activeToolId === 'corridor' && draftParams?.type === 'corridor')
  const canGenerate = drafting && !planGenerated

  // the select tool draws every waypoint as a handle, so keep it in step as they change
  const liveOverlay = activeToolId === 'select' ? activeTool.renderOverlay() : overlay

  return (
    <div className={drawerOpen && selectedWaypoint ? 'plan-editor with-drawer' : 'plan-editor'}>
      <aside className="plan-editor-panel">
        <label>
          Name
          <input
            value={name}
            placeholder="New Mission"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <fieldset>
          <legend>Tool</legend>
          <div className="tool-row">
            {TOOL_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={activeToolId === id ? 'active' : ''}
                aria-label={tools[id].label}
                aria-describedby={activeToolId === id ? 'tool-hint' : undefined}
                onClick={() => handleToolSelect(id)}
              >
                <ToolIcon name={tools[id].icon} />
                {/* duplicates the aria-label, so it is decoration for the eye only */}
                <span className="tool-help" aria-hidden="true">
                  {tools[id].label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-dim mono tool-hint" id="tool-hint">
            {TOOL_HELP[activeToolId]}
          </p>
          {activeToolId !== 'select' && (
            <label>
              Altitude (m)
              <input
                type="number"
                value={altitude}
                onChange={(e) => updateSetting(setAltitude, e.target.value)}
              />
            </label>
          )}
          {(activeToolId === 'rectangle_survey' || activeToolId === 'corridor') && (
            <label>
              Line spacing (m)
              <input
                type="number"
                value={spacing}
                onChange={(e) => updateSetting(setSpacing, e.target.value)}
              />
            </label>
          )}
          {activeToolId === 'corridor' && (
            <label>
              Corridor width (m)
              <input
                type="number"
                value={corridorWidth}
                onChange={(e) => updateSetting(setCorridorWidth, e.target.value)}
              />
            </label>
          )}
          {canGenerate && activeToolId === 'rectangle_survey' && (
            <button type="button" onClick={handleGenerateSurvey}>
              Generate Survey
            </button>
          )}
          {canGenerate && activeToolId === 'corridor' && (
            <button type="button" onClick={handleGenerateCorridor}>
              Generate Corridor
            </button>
          )}
          {canGenerate ? (
            <p className="text-dim mono">
              {activeToolId === 'rectangle_survey'
                ? 'box placed, click Generate Survey'
                : 'line traced, click Generate Corridor'}
            </p>
          ) : (
            <p className="text-dim mono">{waypoints.length} waypoints</p>
          )}
        </fieldset>

        {error && <p className="auth-error">{error}</p>}
        <button
          type="button"
          className="button"
          disabled={submitting}
          onClick={() => onSubmit(currentValue())}
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
        {canPublish && (
          <button
            type="button"
            className="button button-secondary"
            disabled={!readyToPublish || publishing}
            onClick={() => onPublish(currentValue())}
          >
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        )}
      </aside>

      <div className="plan-editor-map">
        <MapView
          waypoints={waypoints}
          onMapClick={handleMapClick}
          overlay={liveOverlay}
          onHandleDragStart={handleCornerGrab}
          onHandleDrag={handleCornerMove}
          onHandleDragEnd={handleCornerRelease}
          infoboxAt={selectedWaypoint}
          infobox={
            selectedWaypoint && (
              <div className="waypoint-infobox">
                <strong>Waypoint {(selectedIndex ?? 0) + 1}</strong>
                <p className="mono">
                  {selectedWaypoint.lat.toFixed(5)}, {selectedWaypoint.lng.toFixed(5)}
                </p>
                <label>
                  Waypoint altitude (m)
                  <input
                    type="number"
                    value={selectedWaypoint.alt ?? 0}
                    onChange={(e) => handleWaypointChange({ alt: Number(e.target.value) })}
                  />
                </label>
                <button type="button" onClick={() => setDrawerOpen(true)}>
                  Edit details
                </button>
                <button type="button" onClick={handleWaypointDelete}>
                  Delete waypoint
                </button>
              </div>
            )
          }
        />
      </div>

      {drawerOpen && selectedWaypoint && selectedIndex !== null && (
        <WaypointDrawer
          waypoint={selectedWaypoint}
          index={selectedIndex}
          onChange={handleWaypointChange}
          onDelete={handleWaypointDelete}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}
