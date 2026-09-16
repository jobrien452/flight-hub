import { http, HttpResponse } from 'msw'
import { API_URL } from '../api/client'
import type { Mission } from '../types/mission'
import type { MissionReport } from '../types/missionReport'
import type { User } from '../types/user'

export const fixtureMission: Mission = {
  id: 'mission-1',
  name: 'Survey Site A',
  status: 'draft',
  owner_id: 'admin-1',
  assigned_pilot_ids: ['pilot-1'],
  waypoints: [{ lat: 1, lng: 2, alt: 10 }],
  plan_params: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const fixtureReport: MissionReport = {
  id: 'report-1',
  mission_id: fixtureMission.id,
  pilot_id: 'pilot-1',
  status: 'in_progress',
  notes: '',
  data: {},
  submitted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const fixtureUsers: User[] = [
  { id: 'admin-1', name: 'Ada Admin', email: 'ada@flyby-robotics.dev', role: 'admin', has_password: true },
  { id: 'pilot-1', name: 'Pete Pilot', email: 'pete@flyby-robotics.dev', role: 'pilot', has_password: true },
  { id: 'pilot-2', name: 'Priya Pilot', email: 'priya@flyby-robotics.dev', role: 'pilot', has_password: true },
]

export const handlers = [
  http.get(`${API_URL}/users`, ({ request }) => {
    const role = new URL(request.url).searchParams.get('role')
    const users = role ? fixtureUsers.filter((u) => u.role === role) : fixtureUsers
    return HttpResponse.json(users)
  }),

  http.get(`${API_URL}/missions`, () => HttpResponse.json([fixtureMission])),

  http.get(`${API_URL}/missions/:id`, ({ params }) => {
    if (params.id !== fixtureMission.id) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(fixtureMission)
  }),

  http.post(`${API_URL}/missions`, async ({ request }) => {
    const body = (await request.json()) as Partial<Mission>
    return HttpResponse.json(
      { ...fixtureMission, id: 'mission-2', name: body.name ?? 'Untitled' },
      { status: 201 },
    )
  }),

  http.patch(`${API_URL}/missions/:id`, async ({ request }) => {
    const body = (await request.json()) as Partial<Mission>
    return HttpResponse.json({ ...fixtureMission, ...body })
  }),

  http.post(`${API_URL}/missions/:id/publish`, () =>
    HttpResponse.json({ ...fixtureMission, status: 'published' }),
  ),

  http.post(`${API_URL}/missions/:id/assignments`, async ({ request }) => {
    const body = (await request.json()) as { pilot_id: string }
    return HttpResponse.json({
      ...fixtureMission,
      assigned_pilot_ids: [...fixtureMission.assigned_pilot_ids, body.pilot_id],
    })
  }),

  http.delete(`${API_URL}/missions/:id/assignments/:pilotId`, ({ params }) =>
    HttpResponse.json({
      ...fixtureMission,
      assigned_pilot_ids: fixtureMission.assigned_pilot_ids.filter((p) => p !== params.pilotId),
    }),
  ),

  http.delete(`${API_URL}/missions/:id`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    if (body.email !== 'ada@flyby-robotics.dev' || body.password !== 'correct-horse') {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json({
      token: 'fake-token',
      user_id: 'admin-1',
      name: 'Ada Admin',
      role: 'admin',
    })
  }),

  http.post(`${API_URL}/auth/accept-invite`, async ({ request }) => {
    const body = (await request.json()) as { token: string; password: string }
    if (body.token !== 'good-invite-token') {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({
      token: 'fake-token',
      user_id: 'pilot-1',
      name: 'Pete Pilot',
      role: 'pilot',
    })
  }),

  http.post(`${API_URL}/auth/request-password-reset`, () => HttpResponse.json({ status: 'ok' })),

  http.get(`${API_URL}/missions/:missionId/reports`, ({ params }) => {
    if (params.missionId !== fixtureMission.id) return HttpResponse.json([])
    return HttpResponse.json([fixtureReport])
  }),

  http.post(`${API_URL}/missions/:missionId/reports`, async ({ request }) => {
    const body = (await request.json()) as Partial<MissionReport>
    return HttpResponse.json({ ...fixtureReport, id: 'report-2', ...body }, { status: 201 })
  }),

  http.patch(`${API_URL}/missions/:missionId/reports/:reportId`, async ({ request }) => {
    const body = (await request.json()) as Partial<MissionReport>
    return HttpResponse.json({ ...fixtureReport, ...body })
  }),

  http.post(`${API_URL}/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as { token: string; password: string }
    if (body.token !== 'good-reset-token') {
      return new HttpResponse(null, { status: 400 })
    }
    return HttpResponse.json({ status: 'ok' })
  }),
]
