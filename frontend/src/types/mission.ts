export type MissionStatus = 'draft' | 'planned' | 'complete'

export interface Waypoint {
  lat: number
  lng: number
  alt: number
  heading?: number
  speed?: number
}

export interface Mission {
  id: string
  name: string
  status: MissionStatus
  owner_id: string
  assigned_pilot_ids: string[]
  waypoints: Waypoint[]
  created_at: string
  updated_at: string
}

export interface MissionCreateInput {
  name: string
  status?: MissionStatus
  assigned_pilot_ids?: string[]
  waypoints?: Waypoint[]
}

export interface MissionUpdateInput {
  name?: string
  status?: MissionStatus
  assigned_pilot_ids?: string[]
  waypoints?: Waypoint[]
}
