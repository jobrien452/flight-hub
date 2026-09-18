import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { API_URL, apiFetch } from './client'
import { loadSession, storeSession } from '../auth/session'
import { server } from '../mocks/server'

beforeEach(() => {
  localStorage.clear()
})

describe('a session the server has ended', () => {
  it('clears the stored session when a call comes back 401', async () => {
    storeSession({ token: 'stale', user_id: 'u1', name: 'Ada', role: 'admin' })
    server.use(http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })))

    await expect(apiFetch('/users/me', 'stale')).rejects.toThrow()

    expect(loadSession()).toBeNull()
  })

  it('leaves the session alone for any other failure', async () => {
    storeSession({ token: 'good', user_id: 'u1', name: 'Ada', role: 'admin' })
    server.use(http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 500 })))

    await expect(apiFetch('/users/me', 'good')).rejects.toThrow()

    expect(loadSession()).not.toBeNull()
  })

  it('does not touch storage when signing in is what failed', async () => {
    storeSession({ token: 'good', user_id: 'u1', name: 'Ada', role: 'admin' })
    server.use(
      http.post(`${API_URL}/auth/login`, () => new HttpResponse(null, { status: 401 })),
    )

    await expect(apiFetch('/auth/login', undefined, { method: 'POST' })).rejects.toThrow()

    // a rejected sign in says nothing about the session already in the browser
    expect(loadSession()).not.toBeNull()
  })
})
