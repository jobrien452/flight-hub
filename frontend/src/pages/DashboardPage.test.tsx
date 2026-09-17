import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { server } from '../mocks/server'
import { DashboardPage } from './DashboardPage'

const adminSession = { token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }

beforeEach(() => {
  localStorage.clear()
})

function renderPage(session: Record<string, string> = adminSession) {
  localStorage.setItem('flyby.session', JSON.stringify(session))
  render(
    <MemoryRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  it('leads with the headline numbers', async () => {
    renderPage()

    expect(await screen.findByText('Missions')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('14.75')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('breaks missions down by status', async () => {
    renderPage()
    await screen.findByText('Missions')

    const row = await screen.findByRole('row', { name: /completed/i })
    expect(within(row).getByText('3')).toBeInTheDocument()
  })

  it('sizes each bar against the biggest count', async () => {
    renderPage()
    await screen.findByText('Missions')

    const completed = within(await screen.findByRole('row', { name: /completed/i })).getByRole(
      'presentation',
    )
    const published = within(await screen.findByRole('row', { name: /published/i })).getByRole(
      'presentation',
    )

    // completed is the biggest of the five, so it fills the track
    expect(completed).toHaveStyle({ width: '100%' })
    expect(published).toHaveStyle({ width: '33.33333333333333%' })
  })

  it('lists what each pilot has flown', async () => {
    renderPage()
    await screen.findByText('Missions')

    const row = await screen.findByRole('row', { name: /Pete Pilot/ })
    expect(within(row).getByText('6.5')).toBeInTheDocument()
    expect(within(row).getByText('3')).toBeInTheDocument()
  })

  it('reports a dashboard the server refuses', async () => {
    server.use(http.get(`${API_URL}/stats`, () => new HttpResponse(null, { status: 403 })))
    renderPage()

    expect(await screen.findByText(/could not load/i)).toBeInTheDocument()
  })

  it('keeps the dashboard to admins', async () => {
    renderPage({ ...adminSession, role: 'pilot' })

    expect(await screen.findByText(/admins/i)).toBeInTheDocument()
  })
})
