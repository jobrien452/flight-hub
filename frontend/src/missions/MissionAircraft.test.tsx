import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL } from '../api/client'
import { AuthProvider } from '../auth/AuthContext'
import { fixtureDrone, fixtureMission } from '../mocks/handlers'
import { PAYLOADS } from '../planning/payloads'
import { server } from '../mocks/server'
import type { Mission } from '../types/mission'
import { MissionAircraft } from './MissionAircraft'

const lr1 = PAYLOADS.find((p) => p.id === 'sony-ilx-lr1-24')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'flyby.session',
    JSON.stringify({ token: 'fake-token', user_id: 'admin-1', name: 'Ada Admin', role: 'admin' }),
  )
})

function renderPanel(overrides: Partial<Mission> = {}) {
  const mission: Mission = {
    ...fixtureMission,
    drone_id: fixtureDrone.id,
    payload: lr1,
    waypoints: [{ lat: 1, lng: 2, alt: 100 }],
    ...overrides,
  }
  render(
    <AuthProvider>
      <MissionAircraft mission={mission} />
    </AuthProvider>,
  )
}

describe('MissionAircraft', () => {
  it('names the aircraft booked on the mission', async () => {
    renderPanel()

    expect(await screen.findByText(fixtureDrone.name)).toBeInTheDocument()
    expect(screen.getByText(fixtureDrone.model)).toBeInTheDocument()
    expect(screen.getByText(fixtureDrone.serial)).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('shows the hours the airframe has on it', async () => {
    renderPanel()

    expect(await screen.findByText('12.5 h')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('names the payload and what it is built from', async () => {
    renderPanel()

    expect(await screen.findByText(lr1.name)).toBeInTheDocument()
    expect(screen.getByText(lr1.lens)).toBeInTheDocument()
    expect(screen.getByText(lr1.gimbal)).toBeInTheDocument()
    expect(screen.getByText('9504 x 6336 px')).toBeInTheDocument()
  })

  it('works the ground sample distance out at the altitude flown', async () => {
    renderPanel()

    // 100m on the 24mm lens, the same sum the editor shows while planning
    expect(await screen.findByText('1.57 cm/px')).toBeInTheDocument()
    expect(screen.getByText(/100 m/)).toBeInTheDocument()
  })

  it('adds the airframe figures for an aircraft flyby publishes', async () => {
    server.use(
      http.get(`${API_URL}/drones/:id`, () =>
        HttpResponse.json({ ...fixtureDrone, model: 'F-11T' }),
      ),
    )
    renderPanel()

    expect(await screen.findByText('56 min')).toBeInTheDocument()
    expect(screen.getByText('80 km/h')).toBeInTheDocument()
    expect(screen.getByText('5.7 lbs')).toBeInTheDocument()
  })

  it('keeps quiet about an airframe it has no figures for', async () => {
    renderPanel()

    await screen.findByText(fixtureDrone.model)
    expect(screen.queryByText('Max flight time')).not.toBeInTheDocument()
  })

  it('shows where the aircraft puts its video', async () => {
    server.use(
      http.get(`${API_URL}/drones/:id`, () =>
        HttpResponse.json({ ...fixtureDrone, stream_url: 'rtsp://192.168.35.1:8554/eo' }),
      ),
    )
    renderPanel()

    expect(await screen.findByText('rtsp://192.168.35.1:8554/eo')).toBeInTheDocument()
  })

  it('leaves the stream line out when there is none', async () => {
    renderPanel()

    await screen.findByText(fixtureDrone.name)
    expect(screen.queryByText('Video')).not.toBeInTheDocument()
  })

  it('says when nothing is booked yet', async () => {
    renderPanel({ drone_id: null, payload: null })

    expect(await screen.findByText(/no aircraft booked/i)).toBeInTheDocument()
    expect(screen.getByText(/no payload/i)).toBeInTheDocument()
  })

  it('stays up when the aircraft cannot be loaded', async () => {
    server.use(http.get(`${API_URL}/drones/:id`, () => new HttpResponse(null, { status: 404 })))
    renderPanel()

    // the payload rides on the mission itself, so it still has something to show
    expect(await screen.findByText(lr1.name)).toBeInTheDocument()
    expect(screen.getByText(/aircraft unavailable/i)).toBeInTheDocument()
  })
})
