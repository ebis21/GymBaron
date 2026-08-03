import { describe, it, expect } from 'vitest'
import { BUILD_MARGIN, HALL_D, HALL_W, overheadFraming } from './layout'

const FOV = 35

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

  it('keeps the room on screen without wasting height', () => {
    // One of the two axes should be a snug fit, or the camera is too far up.
    const framing = overheadFraming(FOV, 1496 / 850)
    const seen = visible(framing.height, 1496 / 850)
    const slack = Math.min(seen.down - (HALL_D + BUILD_MARGIN), seen.across - (HALL_W + BUILD_MARGIN))

    expect(slack).toBeLessThan(0.001)
  })
})
