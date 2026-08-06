import { describe, it, expect, afterEach } from 'vitest'
import type { GameState } from '../game/types'
import {
  BUILD_MARGIN,
  HALL_D,
  HALL_W,
  hallD,
  hallW,
  insideGrid,
  overheadFraming,
  syncRoomSize,
} from './layout'

const FOV = 35

/** Points the layout register at one rung of the floor-space ladder. */
const roomOf = (expansion: number) => syncRoomSize({ expansion } as GameState)

afterEach(() => roomOf(0))

/** What a camera at `height` above the floor actually sees, in world units. */
function visible(height: number, aspect: number): { down: number; across: number } {
  const down = 2 * height * Math.tan((FOV * Math.PI) / 360)
  return { down, across: down * aspect }
}

describe('overheadFraming', () => {
  const cases: Array<[string, number]> = [
    ['a portrait phone', 430 / 880],
    ['a square window', 1],
    ['a laptop', 1496 / 850],
    ['a very wide window', 2560 / 700],
  ]

  for (const [name, aspect] of cases) {
    it(`fits the whole hall on ${name}`, () => {
      const framing = overheadFraming(FOV, aspect)
      const seen = visible(framing.height, aspect)

      // Which side of the room runs down the screen depends on the turn.
      const turned = framing.up.x !== 0
      expect(seen.down).toBeGreaterThanOrEqual((turned ? HALL_W : HALL_D) + BUILD_MARGIN - 0.001)
      expect(seen.across).toBeGreaterThanOrEqual((turned ? HALL_D : HALL_W) + BUILD_MARGIN - 0.001)
    })
  }

  it('turns the room a quarter turn only when the screen is taller than wide', () => {
    expect(overheadFraming(FOV, 0.5).up).toEqual({ x: -1, z: 0 })
    expect(overheadFraming(FOV, 1.8).up).toEqual({ x: 0, z: -1 })
  })

  it('flies lower for a wider field of view', () => {
    expect(overheadFraming(55, 1.8).height).toBeLessThan(overheadFraming(35, 1.8).height)
  })

  it('pulls back far enough to hold every room on the ladder', () => {
    for (const level of [0, 1, 2, 3]) {
      roomOf(level)
      for (const aspect of [430 / 880, 1, 1496 / 850]) {
        const framing = overheadFraming(FOV, aspect)
        const seen = visible(framing.height, aspect)
        const turned = framing.up.x !== 0

        expect(seen.down).toBeGreaterThanOrEqual(
          (turned ? hallW() : hallD()) + BUILD_MARGIN - 0.001,
        )
        expect(seen.across).toBeGreaterThanOrEqual(
          (turned ? hallD() : hallW()) + BUILD_MARGIN - 0.001,
        )
      }
    }
  })

  it('flies higher for a bigger room', () => {
    roomOf(0)
    const base = overheadFraming(FOV, 1.8).height
    roomOf(3)
    expect(overheadFraming(FOV, 1.8).height).toBeGreaterThan(base)
  })

  it('keeps the room on screen without wasting height', () => {
    // One of the two axes should be a snug fit, or the camera is too far up.
    const framing = overheadFraming(FOV, 1496 / 850)
    const seen = visible(framing.height, 1496 / 850)
    const slack = Math.min(seen.down - (HALL_D + BUILD_MARGIN), seen.across - (HALL_W + BUILD_MARGIN))

    expect(slack).toBeLessThan(0.001)
  })
})

describe('insideGrid', () => {
  it('reports the base room until an expansion is synced', () => {
    expect(hallW()).toBe(HALL_W)
    expect(hallD()).toBe(HALL_D)
    expect(insideGrid(7, 5)).toBe(true)
    expect(insideGrid(8, 5)).toBe(false)
  })

  it('follows the engine onto the floor an expansion added', () => {
    roomOf(3) // 12 x 8
    expect(insideGrid(11, 7)).toBe(true)
    expect(insideGrid(12, 7)).toBe(false)
    expect(hallW()).toBe(12 * 2 + 4)
    expect(hallD()).toBe(8 * 2)
  })
})
