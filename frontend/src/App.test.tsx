import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

const session = {
  token: 'fake-token',
  user_id: 'admin-1',
  name: 'Ada Admin',
  role: 'admin',
}

beforeEach(() => {
  localStorage.clear()
})

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routing', () => {
  it('redirects to login when there is no session', () => {
    renderApp('/missions')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows the app shell and mission content for a signed in user', () => {
    localStorage.setItem('flyby.session', JSON.stringify(session))
    renderApp('/missions')
    expect(screen.getByText('FLYBY / MISSION CONTROL')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Missions' })).toBeInTheDocument()
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
  })

  it('redirects "/" to "/missions" for a signed in user', () => {
    localStorage.setItem('flyby.session', JSON.stringify(session))
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Missions' })).toBeInTheDocument()
  })
})

describe('dashboard', () => {
  it('opens the dashboard from the nav', async () => {
    localStorage.setItem('flyby.session', JSON.stringify(session))
    renderApp('/missions')

    await userEvent.click(screen.getByRole('link', { name: 'Dashboard' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('keeps the dashboard link away from pilots', () => {
    localStorage.setItem(
      'flyby.session',
      JSON.stringify({ ...session, user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }),
    )
    renderApp('/missions')

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
  })
})

describe('fleet', () => {
  it('opens the fleet from the nav', async () => {
    localStorage.setItem('flyby.session', JSON.stringify(session))
    renderApp('/missions')

    await userEvent.click(screen.getByRole('link', { name: 'Fleet' }))

    expect(await screen.findByRole('heading', { name: 'Fleet' })).toBeInTheDocument()
  })

  it('gives a pilot the aircraft they fly without the fleet controls', async () => {
    localStorage.setItem(
      'flyby.session',
      JSON.stringify({ ...session, user_id: 'pilot-1', name: 'Pete Pilot', role: 'pilot' }),
    )
    renderApp('/fleet')

    expect(await screen.findByRole('heading', { name: 'Fleet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add drone/i })).not.toBeInTheDocument()
  })
})

describe('sign out', () => {
  it('clears the session and returns to login', async () => {
    localStorage.setItem('flyby.session', JSON.stringify(session))
    renderApp('/missions')

    await userEvent.click(screen.getByRole('button', { name: /Ada Admin/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(localStorage.getItem('flyby.session')).toBeNull()
  })
})

describe('profile', () => {
  it('is reached from the user menu rather than the main navigation', async () => {
    localStorage.setItem('flyby.session', JSON.stringify(session))
    renderApp('/missions')

    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ada Admin/ }))
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument()
  })
})
