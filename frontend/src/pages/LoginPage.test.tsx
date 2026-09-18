import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { server } from '../mocks/server'
import { LoginPage } from './LoginPage'

beforeEach(() => {
  localStorage.clear()
})

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('says so when the door has been shut for too many tries', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({ detail: 'too many attempts' }, { status: 429 }),
      ),
    )
    renderLoginPage()

    await userEvent.type(screen.getByLabelText(/email/i), 'ada@flyby-robotics.dev')
    await userEvent.type(screen.getByLabelText(/password/i), 'whatever123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
  })

  it('logs in with correct credentials and stores a session', async () => {
    renderLoginPage()
    await userEvent.type(screen.getByLabelText('Email'), 'ada@flyby-robotics.dev')
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(localStorage.getItem('flyby.session')).toContain('Ada Admin')
    })
  })

  it('shows an error for wrong credentials and stores no session', async () => {
    renderLoginPage()
    await userEvent.type(screen.getByLabelText('Email'), 'ada@flyby-robotics.dev')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument()
    expect(localStorage.getItem('flyby.session')).toBeNull()
  })
})
