import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureDrone } from '../mocks/handlers'
import { server } from '../mocks/server'
import { FleetPage } from './FleetPage'

const adminSession = { token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }
const pilotSession = { token: 'fake-token', user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }

beforeEach(() => {
  localStorage.clear()
})

function renderPage(session: Record<string, string> = adminSession) {
  localStorage.setItem('flyby.session', JSON.stringify(session))
  render(
    <MemoryRouter>
      <AuthProvider>
        <FleetPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('FleetPage', () => {
  it('lists the fleet with its running totals', async () => {
    renderPage()

    expect(await screen.findByText(fixtureDrone.name)).toBeInTheDocument()
    expect(screen.getByText('Matrice 350 RTK')).toBeInTheDocument()
    expect(screen.getByText('12.5')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('says so when the fleet is empty', async () => {
    server.use(http.get(`${API_URL}/drones`, () => HttpResponse.json([])))
    renderPage()

    expect(await screen.findByText(/no drones yet/i)).toBeInTheDocument()
  })

  it('adds a drone to the fleet', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /add drone/i }))
    const dialog = within(screen.getByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/name/i), 'Falcon 2')
    await userEvent.type(dialog.getByLabelText(/model/i), 'Mavic 3E')
    await userEvent.click(dialog.getByRole('button', { name: /add drone/i }))

    expect(await screen.findByText('Falcon 2')).toBeInTheDocument()
  })

  it('offers the flyby models on the model field', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /add drone/i }))
    const input = within(screen.getByRole('dialog')).getByLabelText(/model/i)
    const listId = input.getAttribute('list')
    expect(listId).toBeTruthy()

    const list = document.getElementById(listId!)
    expect(list).not.toBeNull()
    expect(list!.querySelector('option[value="F-11T"]')).not.toBeNull()
    expect(list!.querySelector('option[value="F-11S"]')).not.toBeNull()
  })

  it('takes a drone out of rotation', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.selectOptions(screen.getByLabelText(/status for falcon 1/i), 'maintenance')

    expect(await screen.findByDisplayValue('maintenance')).toBeInTheDocument()
  })

  it('removes a drone once the admin confirms', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /remove falcon 1/i }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))

    await expect(screen.findByText(/no drones yet/i)).resolves.toBeInTheDocument()
  })

  it('explains why a drone that is flying cannot be removed', async () => {
    server.use(
      http.delete(`${API_URL}/drones/:id`, () => new HttpResponse(null, { status: 409 })),
    )
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /remove falcon 1/i }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText(/out on a mission/i)).toBeInTheDocument()
  })

  it('shows a pilot their aircraft without the fleet controls', async () => {
    renderPage(pilotSession)

    expect(await screen.findByText(fixtureDrone.name)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add drone/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove falcon 1/i })).not.toBeInTheDocument()
  })
})
