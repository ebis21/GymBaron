import { describe, it, expect, afterEach } from 'vitest'
import type { GameState } from './types'
import {
  tileToWorld,
  worldToTile,
  receptionStand,
  tileBehind,
  syncRoomSize,
  gridW,
  gridH,
  hallW,
  hallD,
  doorX,
  doorQueueAnchor,
  DESK_STAND_DIST,
  DOOR_QUEUE_ANCHOR,
  DOOR_X,
  HALL_D,
  HALL_W,
  TILE,
} from './layout'
import { EXPANSIONS } from './content/expansion'

/** Only `expansion` is read, so a whole save would be noise here. */
const roomOf = (expansion: number) => syncRoomSize({ expansion } as GameState)

// The register is module state on purpose; every test that moves it puts it
// back, or the next file to run would inherit somebody else's gym.
afterEach(() => roomOf(0))

describe('tileToWorld', () => {
  it('round-trips through worldToTile for every grid tile', () => {
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 6; y++) {
        const at = tileToWorld(x, y)
        expect(worldToTile(at.x, at.z)).toEqual({ x, y })
      }
    }
  })

  it('round-trips for the two aisle columns left of the grid', () => {
    for (const x of [-2, -1]) {
      const at = tileToWorld(x, 3)
      expect(worldToTile(at.x, at.z)).toEqual({ x, y: 3 })
    }
  })

  it('keeps the door inside the hall', () => {
    expect(DOOR_X).toBeGreaterThan(-HALL_W / 2)
    expect(DOOR_X).toBeLessThan(HALL_W / 2)
  })
})

describe('the current room', () => {
  it('starts on the base gym without anyone having to sync it', () => {
    expect(gridW()).toBe(8)
    expect(gridH()).toBe(6)
    expect(hallW()).toBe(HALL_W)
    expect(hallD()).toBe(HALL_D)
    expect(doorX()).toBe(DOOR_X)
  })

  it('takes its size from the save it is handed', () => {
    for (const [level, room] of EXPANSIONS.entries()) {
      roomOf(level)
      expect(gridW()).toBe(room.w)
      expect(gridH()).toBe(room.h)
      expect(hallW()).toBe(room.w * TILE + 4)
      expect(hallD()).toBe(room.h * TILE)
    }
  })

  it('is idempotent, so a caller can sync every tick', () => {
    roomOf(2)
    const once = { w: gridW(), h: gridH() }
    roomOf(2)
    roomOf(2)
    expect({ w: gridW(), h: gridH() }).toEqual(once)
  })

  it('shrinks back when a smaller save is loaded', () => {
    roomOf(3)
    roomOf(0)
    expect(gridW()).toBe(8)
    expect(gridH()).toBe(6)
  })

  it('re-centres the floor plan rather than growing off one side', () => {
    const base = tileToWorld(0, 0)
    roomOf(1) // 10 x 6 — two columns wider
    const wider = tileToWorld(0, 0)

    // Tile 0,0 keeps its tile and slides a column's worth left of centre.
    expect(wider.x).toBeCloseTo(base.x - TILE, 5)
    expect(wider.z).toBeCloseTo(base.z, 5)
  })

  it('round-trips through worldToTile across the whole expanded room', () => {
    roomOf(3) // the biggest there is
    for (let x = -2; x < gridW(); x += 1) {
      for (let y = 0; y < gridH(); y += 1) {
        const at = tileToWorld(x, y)
        expect(worldToTile(at.x, at.z)).toEqual({ x, y })
      }
    }
  })

  it('keeps the door in the aisle however big the hall gets', () => {
    for (const level of EXPANSIONS.keys()) {
      roomOf(level)
      expect(doorX()).toBeGreaterThan(-hallW() / 2)
      expect(doorX()).toBeLessThan(0)
      // The aisle is a fixed strip by the entrance; the room grows away.
      expect(doorX() + hallW() / 2).toBeCloseTo(1.3, 5)
    }
  })

  it('moves the door-side queue with the door, and leaves the const at base', () => {
    roomOf(2)
    expect(doorQueueAnchor().x).toBe(doorX())
    expect(doorQueueAnchor().z).toBe(DOOR_QUEUE_ANCHOR.z)
    expect(DOOR_QUEUE_ANCHOR.x).toBe(DOOR_X)
  })

  it('clamps a nonsense expansion to the biggest legal room', () => {
    roomOf(99)
    const biggest = EXPANSIONS[EXPANSIONS.length - 1]!
    expect(gridW()).toBe(biggest.w)
    expect(gridH()).toBe(biggest.h)
  })
})

describe('receptionStand', () => {
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.hypot(a.x - b.x, a.z - b.z)

  it('stands closer to the desk than a whole tile step, at every rotation', () => {
    for (const rotation of [0, 1, 2, 3]) {
      const desk = tileToWorld(3, 2)
      const spot = receptionStand(3, 2, rotation)
      expect(dist(spot, desk)).toBeCloseTo(DESK_STAND_DIST, 5)
      expect(dist(spot, desk)).toBeLessThan(TILE)
    }
  })

  it('leaves the desk tile itself free', () => {
    for (const rotation of [0, 1, 2, 3]) {
      const spot = receptionStand(3, 2, rotation)
      expect(worldToTile(spot.x, spot.z)).not.toEqual({ x: 3, y: 2 })
    }
  })

  it('stands on the same side as the tile the attendant paths to', () => {
    for (const rotation of [0, 1, 2, 3]) {
      const spot = receptionStand(3, 2, rotation)
      expect(worldToTile(spot.x, spot.z)).toEqual(tileBehind(3, 2, rotation))
    }
  })
})
