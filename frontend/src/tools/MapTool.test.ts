import { distance } from '@turf/turf'
import { describe, expect, it, vi } from 'vitest'
import type { Waypoint } from '../types/mission'
import { createRectangleSurveyTool, createSelectTool, createWaypointTool, mapTools } from './MapTool'

describe('tool registry', () => {
  it('exposes a waypoint tool', () => {
    expect(mapTools.some((t) => t.id === 'waypoint')).toBe(true)
  })

  it('exposes a rectangle survey tool', () => {
    expect(mapTools.some((t) => t.id === 'rectangle_survey')).toBe(true)
  })

  it('exposes a select tool', () => {
    expect(mapTools.some((t) => t.id === 'select')).toBe(true)
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

describe('waypoint tool', () => {
  it('stamps each new waypoint with the altitude set at the time it was placed', () => {
    const settings = { altitude: 50 }
    let placed: Waypoint[] = []
    const tool = createWaypointTool(() => settings, () => placed, (points) => {
      placed = points
    })

    tool.onMapClick({ lng: 1, lat: 2 })
    settings.altitude = 120
    tool.onMapClick({ lng: 3, lat: 4 })

    expect(placed.map((w) => w.alt)).toEqual([50, 120])
  })

  it('appends to whatever waypoints already exist rather than its own copy', () => {
    const existing: Waypoint[] = [{ lat: 9, lng: 9, alt: 33 }]
    const onChange = vi.fn()
    const tool = createWaypointTool(() => ({ altitude: 50 }), () => existing, onChange)

    tool.onMapClick({ lng: 1, lat: 2 })

    expect(onChange.mock.calls[0][0]).toEqual([
      { lat: 9, lng: 9, alt: 33 },
      { lat: 2, lng: 1, alt: 50 },
    ])
  })
})

describe('select tool', () => {
  const waypoints: Waypoint[] = [
    { lat: 1, lng: 1, alt: 10 },
    { lat: 2, lng: 2, alt: 20 },
  ]

  function selectTool(overrides = {}) {
    const onSelect = vi.fn()
    const onMove = vi.fn()
    const tool = createSelectTool({ getWaypoints: () => waypoints, onSelect, onMove, ...overrides })
    return { tool, onSelect, onMove }
  }

  it('offers every waypoint as a draggable handle', () => {
    const overlay = selectTool().tool.renderOverlay()

    expect(overlay.markers).toEqual(waypoints)
    expect(overlay.draggable).toBe(true)
  })

  it('selects the waypoint that was grabbed', () => {
    const { tool, onSelect } = selectTool()

    tool.onHandleDragStart(1)

    expect(onSelect).toHaveBeenCalledWith(1)
    expect(tool.renderOverlay().selected).toBe(1)
  })

  it('moves the grabbed waypoint as the pointer moves', () => {
    const { tool, onMove } = selectTool()

    tool.onHandleDragStart(0)
    tool.onHandleDrag({ lng: 5, lat: 6 })

    expect(onMove).toHaveBeenCalledWith(0, { lng: 5, lat: 6 })
  })

  it('keeps the waypoint selected after the drag ends', () => {
    const { tool } = selectTool()

    tool.onHandleDragStart(1)
    tool.onHandleDragEnd()

    expect(tool.renderOverlay().selected).toBe(1)
  })

  it('does not move anything when nothing was grabbed', () => {
    const { tool, onMove } = selectTool()

    tool.onHandleDrag({ lng: 5, lat: 6 })

    expect(onMove).not.toHaveBeenCalled()
  })

  it('clears the selection when the map itself is clicked', () => {
    const { tool, onSelect } = selectTool()

    tool.onHandleDragStart(1)
    tool.onMapClick({ lng: 8, lat: 8 })

    expect(onSelect).toHaveBeenLastCalledWith(null)
    expect(tool.renderOverlay().selected).toBeUndefined()
  })

  it('never places a waypoint of its own', () => {
    const { tool, onMove } = selectTool()

    tool.onMapClick({ lng: 8, lat: 8 })

    expect(onMove).not.toHaveBeenCalled()
    expect(tool.renderOverlay().markers).toEqual(waypoints)
  })
})

describe('rectangle survey overlay', () => {
  function placedTool(clicks: number) {
    const tool = createRectangleSurveyTool(() => ({ altitude: 50, spacing: 20 }), () => {})
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
    const tool = createRectangleSurveyTool(() => ({ altitude: 50, spacing: 20 }), onChange)
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

