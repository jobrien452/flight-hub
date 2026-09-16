import { describe, expect, it } from 'vitest'
import { createRectangleSurveyTool, mapTools } from './MapTool'

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

describe('rectangle survey overlay', () => {
  function placedTool(clicks: number) {
    const tool = createRectangleSurveyTool({ altitude: 50, spacing: 20 }, () => {})
    const points = [
      { lng: 10, lat: 20 },
      { lng: 10.002, lat: 20 },
      { lng: 10.002, lat: 20.001 },
      { lng: 10, lat: 20.001 },
    ]
    tool.onActivate()
    points.slice(0, clicks).forEach(tool.onMapClick)
    return tool
  }

  it('shows the corners already clicked before the box is closed', () => {
    const overlay = placedTool(2).renderOverlay()

    expect(overlay.markers).toHaveLength(2)
    expect(overlay.markers[0]).toEqual({ lat: 20, lng: 10 })
    expect(overlay.ghost).toBeUndefined()
  })

  it('shows the snapped box as a ghost once the fourth corner lands', () => {
    const overlay = placedTool(4).renderOverlay()

    expect(overlay.ghost).toHaveLength(4)
    expect(overlay.markers).toEqual(overlay.ghost)
  })

  it('clears the overlay when the tool is reactivated', () => {
    const tool = placedTool(2)
    tool.onActivate()

    expect(tool.renderOverlay().markers).toHaveLength(0)
  })
})
