import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureMission } from '../mocks/handlers'
import { server } from '../mocks/server'
import { MissionDetailPage } from './MissionDetailPage'

vi.mock('../map/MapView', () => ({
  MapView: () => <div>map</div>,
}))

vi.mock('../missions/MissionPlanEditor', () => ({
  MissionPlanEditor: ({
    onSubmit,
    onPublish,
    error,
  }: {
    onSubmit: (v: unknown) => void
    onPublish?: (v: unknown) => void
    error: string | null
  }) => {
    const value = {
      name: 'Updated Name',
      assignedPilotIds: [],
      waypoints: [{ lat: 1, lng: 2, alt: 10 }],
      planParams: null,
    }
    return (
      <div>
        <button onClick={() => onSubmit(value)}>save</button>
        {onPublish && <button onClick={() => onPublish(value)}>publish</button>}
        {error && <p>{error}</p>}
      </div>
    )
  },
}))

beforeEach(() => {
  localStorage.clear()
})

function renderPage(session: Record<string, string>, search = '') {
  localStorage.setItem('flyby.session', JSON.stringify(session))
  return render(
    <MemoryRouter initialEntries={[`/missions/${fixtureMission.id}${search}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/missions/:id" element={<MissionDetailPage />} />
          <Route path="/missions/:id/plan" element={<h1>Assignment page</h1>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function serveMission(overrides: Record<string, unknown>) {
  server.use(
    http.get(`${API_URL}/missions/:id`, () =>
      HttpResponse.json({ ...fixtureMission, ...overrides }),
    ),
  )
}

const adminSession = { token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }
const pilotSession = { token: 'fake-token', user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }

describe('MissionDetailPage', () => {
  it('shows the mission name and status once loaded', async () => {
    renderPage(adminSession)
    expect(await screen.findByRole('heading', { name: fixtureMission.name })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(fixtureMission.status))).toBeInTheDocument()
  })

  it('shows Edit and Plan actions for admins', async () => {
    renderPage(adminSession)
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plan' })).toBeInTheDocument()
  })

  it('hides both actions from pilots', async () => {
    renderPage(pilotSession)
    await screen.findByRole('heading', { name: fixtureMission.name })
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Plan' })).not.toBeInTheDocument()
  })

  it('points Plan at the assignment page', async () => {
    renderPage(adminSession)
    expect(await screen.findByRole('link', { name: 'Plan' })).toHaveAttribute(
      'href',
      `/missions/${fixtureMission.id}/plan`,
    )
  })
})

describe('MissionDetailPage editing an assigned mission', () => {
  it('warns before editing a mission that already has pilots', async () => {
    renderPage(adminSession)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('already been assigned')
    expect(screen.queryByText('save')).not.toBeInTheDocument()
  })

  it('opens the editor once the warning is accepted', async () => {
    renderPage(adminSession)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit anyway' }))

    expect(screen.getByText('save')).toBeInTheDocument()
  })

  it('stays put when the warning is dismissed', async () => {
    renderPage(adminSession)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('save')).not.toBeInTheDocument()
  })

  it('skips the warning when nobody is assigned yet', async () => {
    serveMission({ assigned_pilot_ids: [] })
    renderPage(adminSession)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('save')).toBeInTheDocument()
  })

  it('opens straight into the editor when the warning was already given', async () => {
    renderPage(adminSession, '?edit=1')

    expect(await screen.findByText('save')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('saves changes from the editor and returns to view mode', async () => {
    serveMission({ assigned_pilot_ids: [] })
    renderPage(adminSession)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByText('save'))

    expect(await screen.findByRole('heading', { name: 'Updated Name' })).toBeInTheDocument()
  })
})

describe('MissionDetailPage publishing', () => {
  async function openEditor() {
    serveMission({ assigned_pilot_ids: [] })
    renderPage(adminSession)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  }

  it('offers the assignment page after a successful publish', async () => {
    await openEditor()
    await userEvent.click(screen.getByText('publish'))

    expect(await screen.findByRole('dialog')).toHaveTextContent('assign pilots')
  })

  it('goes to the assignment page when the offer is accepted', async () => {
    await openEditor()
    await userEvent.click(screen.getByText('publish'))
    await userEvent.click(await screen.findByRole('button', { name: 'Assign pilots' }))

    expect(await screen.findByRole('heading', { name: 'Assignment page' })).toBeInTheDocument()
  })

  it('stays on the mission when the offer is declined', async () => {
    await openEditor()
    await userEvent.click(screen.getByText('publish'))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText(/published/)).toBeInTheDocument()
  })

  it('reports a publish that fails', async () => {
    server.use(
      http.post(`${API_URL}/missions/:id/publish`, () => new HttpResponse(null, { status: 409 })),
    )
    await openEditor()
    await userEvent.click(screen.getByText('publish'))

    expect(await screen.findByText('Could not publish this mission')).toBeInTheDocument()
  })
})
