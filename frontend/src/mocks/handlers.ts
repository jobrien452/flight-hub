import { http, HttpResponse } from 'msw'
import { API_URL } from '../api/client'
import type { Mission } from '../types/mission'

export const fixtureMission: Mission = {
  id: 'mission-1',
  name: 'Survey Site A',
  status: 'draft',
  owner_id: 'admin-1',
  assigned_pilot_ids: ['pilot-1'],
  waypoints: [{ lat: 1, lng: 2, alt: 10 }],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const handlers = [
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

  http.post(`${API_URL}/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as { token: string; password: string }
    if (body.token !== 'good-reset-token') {
      return new HttpResponse(null, { status: 400 })
    }
    return HttpResponse.json({ status: 'ok' })
  }),
]
