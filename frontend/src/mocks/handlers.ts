import { http, HttpResponse } from 'msw'
import { API_URL } from '../api/client'
import type { ApiToken } from '../types/apiToken'
import type { Drone } from '../types/drone'
import type { Mission, MissionSummary } from '../types/mission'
import type { MissionReport } from '../types/missionReport'
import type { DashboardStats } from '../types/stats'
import type { User } from '../types/user'

export const fixtureMission: Mission = {
  id: 'mission-1',
  name: 'Survey Site A',
  status: 'draft',
  owner_id: 'admin-1',
  assigned_pilot_ids: ['pilot-1'],
  drone_id: null,
  waypoint_count: 1,
  payload: null,
  waypoints: [{ lat: 1, lng: 2, alt: 10 }],
  plan_params: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// what the list route actually returns, the route itself is not on it
export const fixtureMissionSummary: MissionSummary = {
  id: fixtureMission.id,
  name: fixtureMission.name,
  status: fixtureMission.status,
  owner_id: fixtureMission.owner_id,
  assigned_pilot_ids: fixtureMission.assigned_pilot_ids,
  drone_id: fixtureMission.drone_id,
  waypoint_count: fixtureMission.waypoint_count,
  created_at: fixtureMission.created_at,
  updated_at: fixtureMission.updated_at,
}

export const fixtureDrone: Drone = {
  id: 'drone-1',
  name: 'Falcon 1',
  model: 'Matrice 350 RTK',
  serial: 'SN-001',
  stream_url: '',
  status: 'available',
  owner_id: 'admin-1',
  flight_hours: 12.5,
  missions_flown: 8,
  booked_on: null,
  hidden: false,
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

export const fixtureStats: DashboardStats = {
  missions_total: 7,
  missions_by_status: {
    draft: 2,
    published: 1,
    acknowledged: 1,
    in_flight: 0,
    completed: 3,
  },
  drones_total: 2,
  drones_by_status: { available: 1, in_flight: 0, maintenance: 1, retired: 0 },
  fleet_flight_hours: 14.75,
  fleet_missions_flown: 9,
  pilots: [
    {
      pilot_id: 'pilot-1',
      name: 'Pete Pilot',
      email: 'pete@flyby-robotics.dev',
      missions_assigned: 4,
      reports_submitted: 3,
      flight_hours: 6.5,
    },
    {
      pilot_id: 'pilot-2',
      name: 'Priya Pilot',
      email: 'priya@flyby-robotics.dev',
      missions_assigned: 1,
      reports_submitted: 0,
      flight_hours: 0,
    },
  ],
}

export const fixtureUsers: User[] = [
  { id: 'admin-1', name: 'Ada Admin', email: 'ada@flyby-robotics.dev', role: 'admin', has_password: true },
  { id: 'pilot-1', name: 'Pete Pilot', email: 'pete@flyby-robotics.dev', role: 'pilot', has_password: true },
  { id: 'pilot-2', name: 'Priya Pilot', email: 'priya@flyby-robotics.dev', role: 'pilot', has_password: true },
]

export const fixtureApiToken: ApiToken = {
  id: 'token-1',
  name: 'CI pipeline',
  prefix: 'flyby_abc123',
  created_at: '2026-01-01T00:00:00Z',
  last_used_at: null,
}

export const handlers = [
  http.get(`${API_URL}/users/me`, () => HttpResponse.json(fixtureUsers[0])),

  http.get(`${API_URL}/api-tokens`, () => HttpResponse.json([fixtureApiToken])),

  http.post(`${API_URL}/api-tokens`, async ({ request }) => {
    const body = (await request.json()) as { name: string }
    return HttpResponse.json(
      {
        ...fixtureApiToken,
        id: 'token-2',
        name: body.name,
        token: 'flyby_supersecretvalue',
      },
      { status: 201 },
    )
  }),

  http.delete(`${API_URL}/api-tokens/:id`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API_URL}/openapi.json`, () =>
    HttpResponse.json({
      openapi: '3.1.0',
      info: { title: 'Flyby Mission Planner', version: '0.1.0' },
      paths: {},
    }),
  ),

  http.get(`${API_URL}/users`, ({ request }) => {
    const role = new URL(request.url).searchParams.get('role')
    const users = role ? fixtureUsers.filter((u) => u.role === role) : fixtureUsers
    return HttpResponse.json(users)
  }),

  http.get(`${API_URL}/config/map-token`, () =>
    HttpResponse.json({ token: 'pk.fixture-token' }),
  ),

  http.get(`${API_URL}/stats`, () => HttpResponse.json(fixtureStats)),

  http.get(`${API_URL}/drones`, () => HttpResponse.json([fixtureDrone])),

  http.get(`${API_URL}/drones/:id`, ({ params }) => {
    if (params.id !== fixtureDrone.id) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(fixtureDrone)
  }),

  http.post(`${API_URL}/drones`, async ({ request }) => {
    const body = (await request.json()) as Partial<Drone>
    return HttpResponse.json({ ...fixtureDrone, id: 'drone-2', ...body }, { status: 201 })
  }),

  http.patch(`${API_URL}/drones/:id`, async ({ request }) => {
    const body = (await request.json()) as Partial<Drone>
    return HttpResponse.json({ ...fixtureDrone, ...body })
  }),

  http.delete(`${API_URL}/drones/:id`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API_URL}/missions`, () => HttpResponse.json([fixtureMissionSummary])),

  http.get(`${API_URL}/missions/:id/export`, ({ params }) => {
    if (params.id !== fixtureMission.id) return new HttpResponse(null, { status: 404 })
    return HttpResponse.text(
      ['QGC WPL 110', ['0', '1', '0', '16', '0', '0', '0', '0', '1', '2', '10', '1'].join('\t')].join(
        '\n',
      ),
    )
  }),

  http.get(`${API_URL}/missions/:id/waypoints`, ({ params }) => {
    if (params.id !== fixtureMission.id) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(fixtureMission.waypoints)
  }),

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

  http.post(`${API_URL}/missions/:id/acknowledge`, () =>
    HttpResponse.json({ ...fixtureMission, status: 'acknowledged' }),
  ),

  http.post(`${API_URL}/missions/:id/start`, () =>
    HttpResponse.json({ ...fixtureMission, status: 'in_flight' }),
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
