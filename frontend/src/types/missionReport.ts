export type MissionReportStatus = 'in_progress' | 'submitted'

export interface MissionReport {
  id: string
  mission_id: string
  pilot_id: string
  status: MissionReportStatus
  notes: string
  data: Record<string, unknown>
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface MissionReportCreateInput {
  status?: MissionReportStatus
  notes?: string
  data?: Record<string, unknown>
}

export interface MissionReportUpdateInput {
  status?: MissionReportStatus
  notes?: string
  data?: Record<string, unknown>
}
