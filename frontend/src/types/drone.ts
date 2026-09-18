// available and in_flight follow the missions this drone is booked on,
// the other two are the admin taking it out of rotation by hand
export type DroneStatus = 'available' | 'in_flight' | 'maintenance' | 'retired'

export interface Drone {
  id: string
  name: string
  model: string
  serial: string
  // where the aircraft puts its video, the jetson serves rtsp on the airframe
  stream_url: string
  status: DroneStatus
  owner_id: string
  flight_hours: number
  missions_flown: number
  // the mission holding this aircraft, a booking is exclusive until it is flown
  booked_on: string | null
  // removed from the fleet but kept, the missions it flew still read from it
  hidden: boolean
  created_at: string
  updated_at: string
}

export interface DroneCreateInput {
  name: string
  model?: string
  serial?: string
  stream_url?: string
  status?: DroneStatus
}

export interface DroneUpdateInput {
  name?: string
  model?: string
  serial?: string
  stream_url?: string
  status?: DroneStatus
}
