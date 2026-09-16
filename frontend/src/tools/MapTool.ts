import { snapToRectangle } from './snapRectangle'
import type { SurveyPlanParams, Waypoint, WaypointPlanParams } from '../types/mission'

export interface LngLat {
  lng: number
  lat: number
}

// what the tool wants drawn while the user is still placing it, kept apart
// from the committed plan waypoints so a draft never looks like a real route
export interface ToolOverlay {
  markers: Waypoint[]
  ghost?: Waypoint[]
  // whether the markers can be grabbed and dragged
  draggable?: boolean
  // index into markers, drawn highlighted
  selected?: number
}

// common shape for anything on the toolbar, new tools just implement this
export interface MapTool {
  id: string
  label: string
  icon: string
  onActivate: () => void
  onDeactivate: () => void
  onMapClick: (point: LngLat) => void
  // dragging one of the overlay markers, by its index in renderOverlay().markers
  onHandleDragStart: (index: number) => void
  onHandleDrag: (point: LngLat) => void
  onHandleDragEnd: () => void
  renderOverlay: () => ToolOverlay
}

export interface WaypointToolSettings {
  altitude: number
}

// manual point placement, each click appends a waypoint carrying whatever
// altitude is set right now, so changing the altitude only affects new points
export function createWaypointTool(
  getSettings: () => WaypointToolSettings,
  getWaypoints: () => Waypoint[],
  onChange: (waypoints: Waypoint[], planParams: WaypointPlanParams) => void,
): MapTool {
  return {
    id: 'waypoint',
    label: 'Waypoint',
    icon: 'pin',
    onActivate: () => {},
    onDeactivate: () => {},
    onMapClick: (point) => {
      const waypoints = [
        ...getWaypoints(),
        { lat: point.lat, lng: point.lng, alt: getSettings().altitude },
      ]
      onChange(waypoints, { type: 'waypoint', waypoints })
    },
    // nothing to grab, this tool draws no handles
    onHandleDragStart: () => {},
    onHandleDrag: () => {},
    onHandleDragEnd: () => {},
    // every click lands straight in the plan, so there is no draft to preview
    renderOverlay: () => ({ markers: [] }),
  }
}

export interface SelectToolCallbacks {
  getWaypoints: () => Waypoint[]
  onSelect: (index: number | null) => void
  onMove: (index: number, point: LngLat) => void
}

// places nothing of its own, it just targets waypoints that are already down so
// they can be moved or edited through the infobox
export function createSelectTool({
  getWaypoints,
  onSelect,
  onMove,
}: SelectToolCallbacks): MapTool {
  let selected: number | null = null
  let dragging = false

  return {
    id: 'select',
    label: 'Select',
    icon: 'cursor',
    onActivate: () => {
      selected = null
      dragging = false
    },
    onDeactivate: () => {
      selected = null
    },
    // a click on open map means "never mind", clicks on a waypoint arrive as a grab
    onMapClick: () => {
      selected = null
      onSelect(null)
    },
    onHandleDragStart: (index) => {
      selected = index
      dragging = true
      onSelect(index)
    },
    onHandleDrag: (point) => {
      if (!dragging || selected === null) return
      onMove(selected, point)
    },
    onHandleDragEnd: () => {
      dragging = false
    },
    renderOverlay: () => ({
      markers: getWaypoints(),
      draggable: true,
      ...(selected === null ? {} : { selected }),
    }),
  }
}

export interface RectangleSurveySettings {
  altitude: number
  spacing: number
  heading?: number
}

// 4 clicks rough out a box, snapped to a clean size, the sweep itself is a
// separate explicit step (see MissionPlanEditor's "Generate Survey" button)
export function createRectangleSurveyTool(
  getSettings: () => RectangleSurveySettings,
  onChange: (waypoints: Waypoint[], planParams: SurveyPlanParams) => void,
): MapTool {
  let corners: LngLat[] = []
  let boundary: Waypoint[] = []
  // corner held opposite the one being dragged, fixed for the whole gesture so
  // the box does not fight back when a drag crosses over it
  let anchor: Waypoint | null = null

  function commit(box: Waypoint[]) {
    boundary = box
    corners = box
    onChange(box, { type: 'survey', boundary: box, ...getSettings() })
  }

  return {
    id: 'rectangle_survey',
    label: 'Rectangle Survey',
    icon: 'square',
    onActivate: () => {
      corners = []
      boundary = []
      anchor = null
    },
    onDeactivate: () => {},
    onMapClick: (point) => {
      // a click on a finished box starts a new one
      if (corners.length >= 4) {
        corners = [point]
        boundary = []
        return
      }

      corners = [...corners, point]
      if (corners.length !== 4) return

      commit(snapToRectangle(corners))
    },
    onHandleDragStart: (index) => {
      if (boundary.length !== 4) return
      anchor = boundary[(index + 2) % 4]
    },
    onHandleDrag: (point) => {
      if (!anchor) return
      commit(snapToRectangle([anchor, point]))
    },
    onHandleDragEnd: () => {
      anchor = null
    },
    // corners as they go down, then the snapped box so you can see where it
    // landed versus where you clicked
    renderOverlay: () =>
      boundary.length > 0
        ? { markers: boundary, ghost: boundary, draggable: true }
        : { markers: corners.map(({ lat, lng }) => ({ lat, lng })) },
  }
}

// default registry the toolbar renders from, add a new tool here to expose it
export const mapTools: MapTool[] = [
  createWaypointTool(() => ({ altitude: 50 }), () => [], () => {}),
  createRectangleSurveyTool(() => ({ altitude: 50, spacing: 20 }), () => {}),
  createSelectTool({ getWaypoints: () => [], onSelect: () => {}, onMove: () => {} }),
]
