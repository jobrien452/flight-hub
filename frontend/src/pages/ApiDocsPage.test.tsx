import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { server } from '../mocks/server'
import { ApiDocsPage } from './ApiDocsPage'

const swaggerUIBundle = vi.fn()

// the real bundle needs a browser and weighs 1.5mb, only its input matters here
vi.mock('swagger-ui-dist', () => ({
  SwaggerUIBundle: (options: unknown) => swaggerUIBundle(options),
}))

vi.mock('swagger-ui-dist/swagger-ui.css', () => ({}))

beforeEach(() => {
  localStorage.clear()
  swaggerUIBundle.mockClear()
})

function renderPage(role = 'admin') {
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role }),
  )
  render(
    <MemoryRouter>
      <AuthProvider>
        <ApiDocsPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ApiDocsPage', () => {
  it('hands the fetched spec to swagger', async () => {
    renderPage()

    await vi.waitFor(() => expect(swaggerUIBundle).toHaveBeenCalled())
    const options = swaggerUIBundle.mock.calls[0][0]
    expect(options.spec).toMatchObject({ info: { title: 'Flyby Mission Planner' } })
  })

  it('signs try-it-out requests with the admin token', async () => {
    renderPage()

    await vi.waitFor(() => expect(swaggerUIBundle).toHaveBeenCalled())
    const { requestInterceptor } = swaggerUIBundle.mock.calls[0][0]
    const request = requestInterceptor({ headers: {} })

    expect(request.headers.Authorization).toBe('Bearer fake-token')
  })

  it('reports a spec the server refuses', async () => {
    server.use(
      http.get(`${API_URL}/openapi.json`, () => new HttpResponse(null, { status: 403 })),
    )
    renderPage()

    expect(await screen.findByText('Could not load the API spec')).toBeInTheDocument()
    expect(swaggerUIBundle).not.toHaveBeenCalled()
  })

  it('does not fetch the spec for a pilot', async () => {
    renderPage('pilot')

    expect(await screen.findByText(/admins/i)).toBeInTheDocument()
    expect(swaggerUIBundle).not.toHaveBeenCalled()
  })
})
