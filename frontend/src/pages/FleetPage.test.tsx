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

  it('takes a video stream url with a new drone', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /add drone/i }))
    const dialog = within(screen.getByRole('dialog'))
    await userEvent.type(dialog.getByLabelText(/name/i), 'Falcon 2')
    await userEvent.type(dialog.getByLabelText(/stream/i), 'rtsp://192.168.35.1:8554/eo')
    await userEvent.click(dialog.getByRole('button', { name: /add drone/i }))

    expect(await screen.findByText('Falcon 2')).toBeInTheDocument()
  })

  it('keeps status off the table, it is set in the edit window', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    expect(screen.queryByLabelText(/status for/i)).not.toBeInTheDocument()
    expect(screen.getByText('available')).toBeInTheDocument()
  })

  it('renames a drone from the edit window', async () => {
    server.use(
      http.patch(`${API_URL}/drones/:id`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...fixtureDrone, ...body })
      }),
    )
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /edit falcon 1/i }))
    const dialog = within(screen.getByRole('dialog'))
    await userEvent.clear(dialog.getByLabelText(/name/i))
    await userEvent.type(dialog.getByLabelText(/name/i), 'Falcon One')
    await userEvent.click(dialog.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Falcon One')).toBeInTheDocument()
  })

  it('takes a drone out of rotation from the edit window', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /edit falcon 1/i }))
    const dialog = within(screen.getByRole('dialog'))
    await userEvent.selectOptions(dialog.getByLabelText(/status/i), 'maintenance')
    await userEvent.click(dialog.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('maintenance')).toBeInTheDocument()
  })

  it('says an aircraft that has flown is kept for its history', async () => {
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /remove falcon 1/i }))

    // the fixture has 8 missions on it, so this one cannot simply go
    expect(screen.getByRole('dialog')).toHaveTextContent(/retired/i)
    expect(screen.getByRole('dialog')).toHaveTextContent(/8 missions/i)
  })

  it('says a drone with no history is gone for good', async () => {
    server.use(
      http.get(`${API_URL}/drones`, () =>
        HttpResponse.json([{ ...fixtureDrone, missions_flown: 0, flight_hours: 0 }]),
      ),
    )
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /remove falcon 1/i }))

    expect(screen.getByRole('dialog')).toHaveTextContent(/permanently/i)
  })

  it('warns that a booked mission goes back to draft', async () => {
    server.use(
      http.get(`${API_URL}/drones`, () =>
        HttpResponse.json([{ ...fixtureDrone, booked_on: 'mission-1' }]),
      ),
    )
    renderPage()
    await screen.findByText(fixtureDrone.name)

    await userEvent.click(screen.getByRole('button', { name: /remove falcon 1/i }))

    expect(screen.getByRole('dialog')).toHaveTextContent(/back to draft/i)
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
