import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { server } from '../mocks/server'
import { useMapToken } from './useMapToken'

function Probe() {
  const { token, state } = useMapToken()
  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="token">{token ?? ''}</span>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
})

function signedIn() {
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
}

describe('useMapToken', () => {
  it('fetches the token for a signed in user', async () => {
    signedIn()
    render(<Probe />)

    expect(await screen.findByText('pk.fixture-token')).toBeInTheDocument()
    expect(screen.getByTestId('state')).toHaveTextContent('ready')
  })

  it('starts out loading rather than claiming the token is missing', () => {
    signedIn()
    render(<Probe />)

    expect(screen.getByTestId('state')).toHaveTextContent('loading')
  })

  it('reports a server with no token configured', async () => {
    signedIn()
    server.use(
      http.get(`${API_URL}/config/map-token`, () => new HttpResponse(null, { status: 503 })),
    )
    render(<Probe />)

    expect(await screen.findByText('unavailable')).toBeInTheDocument()
  })

  it('does not call out at all when nobody is signed in', async () => {
    render(<Probe />)

    expect(await screen.findByText('unavailable')).toBeInTheDocument()
    expect(screen.getByTestId('token')).toHaveTextContent('')
  })
})
