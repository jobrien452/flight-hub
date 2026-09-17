import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureMission, fixtureReport } from '../mocks/handlers'
import { server } from '../mocks/server'
import type { Mission, MissionStatus } from '../types/mission'
import { PilotMissionPanel } from './PilotMissionPanel'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }),
  )
})

function noReports() {
  server.use(http.get(`${API_URL}/missions/:missionId/reports`, () => HttpResponse.json([])))
}

function renderPanel(status: MissionStatus, onMissionChange = vi.fn()) {
  const mission: Mission = { ...fixtureMission, status }
  render(
    <AuthProvider>
      <PilotMissionPanel mission={mission} onMissionChange={onMissionChange} />
    </AuthProvider>,
  )
  return onMissionChange
}

describe('PilotMissionPanel', () => {
  it('offers acknowledge and start on a published mission', async () => {
    noReports()
    renderPanel('published')

    expect(await screen.findByRole('button', { name: /acknowledge/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start flight/i })).toBeInTheDocument()
  })

  it('hands back the mission after acknowledging it', async () => {
    noReports()
    const onMissionChange = renderPanel('published')

    await userEvent.click(await screen.findByRole('button', { name: /acknowledge/i }))

    await vi.waitFor(() =>
      expect(onMissionChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'acknowledged' }),
      ),
    )
  })

  it('drops acknowledge once the mission is already acknowledged', async () => {
    noReports()
    renderPanel('acknowledged')

    expect(await screen.findByRole('button', { name: /start flight/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /acknowledge/i })).not.toBeInTheDocument()
  })

  it('shows the report form once the mission is in flight', async () => {
    noReports()
    renderPanel('in_flight')

    expect(await screen.findByLabelText(/flight time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument()
  })

  it('submits the report with what the pilot filled in', async () => {
    noReports()
    const posted: Record<string, unknown>[] = []
    server.use(
      http.post(`${API_URL}/missions/:missionId/reports`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        return HttpResponse.json({ ...fixtureReport, ...body }, { status: 201 })
      }),
    )
    renderPanel('in_flight')

    await userEvent.type(await screen.findByLabelText(/flight time/i), '18')
    await userEvent.type(screen.getByLabelText(/notes/i), 'clean run')
    await userEvent.click(screen.getByRole('button', { name: /submit report/i }))

    await vi.waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      status: 'submitted',
      notes: 'clean run',
      data: { duration_minutes: 18 },
    })
  })

  it('patches the report the pilot already started instead of filing a second one', async () => {
    const patched: string[] = []
    server.use(
      http.patch(`${API_URL}/missions/:missionId/reports/:reportId`, ({ params }) => {
        patched.push(String(params.reportId))
        return HttpResponse.json({ ...fixtureReport, status: 'submitted' })
      }),
    )
    renderPanel('in_flight')

    await userEvent.click(await screen.findByRole('button', { name: /submit report/i }))

    await vi.waitFor(() => expect(patched).toEqual([fixtureReport.id]))
  })

  it('shows a submitted report read only', async () => {
    server.use(
      http.get(`${API_URL}/missions/:missionId/reports`, () =>
        HttpResponse.json([
          {
            ...fixtureReport,
            status: 'submitted',
            notes: 'all photos captured',
            submitted_at: '2026-02-02T10:00:00Z',
          },
        ]),
      ),
    )
    renderPanel('completed')

    expect(await screen.findByText('all photos captured')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit report/i })).not.toBeInTheDocument()
  })

  it('has nothing for a pilot to do on a draft', async () => {
    noReports()
    renderPanel('draft')

    expect(await screen.findByText(/not been published/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start flight/i })).not.toBeInTheDocument()
  })
})
