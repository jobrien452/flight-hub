import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureMission } from '../mocks/handlers'
import { MissionDetailPage } from './MissionDetailPage'

vi.mock('../map/MapView', () => ({
  MapView: () => <div>map</div>,
}))

vi.mock('../missions/MissionPlanEditor', () => ({
  MissionPlanEditor: ({ onSubmit }: { onSubmit: (v: unknown) => void }) => (
    <button
      onClick={() =>
        onSubmit({
          name: 'Updated Name',
          status: 'planned',
          assignedPilotIds: [],
          waypoints: [],
          planParams: null,
        })
      }
    >
      save
    </button>
  ),
}))

beforeEach(() => {
  localStorage.clear()
})

function renderPage(session: Record<string, string>) {
  localStorage.setItem('flyby.session', JSON.stringify(session))
  return render(
    <MemoryRouter initialEntries={[`/missions/${fixtureMission.id}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/missions/:id" element={<MissionDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
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

  it('shows an Edit action for admins only', async () => {
    renderPage(adminSession)
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('hides the Edit action for pilots', async () => {
    renderPage(pilotSession)
    await screen.findByRole('heading', { name: fixtureMission.name })
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('saves changes from the editor and returns to view mode', async () => {
    renderPage(adminSession)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByText('save'))

    expect(await screen.findByRole('heading', { name: 'Updated Name' })).toBeInTheDocument()
  })
})
