import { generateSurveyPlan } from '../planning/flightPlanGenerators'
import type { Waypoint } from '../types/mission'

export interface LngLat {
  lng: number
  lat: number
}

// common shape for anything on the toolbar, new tools just implement this
export interface MapTool {
  id: string
  label: string
  icon: string
  onActivate: () => void
  onDeactivate: () => void
  onMapClick: (point: LngLat) => void
  renderOverlay: () => Waypoint[]
}

// manual point placement, each click appends a waypoint
export function createWaypointTool(onChange: (waypoints: Waypoint[]) => void): MapTool {
  let waypoints: Waypoint[] = []
  return {
    id: 'waypoint',
    label: 'Waypoint',
    icon: 'pin',
    onActivate: () => {
      waypoints = []
    },
    onDeactivate: () => {},
    onMapClick: (point) => {
      waypoints = [...waypoints, { ...point, alt: 0 }]
      onChange(waypoints)
    },
    renderOverlay: () => waypoints,
  }
}

export interface RectangleSurveySettings {
  altitude: number
  spacing: number
  heading?: number
}

// two clicks set opposite corners of a rectangle, then the sweep generator runs
export function createRectangleSurveyTool(
  settings: RectangleSurveySettings,
  onChange: (waypoints: Waypoint[]) => void,
): MapTool {
  let corners: LngLat[] = []
  let waypoints: Waypoint[] = []

  return {
    id: 'rectangle_survey',
    label: 'Rectangle Survey',
    icon: 'square',
    onActivate: () => {
      corners = []
      waypoints = []
    },
    onDeactivate: () => {},
    onMapClick: (point) => {
      corners = corners.length >= 2 ? [point] : [...corners, point]
      if (corners.length !== 2) return

      const [a, b] = corners
      const boundary: Waypoint[] = [
        { lat: a.lat, lng: a.lng },
        { lat: a.lat, lng: b.lng },
        { lat: b.lat, lng: b.lng },
        { lat: b.lat, lng: a.lng },
      ]
      waypoints = generateSurveyPlan({ type: 'survey', boundary, ...settings })
      onChange(waypoints)
    },
    renderOverlay: () => waypoints,
  }
}

// default registry the toolbar renders from, add a new tool here to expose it
export const mapTools: MapTool[] = [
  createWaypointTool(() => {}),
  createRectangleSurveyTool({ altitude: 50, spacing: 20 }, () => {}),
]
