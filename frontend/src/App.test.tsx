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
