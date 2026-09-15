import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
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
