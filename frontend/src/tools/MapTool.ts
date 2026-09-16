import { snapToRectangle } from './snapRectangle'
import type { SurveyPlanParams, Waypoint, WaypointPlanParams } from '../types/mission'

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

export interface WaypointToolSettings {
  altitude: number
}

// manual point placement, each click appends a waypoint
export function createWaypointTool(
  settings: WaypointToolSettings,
  onChange: (waypoints: Waypoint[], planParams: WaypointPlanParams) => void,
): MapTool {
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
      waypoints = [...waypoints, { lat: point.lat, lng: point.lng, alt: settings.altitude }]
      onChange(waypoints, { type: 'waypoint', waypoints })
    },
    renderOverlay: () => waypoints,
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
  settings: RectangleSurveySettings,
  onChange: (waypoints: Waypoint[], planParams: SurveyPlanParams) => void,
): MapTool {
  let corners: LngLat[] = []
  let boundary: Waypoint[] = []

  return {
    id: 'rectangle_survey',
    label: 'Rectangle Survey',
    icon: 'square',
    onActivate: () => {
      corners = []
      boundary = []
    },
    onDeactivate: () => {},
    onMapClick: (point) => {
      corners = corners.length >= 4 ? [point] : [...corners, point]
      if (corners.length !== 4) return

      boundary = snapToRectangle(corners)
      const planParams: SurveyPlanParams = { type: 'survey', boundary, ...settings }
      onChange(boundary, planParams)
    },
    renderOverlay: () => boundary,
  }
}

// default registry the toolbar renders from, add a new tool here to expose it
export const mapTools: MapTool[] = [
  createWaypointTool({ altitude: 50 }, () => {}),
  createRectangleSurveyTool({ altitude: 50, spacing: 20 }, () => {}),
]
