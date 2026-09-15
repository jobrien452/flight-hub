import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureMission } from '../mocks/handlers'
import { MissionsPage } from './MissionsPage'

beforeEach(() => {
  localStorage.clear()
})

function renderPage(session: Record<string, string>) {
  localStorage.setItem('flyby.session', JSON.stringify(session))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <MissionsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

const adminSession = { token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }
const pilotSession = { token: 'fake-token', user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }

describe('MissionsPage', () => {
  it('lists missions for the signed in user', async () => {
    renderPage(adminSession)
    expect(await screen.findByText(fixtureMission.name)).toBeInTheDocument()
  })

  it('shows a New Mission action for admins', async () => {
    renderPage(adminSession)
    expect(await screen.findByRole('link', { name: /new mission/i })).toBeInTheDocument()
  })

  it('hides the New Mission action for pilots', async () => {
    renderPage(pilotSession)
    await screen.findByText(fixtureMission.name)
    expect(screen.queryByRole('link', { name: /new mission/i })).not.toBeInTheDocument()
  })
})
