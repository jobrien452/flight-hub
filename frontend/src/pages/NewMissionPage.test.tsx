import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'
import { NewMissionPage } from './NewMissionPage'

vi.mock('../missions/MissionPlanEditor', () => ({
  MissionPlanEditor: ({ onSubmit }: { onSubmit: (v: unknown) => void }) => (
    <button
      onClick={() =>
        onSubmit({
          name: 'Test Mission',
          status: 'draft',
          assignedPilotIds: [],
          waypoints: [],
          planParams: null,
        })
      }
    >
      submit
    </button>
  ),
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
})

describe('NewMissionPage', () => {
  it('creates a mission and navigates to its detail page', async () => {
    render(
      <MemoryRouter initialEntries={['/missions/new']}>
        <AuthProvider>
          <Routes>
            <Route path="/missions/new" element={<NewMissionPage />} />
            <Route path="/missions/:id" element={<div>Mission detail</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByText('submit'))

    expect(await screen.findByText('Mission detail')).toBeInTheDocument()
  })
})
