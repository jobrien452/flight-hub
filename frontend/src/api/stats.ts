import { apiFetch } from './client'
import type { DashboardStats } from '../types/stats'

// admin only, the numbers are scoped to whoever asks
export async function getStats(token: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/stats', token)
}
