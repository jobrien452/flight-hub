import { apiFetch } from './client'
import type {
  MissionReport,
  MissionReportCreateInput,
  MissionReportUpdateInput,
} from '../types/missionReport'

export async function listMissionReports(
  missionId: string,
  token: string,
): Promise<MissionReport[]> {
  return apiFetch<MissionReport[]>(`/missions/${missionId}/reports`, token)
}

export async function createMissionReport(
  missionId: string,
  payload: MissionReportCreateInput,
  token: string,
): Promise<MissionReport> {
  return apiFetch<MissionReport>(`/missions/${missionId}/reports`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateMissionReport(
  missionId: string,
  reportId: string,
  payload: MissionReportUpdateInput,
  token: string,
): Promise<MissionReport> {
  return apiFetch<MissionReport>(`/missions/${missionId}/reports/${reportId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
