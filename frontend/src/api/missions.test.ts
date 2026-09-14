import { describe, expect, it } from 'vitest'
import { createMission, deleteMission, getMission, listMissions, updateMission } from './missions'
import { fixtureMission } from '../mocks/handlers'

const token = 'fake-token'

describe('listMissions', () => {
  it('returns the list of missions', async () => {
    const missions = await listMissions(token)
    expect(missions).toEqual([fixtureMission])
  })
})

describe('getMission', () => {
  it('returns a single mission by id', async () => {
    const mission = await getMission(fixtureMission.id, token)
    expect(mission).toEqual(fixtureMission)
  })

  it('throws for a missing mission', async () => {
    await expect(getMission('nope', token)).rejects.toThrow()
  })
})

describe('createMission', () => {
  it('posts a new mission and returns the created record', async () => {
    const mission = await createMission({ name: 'New Survey' }, token)
    expect(mission.name).toBe('New Survey')
  })
})

describe('updateMission', () => {
  it('patches a mission and returns the updated record', async () => {
    const mission = await updateMission(fixtureMission.id, { status: 'planned' }, token)
    expect(mission.status).toBe('planned')
  })
})

describe('deleteMission', () => {
  it('deletes a mission without error', async () => {
    await expect(deleteMission(fixtureMission.id, token)).resolves.toBeUndefined()
  })
})
