import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureUsers } from '../mocks/handlers'
import { MissionPlanEditor } from './MissionPlanEditor'

vi.mock('../map/MapView', () => ({
  MapView: ({ onMapClick }: { onMapClick: (p: { lng: number; lat: number }) => void }) => (
    <div>
      <button onClick={() => onMapClick({ lng: 10, lat: 20 })}>click A</button>
      <button onClick={() => onMapClick({ lng: 10.01, lat: 20.01 })}>click B</button>
    </div>
  ),
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
})

function renderEditor(onSubmit = vi.fn()) {
  render(
    <MemoryRouter>
      <AuthProvider>
        <MissionPlanEditor
          submitting={false}
          error={null}
          submitLabel="Create"
          onSubmit={onSubmit}
        />
      </AuthProvider>
    </MemoryRouter>,
  )
  return onSubmit
}

const pilot = fixtureUsers.find((u) => u.role === 'pilot')!

describe('MissionPlanEditor', () => {
  it('lists pilots to assign', async () => {
    renderEditor()
    expect(await screen.findByText(pilot.name)).toBeInTheDocument()
  })

  it('adds a waypoint when the map is clicked with the waypoint tool active', async () => {
    renderEditor()
    await userEvent.click(screen.getByText('click A'))
    expect(await screen.findByText('1 waypoints')).toBeInTheDocument()
  })

  it('generates a survey plan from two corner clicks', async () => {
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle Survey' }))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByText('click B'))

    await waitFor(() => {
      expect(screen.getByText(/waypoints/).textContent).not.toBe('0 waypoints')
    })
  })

  it('submits the current name, pilots, and waypoints', async () => {
    const onSubmit = renderEditor()
    await userEvent.type(screen.getByLabelText('Name'), 'Test Mission')
    await userEvent.click(await screen.findByText(pilot.name))
    await userEvent.click(screen.getByText('click A'))
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Mission',
        assignedPilotIds: [pilot.id],
        waypoints: [{ lat: 20, lng: 10, alt: 50 }],
      }),
    )
  })
})
