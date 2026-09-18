// draft --publish--> published --pilot picks it up--> acknowledged
// --pilot flies it--> in_flight --every pilot reports in--> completed
export type MissionStatus =
  | 'draft'
  | 'published'
  | 'acknowledged'
  | 'in_flight'
  | 'completed'

// what the aircraft is carrying. the sensor numbers ride along rather than being
// looked up, so an old mission still reads right if the catalogue changes
export interface Payload {
  name: string
  camera: string
  lens: string
  gimbal: string
  sensor_width_mm: number
  sensor_height_mm: number
  image_width_px: number
  image_height_px: number
  focal_length_mm: number
}

export interface Waypoint {
  lat: number
  lng: number
  alt?: number
  heading?: number
  speed?: number
  // what the payload is asked to do on arrival, pitch in degrees with down negative
  gimbal_pitch?: number
  zoom?: number
  photo?: boolean
}

export interface WaypointPlanParams {
  type: 'waypoint'
  waypoints: Waypoint[]
}

export interface SurveyPlanParams {
  type: 'survey'
  boundary: Waypoint[]
  altitude: number
  spacing: number
  heading?: number
}

// a strip of ground either side of a line, for roads, pipelines and power lines
export interface CorridorPlanParams {
  type: 'corridor'
  path: Waypoint[]
  altitude: number
  width: number
  spacing: number
}

export type PlanParams = WaypointPlanParams | SurveyPlanParams | CorridorPlanParams

// what the mission table gets. the route can run to thousands of points, so it
// is fetched per mission instead of riding along with every row
export interface MissionSummary {
  id: string
  name: string
  status: MissionStatus
  owner_id: string
  assigned_pilot_ids: string[]
  drone_id: string | null
  waypoint_count: number
  created_at: string
  updated_at: string
}

export interface Mission extends MissionSummary {
  payload: Payload | null
  waypoints: Waypoint[]
  plan_params: PlanParams | null
}

// status is left out of both, the server owns it through publish and pilot reports
export interface MissionCreateInput {
  name: string
  assigned_pilot_ids?: string[]
  drone_id?: string | null
  payload?: Payload | null
  waypoints?: Waypoint[]
  plan_params?: PlanParams
}

export interface MissionUpdateInput {
  name?: string
  assigned_pilot_ids?: string[]
  drone_id?: string | null
  payload?: Payload | null
  waypoints?: Waypoint[]
  plan_params?: PlanParams
}
