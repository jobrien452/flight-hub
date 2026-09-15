import { describe, expect, it } from 'vitest'
import { mapTools } from './MapTool'

describe('tool registry', () => {
  it('exposes a waypoint tool', () => {
    expect(mapTools.some((t) => t.id === 'waypoint')).toBe(true)
  })

  it('exposes a rectangle survey tool', () => {
    expect(mapTools.some((t) => t.id === 'rectangle_survey')).toBe(true)
  })

  it('each tool conforms to the MapTool shape', () => {
    for (const tool of mapTools) {
      expect(typeof tool.id).toBe('string')
      expect(typeof tool.label).toBe('string')
      expect(typeof tool.icon).toBe('string')
      expect(typeof tool.onActivate).toBe('function')
      expect(typeof tool.onDeactivate).toBe('function')
      expect(typeof tool.onMapClick).toBe('function')
      expect(typeof tool.renderOverlay).toBe('function')
    }
  })
})
