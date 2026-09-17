// draft --publish--> published --pilot picks it up--> acknowledged
// --pilot flies it--> in_flight --every pilot reports in--> completed
export type MissionStatus =
  | 'draft'
  | 'published'
  | 'acknowledged'
  | 'in_flight'
  | 'completed'

export interface Waypoint {
  lat: number
  lng: number
  alt?: number
  heading?: number
  speed?: number
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

export type PlanParams = WaypointPlanParams | SurveyPlanParams

export interface Mission {
  id: string
  name: string
  status: MissionStatus
  owner_id: string
  assigned_pilot_ids: string[]
  drone_id: string | null
  waypoints: Waypoint[]
  plan_params: PlanParams | null
  created_at: string
  updated_at: string
}

// status is left out of both, the server owns it through publish and pilot reports
export interface MissionCreateInput {
  name: string
  assigned_pilot_ids?: string[]
  drone_id?: string | null
  waypoints?: Waypoint[]
  plan_params?: PlanParams
}

export interface MissionUpdateInput {
  name?: string
  assigned_pilot_ids?: string[]
  drone_id?: string | null
  waypoints?: Waypoint[]
  plan_params?: PlanParams
}
