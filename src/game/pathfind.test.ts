import { describe, it, expect, afterEach } from 'vitest'
import { findPath, walkable, WALK_MIN_X } from './pathfind'
import { initialState } from './economy'
import { syncRoomSize } from './layout'
import type { GameState, Machine, Wall } from './types'

/** Points the layout register at one rung of the floor-space ladder. */
const roomOf = (expansion: number) => syncRoomSize({ expansion } as GameState)

afterEach(() => roomOf(0))

const machine = (uid: string, x: number, y: number): Machine => ({
  uid, type: 'dumbbells', x, y, rotation: 0, durability: 100, occupiedBy: null, brokenMs: 0,
})

/** Pusta hala: bez dekoracji, żeby startowa recepcja nie zasłaniała kafelków. */
const empty = (): GameState => ({ ...initialState(7, 0), decor: [] })

describe('walkable', () => {
  it('accepts the two aisle columns and rejects anything further left', () => {
    const s = empty()
    expect(walkable(s, -1, 0)).toBe(true)
    expect(walkable(s, -2, 0)).toBe(true)
    expect(walkable(s, WALK_MIN_X - 1, 0)).toBe(false)
  })

  it('rejects tiles outside the grid rows', () => {
    const s = empty()
    expect(walkable(s, 0, -1)).toBe(false)
    expect(walkable(s, 0, 6)).toBe(false)
    expect(walkable(s, 8, 0)).toBe(false)
  })

  it('rejects a tile holding a machine', () => {
    const s: GameState = { ...empty(), machines: [machine('m1', 2, 2)] }
    expect(walkable(s, 2, 2)).toBe(false)
  })

  it('never lets anything block the aisle', () => {
    // Nothing can be built at negative x, so the aisle is walkable by
    // construction — this guards the invariant the rest-point logic leans on.
    const s: GameState = { ...empty(), machines: [machine('m1', 0, 0)] }
    expect(walkable(s, -1, 0)).toBe(true)
  })

  it('opens the new columns and rows an expansion pays for', () => {
    const s = empty()

    roomOf(1) // 10 x 6 — two columns wider
    expect(walkable(s, 8, 0)).toBe(true)
    expect(walkable(s, 9, 5)).toBe(true)
    expect(walkable(s, 10, 0)).toBe(false)
    expect(walkable(s, 0, 6)).toBe(false)

    roomOf(2) // 10 x 8 — two rows deeper as well
    expect(walkable(s, 9, 7)).toBe(true)
    expect(walkable(s, 9, 8)).toBe(false)
  })

  it('keeps the aisle exactly two columns wide however big the room gets', () => {
    const s = empty()
    for (const level of [0, 1, 2, 3]) {
      roomOf(level)
      expect(walkable(s, WALK_MIN_X, 0)).toBe(true)
      expect(walkable(s, WALK_MIN_X - 1, 0)).toBe(false)
    }
  })

  it('closes the far columns again when a smaller room is loaded', () => {
    const s = empty()
    roomOf(1)
    expect(walkable(s, 9, 0)).toBe(true)
    roomOf(0)
    expect(walkable(s, 9, 0)).toBe(false)
  })
})

describe('findPath in an expanded room', () => {
  it('routes to a tile the base room did not have', () => {
    roomOf(2) // 10 x 8
    const s = empty()
    const path = findPath(s, { x: 0, y: 0 }, { x: 9, y: 7 })
    expect(path).not.toBeNull()
    expect(path![path!.length - 1]).toEqual({ x: 9, y: 7 })
  })

  it('still refuses a tile past the new far wall', () => {
    roomOf(2)
    expect(findPath(empty(), { x: 0, y: 0 }, { x: 10, y: 0 })).toBeNull()
  })
})

describe('findPath', () => {
  it('returns an empty path when already at the goal', () => {
    expect(findPath(empty(), { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([])
  })

  it('walks a straight line at the Manhattan distance', () => {
    const path = findPath(empty(), { x: 0, y: 0 }, { x: 3, y: 0 })
    expect(path).toHaveLength(3)
    expect(path?.[2]).toEqual({ x: 3, y: 0 })
  })

  it('excludes the starting tile and ends on the goal', () => {
    const path = findPath(empty(), { x: 0, y: 0 }, { x: 0, y: 2 })
    expect(path).toEqual([{ x: 0, y: 1 }, { x: 0, y: 2 }])
  })

  it('goes around a wall instead of through it', () => {
    // A wall on the north edge of (0,1) blocks the direct step 0,0 -> 0,1.
    const wall: Wall = { uid: 'w1', x: 0, y: 1, side: 'n' }
    const s: GameState = { ...empty(), walls: [wall] }
    const path = findPath(s, { x: 0, y: 0 }, { x: 0, y: 1 })
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(1)
    expect(path!.some(t => t.x === 0 && t.y === 0)).toBe(false)
  })

  it('returns null when the goal is walled off on all four sides', () => {
    const s: GameState = {
      ...empty(),
      walls: [
        { uid: 'w1', x: 3, y: 3, side: 'n' },
        { uid: 'w2', x: 3, y: 4, side: 'n' },
        { uid: 'w3', x: 3, y: 3, side: 'w' },
        { uid: 'w4', x: 4, y: 3, side: 'w' },
      ],
    }
    expect(findPath(s, { x: 0, y: 0 }, { x: 3, y: 3 })).toBeNull()
  })

  it('refuses an occupied goal by default', () => {
    const s: GameState = { ...empty(), machines: [machine('m1', 2, 2)] }
    expect(findPath(s, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull()
  })

  it('reaches an occupied goal with allowBlockedGoal', () => {
    const s: GameState = { ...empty(), machines: [machine('m1', 2, 2)] }
    const path = findPath(s, { x: 0, y: 0 }, { x: 2, y: 2 }, { allowBlockedGoal: true })
    expect(path?.at(-1)).toEqual({ x: 2, y: 2 })
  })

  it('does not route through other occupied tiles even with allowBlockedGoal', () => {
    const s: GameState = {
      ...empty(),
      machines: [machine('m1', 1, 0), machine('m2', 2, 0)],
    }
    const path = findPath(s, { x: 0, y: 0 }, { x: 2, y: 0 }, { allowBlockedGoal: true })
    expect(path?.some(t => t.x === 1 && t.y === 0)).toBe(false)
  })

  it('is deterministic — the same query always yields the same path', () => {
    const s = empty()
    const a = findPath(s, { x: -2, y: 0 }, { x: 7, y: 5 })
    const b = findPath(s, { x: -2, y: 0 }, { x: 7, y: 5 })
    expect(a).toEqual(b)
  })
})
