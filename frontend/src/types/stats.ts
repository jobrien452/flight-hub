export interface PilotStat {
  pilot_id: string
  name: string
  email: string
  missions_assigned: number
  reports_submitted: number
  flight_hours: number
}

export interface DashboardStats {
  missions_total: number
  missions_by_status: Record<string, number>
  drones_total: number
  drones_by_status: Record<string, number>
  fleet_flight_hours: number
  fleet_missions_flown: number
  pilots: PilotStat[]
}
