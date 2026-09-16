import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureApiToken, fixtureUsers } from '../mocks/handlers'
import { server } from '../mocks/server'
import { ProfilePage } from './ProfilePage'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
})

function renderPage() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

const admin = fixtureUsers[0]

describe('ProfilePage', () => {
  it('shows who is signed in', async () => {
    renderPage()

    expect(await screen.findByText(admin.name)).toBeInTheDocument()
    expect(screen.getByText(admin.email)).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('lists the existing api tokens', async () => {
    renderPage()

    expect(await screen.findByText(fixtureApiToken.name)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(fixtureApiToken.prefix))).toBeInTheDocument()
  })

  it('says when a token has never been used', async () => {
    renderPage()

    expect(await screen.findByText('never')).toBeInTheDocument()
  })

  it('says so when there are no tokens yet', async () => {
    server.use(http.get(`${API_URL}/api-tokens`, () => HttpResponse.json([])))
    renderPage()

    expect(await screen.findByText('No API tokens yet.')).toBeInTheDocument()
  })
})

describe('ProfilePage creating a token', () => {
  async function createToken(name = 'Deploy bot') {
    renderPage()
    await screen.findByText(fixtureApiToken.name)
    await userEvent.type(screen.getByLabelText('Token name'), name)
    await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  }

  it('shows the secret once after creating it', async () => {
    await createToken()

    expect(await screen.findByText('flyby_supersecretvalue')).toBeInTheDocument()
  })

  it('warns that the secret will not be shown again', async () => {
    await createToken()

    expect(await screen.findByText(/only time/i)).toBeInTheDocument()
  })

  it('adds the new token to the list', async () => {
    await createToken()

    expect(await screen.findByText('Deploy bot')).toBeInTheDocument()
  })

  it('will not create a token without a name', async () => {
    renderPage()
    await screen.findByText(fixtureApiToken.name)

    expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled()
  })

  it('hides the secret again once dismissed', async () => {
    await createToken()
    await userEvent.click(await screen.findByRole('button', { name: 'Done' }))

    expect(screen.queryByText('flyby_supersecretvalue')).not.toBeInTheDocument()
  })

  it('reports a failure to create', async () => {
    server.use(
      http.post(`${API_URL}/api-tokens`, () => new HttpResponse(null, { status: 500 })),
    )
    await createToken()

    expect(await screen.findByText('Could not create the token')).toBeInTheDocument()
  })
})

describe('ProfilePage revoking a token', () => {
  it('asks before revoking', async () => {
    renderPage()
    await screen.findByText(fixtureApiToken.name)

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('stop working immediately')
  })

  it('drops the token from the list once confirmed', async () => {
    renderPage()
    await screen.findByText(fixtureApiToken.name)

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Revoke' }),
    )

    expect(await screen.findByText('No API tokens yet.')).toBeInTheDocument()
  })

  it('keeps the token when cancelled', async () => {
    renderPage()
    await screen.findByText(fixtureApiToken.name)

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText(fixtureApiToken.name)).toBeInTheDocument()
  })
})
