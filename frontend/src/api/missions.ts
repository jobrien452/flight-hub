import type { Mission, MissionCreateInput, MissionUpdateInput } from '../types/mission'

// stubs, tests in missions.test.ts define the contract

export async function listMissions(_token: string): Promise<Mission[]> {
  throw new Error('not implemented')
}

export async function getMission(_id: string, _token: string): Promise<Mission> {
  throw new Error('not implemented')
}

export async function createMission(
  _payload: MissionCreateInput,
  _token: string,
): Promise<Mission> {
  throw new Error('not implemented')
}

export async function updateMission(
  _id: string,
  _payload: MissionUpdateInput,
  _token: string,
): Promise<Mission> {
  throw new Error('not implemented')
}

export async function deleteMission(_id: string, _token: string): Promise<void> {
  throw new Error('not implemented')
}
