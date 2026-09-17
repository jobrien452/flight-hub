import { describe, expect, it } from 'vitest'
import { createDrone, deleteDrone, getDrone, listDrones, updateDrone } from './drones'
import { fixtureDrone } from '../mocks/handlers'

const token = 'fake-token'

describe('listDrones', () => {
  it('returns the fleet', async () => {
    expect(await listDrones(token)).toEqual([fixtureDrone])
  })
})

describe('getDrone', () => {
  it('returns one drone by id', async () => {
    expect(await getDrone(fixtureDrone.id, token)).toEqual(fixtureDrone)
  })

  it('throws for a drone that is not there', async () => {
    await expect(getDrone('nope', token)).rejects.toThrow()
  })
})

describe('createDrone', () => {
  it('posts a new drone and returns the created record', async () => {
    const drone = await createDrone({ name: 'Falcon 2', model: 'Mavic 3E' }, token)
    expect(drone.name).toBe('Falcon 2')
  })
})

describe('updateDrone', () => {
  it('patches a drone and returns the updated record', async () => {
    const drone = await updateDrone(fixtureDrone.id, { status: 'maintenance' }, token)
    expect(drone.status).toBe('maintenance')
  })
})

describe('deleteDrone', () => {
  it('deletes a drone without error', async () => {
    await expect(deleteDrone(fixtureDrone.id, token)).resolves.toBeUndefined()
  })
})
