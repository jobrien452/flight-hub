import { distance } from '@turf/turf'
import { describe, expect, it, vi } from 'vitest'
import type { Waypoint } from '../types/mission'
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

  // ghost comes back as [SW, SE, NE, NW]
  function widthOf(box: Waypoint[]) {
    return distance([box[0].lng, box[0].lat], [box[1].lng, box[1].lat], { units: 'meters' })
  }

  it('resizes the box from the opposite corner when a handle is dragged', () => {
    const tool = placedTool(4)
    const before = tool.renderOverlay().ghost!

    tool.onHandleDragStart(2)
    tool.onHandleDrag({ lng: 10.004, lat: 20.002 })
    tool.onHandleDragEnd()
    const after = tool.renderOverlay().ghost!

    expect(after[0]).toEqual(before[0])
    expect(widthOf(after)).toBeGreaterThan(widthOf(before))
  })

  it('keeps the resized box snapped to a clean size', () => {
    const tool = placedTool(4)

    tool.onHandleDragStart(2)
    tool.onHandleDrag({ lng: 10.00317, lat: 20.00143 })
    tool.onHandleDragEnd()

    expect(Math.round(widthOf(tool.renderOverlay().ghost!)) % 10).toBe(0)
  })

  it('reports the resized box so the survey has to be regenerated', () => {
    const onChange = vi.fn()
    const tool = createRectangleSurveyTool({ altitude: 50, spacing: 20 }, onChange)
    tool.onActivate()
    ;[
      { lng: 10, lat: 20 },
      { lng: 10.002, lat: 20 },
      { lng: 10.002, lat: 20.001 },
      { lng: 10, lat: 20.001 },
    ].forEach(tool.onMapClick)
    onChange.mockClear()

    tool.onHandleDragStart(2)
    tool.onHandleDrag({ lng: 10.004, lat: 20.002 })

    expect(onChange).toHaveBeenCalledWith(
      tool.renderOverlay().ghost,
      expect.objectContaining({ type: 'survey' }),
    )
  })

  it('ignores a drag when no handle was grabbed', () => {
    const tool = placedTool(4)
    const before = tool.renderOverlay().ghost!

    tool.onHandleDrag({ lng: 10.004, lat: 20.002 })

    expect(tool.renderOverlay().ghost).toEqual(before)
  })

  it('ignores a grab before the box is placed', () => {
    const tool = placedTool(2)

    tool.onHandleDragStart(0)
    tool.onHandleDrag({ lng: 10.004, lat: 20.002 })

    expect(tool.renderOverlay().ghost).toBeUndefined()
  })
})
