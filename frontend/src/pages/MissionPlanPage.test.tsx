import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureMission } from '../mocks/handlers'
import { MissionPlanPage } from './MissionPlanPage'

vi.mock('../map/MapView', () => ({
  MapView: () => <div>map</div>,
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
})

function renderPage() {
  render(
    <MemoryRouter initialEntries={[`/missions/${fixtureMission.id}/plan`]}>
      <AuthProvider>
        <Routes>
          <Route path="/missions/:id/plan" element={<MissionPlanPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function pilotRow(name: string) {
  return screen.getByRole('row', { name: new RegExp(name) })
}

describe('MissionPlanPage', () => {
  it('shows the mission name', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: fixtureMission.name })).toBeInTheDocument()
  })

  it('shows the plan summary', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    expect(screen.getByText('Waypoints').closest('div')).toHaveTextContent('1')
    expect(screen.getByText('Distance')).toBeInTheDocument()
    expect(screen.getByText('Est. flight time')).toBeInTheDocument()
    expect(screen.getByText('Altitude')).toBeInTheDocument()
  })

  it('lists every pilot with their assignment state', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    expect(within(pilotRow('Pete Pilot')).getByRole('button')).toHaveTextContent('Unassign')
    expect(within(pilotRow('Priya Pilot')).getByRole('button')).toHaveTextContent('Assign')
  })

  it('filters the pilot table by the search box', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    await userEvent.type(screen.getByPlaceholderText('Search pilots...'), 'priya')

    expect(screen.queryByText('Pete Pilot')).not.toBeInTheDocument()
    expect(screen.getByText('Priya Pilot')).toBeInTheDocument()
  })

  it('searches on email too', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    await userEvent.type(screen.getByPlaceholderText('Search pilots...'), 'pete@')

    expect(screen.getByText('Pete Pilot')).toBeInTheDocument()
    expect(screen.queryByText('Priya Pilot')).not.toBeInTheDocument()
  })

  it('asks for confirmation and an optional note before assigning', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    await userEvent.click(within(pilotRow('Priya Pilot')).getByRole('button'))

    expect(screen.getByRole('dialog')).toHaveTextContent('Assign Priya Pilot')
    expect(screen.getByLabelText('Message to the pilot')).toBeInTheDocument()
  })

  it('assigns the pilot once confirmed', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    await userEvent.click(within(pilotRow('Priya Pilot')).getByRole('button'))
    await userEvent.type(screen.getByLabelText('Message to the pilot'), 'Wheels up at 7')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Assign' }))

    expect(await within(pilotRow('Priya Pilot')).findByRole('button')).toHaveTextContent('Unassign')
  })

  it('keeps the pilot unassigned when the dialog is cancelled', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    await userEvent.click(within(pilotRow('Priya Pilot')).getByRole('button'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(pilotRow('Priya Pilot')).getByRole('button')).toHaveTextContent('Assign')
  })

  it('unassigns a pilot once confirmed', async () => {
    renderPage()
    await screen.findByRole('heading', { name: fixtureMission.name })

    await userEvent.click(within(pilotRow('Pete Pilot')).getByRole('button'))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Unassign' }),
    )

    expect(await within(pilotRow('Pete Pilot')).findByRole('button')).toHaveTextContent('Assign')
  })

  it('links back to the mission', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Back to mission' })).toHaveAttribute(
      'href',
      `/missions/${fixtureMission.id}`,
    )
  })
})
