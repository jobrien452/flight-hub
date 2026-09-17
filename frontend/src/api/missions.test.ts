import { describe, expect, it } from 'vitest'
import {
  acknowledgeMission,
  assignPilot,
  createMission,
  deleteMission,
  getMission,
  listMissions,
  publishMission,
  startMission,
  unassignPilot,
  updateMission,
} from './missions'
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
    const mission = await updateMission(fixtureMission.id, { name: 'Renamed' }, token)
    expect(mission.name).toBe('Renamed')
  })
})

describe('deleteMission', () => {
  it('deletes a mission without error', async () => {
    await expect(deleteMission(fixtureMission.id, token)).resolves.toBeUndefined()
  })
})

describe('publishMission', () => {
  it('moves the mission to published', async () => {
    const mission = await publishMission(fixtureMission.id, token)
    expect(mission.status).toBe('published')
  })
})

describe('assignPilot', () => {
  it('returns the mission with the pilot added', async () => {
    const mission = await assignPilot(fixtureMission.id, 'pilot-2', 'Wheels up at 7', token)
    expect(mission.assigned_pilot_ids).toContain('pilot-2')
  })
})

describe('unassignPilot', () => {
  it('returns the mission with the pilot removed', async () => {
    const mission = await unassignPilot(fixtureMission.id, 'pilot-1', 'Weather scrubbed it', token)
    expect(mission.assigned_pilot_ids).not.toContain('pilot-1')
  })
})

describe('acknowledgeMission', () => {
  it('moves the mission to acknowledged', async () => {
    const mission = await acknowledgeMission(fixtureMission.id, token)
    expect(mission.status).toBe('acknowledged')
  })
})

describe('startMission', () => {
  it('moves the mission to in flight', async () => {
    const mission = await startMission(fixtureMission.id, token)
    expect(mission.status).toBe('in_flight')
  })
})
