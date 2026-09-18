import { exportMissionPlan } from '../api/missions'

// the browser has no save api, a link that is clicked for you is the whole of it
export async function downloadPlan(id: string, name: string, token: string): Promise<void> {
  const text = await exportMissionPlan(id, token)
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[^\w-]+/g, '-') || 'mission'}.waypoints`
  link.click()
  // let the browser take the url before it is torn down
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
