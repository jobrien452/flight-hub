import { describe, expect, it } from 'vitest'
import { getStats } from './stats'
import { fixtureStats } from '../mocks/handlers'

describe('getStats', () => {
  it('returns the dashboard numbers', async () => {
    expect(await getStats('fake-token')).toEqual(fixtureStats)
  })
})
