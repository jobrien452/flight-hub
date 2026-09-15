import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RequestPasswordResetPage } from './RequestPasswordResetPage'

describe('RequestPasswordResetPage', () => {
  it('shows a generic confirmation after submitting', async () => {
    render(
      <MemoryRouter>
        <RequestPasswordResetPage />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText('Email'), 'ada@flyby-robotics.dev')
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  })
})
