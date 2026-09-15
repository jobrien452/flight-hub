import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ResetPasswordPage } from './ResetPasswordPage'

describe('ResetPasswordPage', () => {
  it('resets the password for a valid token and redirects to login', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=good-reset-token']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('New password'), 'fresher-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('Login screen')).toBeInTheDocument()
  })

  it('shows an error for an invalid token', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=bad-token']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('New password'), 'fresher-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText(/reset link is invalid or expired/i)).toBeInTheDocument()
  })
})
