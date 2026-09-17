// available and in_flight follow the missions this drone is booked on,
// the other two are the admin taking it out of rotation by hand
export type DroneStatus = 'available' | 'in_flight' | 'maintenance' | 'retired'

export interface Drone {
  id: string
  name: string
  model: string
  serial: string
  status: DroneStatus
  owner_id: string
  flight_hours: number
  missions_flown: number
  created_at: string
  updated_at: string
}

export interface DroneCreateInput {
  name: string
  model?: string
  serial?: string
  status?: DroneStatus
}

export interface DroneUpdateInput {
  name?: string
  model?: string
  serial?: string
  status?: DroneStatus
}
