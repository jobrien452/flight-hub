import { describe, expect, it } from 'vitest'
import { createMissionReport, listMissionReports, updateMissionReport } from './missionReports'
import { fixtureMission, fixtureReport } from '../mocks/handlers'

const token = 'fake-token'

describe('listMissionReports', () => {
  it('returns reports for a mission', async () => {
    const reports = await listMissionReports(fixtureMission.id, token)
    expect(reports).toEqual([fixtureReport])
  })
})

describe('createMissionReport', () => {
  it('posts a new report for the current pilot', async () => {
    const report = await createMissionReport(fixtureMission.id, { notes: 'clean flight' }, token)
    expect(report.notes).toBe('clean flight')
  })
})

describe('updateMissionReport', () => {
  it('patches the pilots own report', async () => {
    const report = await updateMissionReport(
      fixtureMission.id,
      fixtureReport.id,
      { status: 'submitted' },
      token,
    )
    expect(report.status).toBe('submitted')
  })
})
