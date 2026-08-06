import { describe, it, expect, afterEach } from 'vitest'
import {
  addToInventory,
  insideGrid,
  canonicalEdge,
  movePlaced,
  moveWall,
  nextRotation,
  placeFromInventory,
  placeWall,
  removeWall,
  rotatePlaced,
  storePlaced,
  tileFree,
  tileOccupant,
} from './build'
import { initialState } from './economy'
import { syncRoomSize } from './layout'
import type { GameState } from './types'

/** A blank room: the starter decor would get in the way of most of these. */
const empty = (): GameState => ({ ...initialState(11, 0), decor: [] })

/** Points the layout register at one rung of the floor-space ladder. */
const roomOf = (expansion: number) => syncRoomSize({ expansion } as GameState)

afterEach(() => roomOf(0))

describe('insideGrid', () => {
  it('stops at the base room until an expansion is bought', () => {
    expect(insideGrid(7, 5)).toBe(true)
    expect(insideGrid(8, 0)).toBe(false)
    expect(insideGrid(0, 6)).toBe(false)
  })

  it('takes in the floor an expansion adds', () => {
    roomOf(1) // 10 x 6
    expect(insideGrid(9, 5)).toBe(true)
    expect(insideGrid(10, 0)).toBe(false)
    expect(insideGrid(0, 6)).toBe(false)

    roomOf(2) // 10 x 8
    expect(insideGrid(9, 7)).toBe(true)
    expect(insideGrid(9, 8)).toBe(false)
  })

  it('never takes in the aisle, whatever the room size', () => {
    for (const level of [0, 1, 2, 3]) {
      roomOf(level)
      expect(insideGrid(-1, 0)).toBe(false)
    }
  })
})

describe('placing on floor an expansion bought', () => {
  it('accepts a tile the base room did not have', () => {
    roomOf(1)
    const s0 = addToInventory(empty(), { kind: 'machine', type: 'bench' })
    const s = placeFromInventory(s0, s0.inventory[0]!.uid, 9, 5)
    expect(s.machines[0]).toMatchObject({ x: 9, y: 5 })
  })

  it('refuses the same tile once the register is back on the base room', () => {
    const s0 = addToInventory(empty(), { kind: 'machine', type: 'bench' })
    expect(placeFromInventory(s0, s0.inventory[0]!.uid, 9, 5)).toBe(s0)
  })
})

describe('nextRotation', () => {
  it('cycles through four quarter turns and back', () => {
    expect(nextRotation(0)).toBe(1)
    expect(nextRotation(3)).toBe(0)
  })
})

describe('canonicalEdge', () => {
  it('leaves north and west alone', () => {
    expect(canonicalEdge(2, 3, 'n')).toEqual({ x: 2, y: 3, side: 'n' })
    expect(canonicalEdge(2, 3, 'w')).toEqual({ x: 2, y: 3, side: 'w' })
  })

  it('folds south and east onto the neighbour', () => {
    expect(canonicalEdge(2, 3, 's')).toEqual({ x: 2, y: 4, side: 'n' })
    expect(canonicalEdge(2, 3, 'e')).toEqual({ x: 3, y: 3, side: 'w' })
  })

  it('gives one shared edge the same name from both sides', () => {
    expect(canonicalEdge(2, 3, 's')).toEqual(canonicalEdge(2, 4, 'n'))
  })
})

describe('tileOccupant', () => {
  it('is empty on a blank floor', () => {
    expect(tileOccupant(empty(), 1, 1)).toBeNull()
    expect(tileFree(empty(), 1, 1)).toBe(true)
  })

  it('reports machines and decor alike', () => {
    const bench = addToInventory(empty(), { kind: 'machine', type: 'bench' })
    const withMachine = placeFromInventory(bench, bench.inventory[0]!.uid, 1, 1)
    expect(tileOccupant(withMachine, 1, 1)?.kind).toBe('machine')

    const plant = addToInventory(empty(), { kind: 'decor', type: 'plant' })
    const withPlant = placeFromInventory(plant, plant.inventory[0]!.uid, 2, 2)
    expect(tileOccupant(withPlant, 2, 2)?.kind).toBe('decor')
  })

  it('treats tiles outside the grid as unavailable', () => {
    expect(tileFree(empty(), -1, 0)).toBe(false)
    expect(tileFree(empty(), 8, 0)).toBe(false)
    expect(tileFree(empty(), 0, 6)).toBe(false)
  })
})

describe('addToInventory', () => {
  it('boxes a machine at full health by default', () => {
    const s = addToInventory(empty(), { kind: 'machine', type: 'cable' })
    expect(s.inventory).toHaveLength(1)
    expect(s.inventory[0]).toMatchObject({ kind: 'machine', type: 'cable', durability: 100 })
  })

  it('gives every item a distinct id', () => {
    const s = addToInventory(addToInventory(empty(), { kind: 'wall' }), { kind: 'wall' })
    expect(s.inventory[0]!.uid).not.toBe(s.inventory[1]!.uid)
  })
})

describe('placeFromInventory', () => {
  const bagged = () => addToInventory(empty(), { kind: 'machine', type: 'bench' })

  it('moves an item out of the bag and onto the floor', () => {
    const s0 = bagged()
    const s = placeFromInventory(s0, s0.inventory[0]!.uid, 3, 2)
    expect(s.inventory).toHaveLength(0)
    expect(s.machines).toHaveLength(1)
    expect(s.machines[0]).toMatchObject({ type: 'bench', x: 3, y: 2, rotation: 0 })
  })

  it('refuses a tile that is already taken', () => {
    const s0 = bagged()
    const first = placeFromInventory(s0, s0.inventory[0]!.uid, 3, 2)
    const crowded = addToInventory(first, { kind: 'decor', type: 'plant' })
    expect(placeFromInventory(crowded, crowded.inventory[0]!.uid, 3, 2)).toBe(crowded)
  })

  it('refuses a tile off the grid', () => {
    const s = bagged()
    expect(placeFromInventory(s, s.inventory[0]!.uid, 99, 0)).toBe(s)
  })

  it('ignores an unknown item', () => {
    const s = bagged()
    expect(placeFromInventory(s, 'nope', 1, 1)).toBe(s)
  })

  it('will not stand a wall on a tile', () => {
    const s = addToInventory(empty(), { kind: 'wall' })
    expect(placeFromInventory(s, s.inventory[0]!.uid, 1, 1)).toBe(s)
  })

  it('carries wear back onto the floor', () => {
    const worn = addToInventory(empty(), { kind: 'machine', type: 'bench', durability: 42 })
    expect(placeFromInventory(worn, worn.inventory[0]!.uid, 0, 0).machines[0]!.durability).toBe(42)
  })
})

describe('storePlaced', () => {
  const placed = () => {
    const s = addToInventory(empty(), { kind: 'machine', type: 'bench' })
    return placeFromInventory(s, s.inventory[0]!.uid, 1, 1)
  }

  it('puts a machine back in the bag with its wear intact', () => {
    const base = placed()
    const worn: GameState = {
      ...base,
      machines: base.machines.map(m => ({ ...m, durability: 31 })),
    }
    const s = storePlaced(worn, 'machine', worn.machines[0]!.uid)
    expect(s.machines).toHaveLength(0)
    expect(s.inventory[0]).toMatchObject({ kind: 'machine', durability: 31 })
  })

  it('refuses to pull a machine out from under a client', () => {
    const base = placed()
    const busy: GameState = {
      ...base,
      machines: base.machines.map(m => ({ ...m, occupiedBy: 'c1' })),
    }
    expect(storePlaced(busy, 'machine', busy.machines[0]!.uid)).toBe(busy)
  })

  it('stores decor', () => {
    const bag = addToInventory(empty(), { kind: 'decor', type: 'plant' })
    const s = placeFromInventory(bag, bag.inventory[0]!.uid, 4, 4)
    const after = storePlaced(s, 'decor', s.decor[0]!.uid)
    expect(after.decor).toHaveLength(0)
    expect(after.inventory[0]).toMatchObject({ kind: 'decor', type: 'plant' })
  })

  it('ignores an unknown uid', () => {
    const s = placed()
    expect(storePlaced(s, 'machine', 'nope')).toBe(s)
  })
})

describe('rotatePlaced', () => {
  it('turns a machine a quarter at a time and wraps around', () => {
    const bag = addToInventory(empty(), { kind: 'machine', type: 'bench' })
    const s = placeFromInventory(bag, bag.inventory[0]!.uid, 1, 1)
    const uid = s.machines[0]!.uid

    let turned = s
    expect(rotatePlaced(turned, 'machine', uid).machines[0]!.rotation).toBe(1)
    for (let i = 0; i < 4; i += 1) turned = rotatePlaced(turned, 'machine', uid)
    expect(turned.machines[0]!.rotation).toBe(0)
  })

  it('turns decor too', () => {
    const bag = addToInventory(empty(), { kind: 'decor', type: 'plant' })
    const s = placeFromInventory(bag, bag.inventory[0]!.uid, 1, 1)
    expect(rotatePlaced(s, 'decor', s.decor[0]!.uid).decor[0]!.rotation).toBe(1)
  })
})

describe('movePlaced', () => {
  const placed = () => {
    const s = addToInventory(empty(), { kind: 'machine', type: 'bench' })
    return placeFromInventory(s, s.inventory[0]!.uid, 1, 1)
  }

  it('slides a machine to a free tile', () => {
    const s = placed()
    expect(movePlaced(s, 'machine', s.machines[0]!.uid, 5, 4).machines[0]).toMatchObject({
      x: 5,
      y: 4,
    })
  })

  it('keeps wear and the client across the move', () => {
    const base = placed()
    const busy: GameState = {
      ...base,
      machines: base.machines.map(m => ({ ...m, durability: 55, occupiedBy: 'c1' })),
    }
    expect(movePlaced(busy, 'machine', busy.machines[0]!.uid, 2, 2).machines[0]).toMatchObject({
      durability: 55,
      occupiedBy: 'c1',
    })
  })

  it('refuses a tile somebody else is on', () => {
    const s = placed()
    const withPlant = addToInventory(s, { kind: 'decor', type: 'plant' })
    const two = placeFromInventory(withPlant, withPlant.inventory[0]!.uid, 5, 5)
    expect(movePlaced(two, 'machine', two.machines[0]!.uid, 5, 5)).toBe(two)
  })

  it('accepts a move onto its own tile', () => {
    const s = placed()
    expect(movePlaced(s, 'machine', s.machines[0]!.uid, 1, 1).machines[0]).toMatchObject({
      x: 1,
      y: 1,
    })
  })

  it('refuses to leave the grid', () => {
    const s = placed()
    expect(movePlaced(s, 'machine', s.machines[0]!.uid, -3, 0)).toBe(s)
  })
})

describe('walls', () => {
  const bagged = () => addToInventory(empty(), { kind: 'wall' })

  it('builds a segment on an edge', () => {
    const s0 = bagged()
    const s = placeWall(s0, s0.inventory[0]!.uid, 2, 2, 'n')
    expect(s.walls).toHaveLength(1)
    expect(s.walls[0]).toMatchObject({ x: 2, y: 2, side: 'n' })
    expect(s.inventory).toHaveLength(0)
  })

  it('stores a south edge under its neighbour', () => {
    const s0 = bagged()
    expect(placeWall(s0, s0.inventory[0]!.uid, 2, 2, 's').walls[0]).toMatchObject({
      x: 2,
      y: 3,
      side: 'n',
    })
  })

  it('refuses to build twice on one edge, named from either side', () => {
    const s0 = bagged()
    const first = placeWall(s0, s0.inventory[0]!.uid, 2, 2, 'n')
    const again = addToInventory(first, { kind: 'wall' })
    const uid = again.inventory[0]!.uid

    expect(placeWall(again, uid, 2, 2, 'n')).toBe(again)
    expect(placeWall(again, uid, 2, 1, 's')).toBe(again)
  })

  it('refuses an edge off the grid', () => {
    const s = bagged()
    expect(placeWall(s, s.inventory[0]!.uid, 20, 20, 'n')).toBe(s)
  })

  it('will not build a wall out of a bench', () => {
    const s = addToInventory(empty(), { kind: 'machine', type: 'bench' })
    expect(placeWall(s, s.inventory[0]!.uid, 1, 1, 'n')).toBe(s)
  })

  it('takes a wall back down into the bag', () => {
    const s0 = bagged()
    const built = placeWall(s0, s0.inventory[0]!.uid, 2, 2, 'n')
    const after = removeWall(built, built.walls[0]!.uid)
    expect(after.walls).toHaveLength(0)
    expect(after.inventory[0]).toMatchObject({ kind: 'wall' })
  })

  it('ignores an unknown wall', () => {
    const s0 = bagged()
    const s = placeWall(s0, s0.inventory[0]!.uid, 2, 2, 'n')
    expect(removeWall(s, 'nope')).toBe(s)
  })

  describe('moveWall', () => {
    const built = () => {
      const s0 = bagged()
      return placeWall(s0, s0.inventory[0]!.uid, 2, 2, 'n')
    }

    it('slides a wall onto another edge without a trip through the bag', () => {
      const s = built()
      const after = moveWall(s, s.walls[0]!.uid, 4, 1, 'w')

      expect(after.walls).toHaveLength(1)
      expect(after.walls[0]).toMatchObject({ uid: s.walls[0]!.uid, x: 4, y: 1, side: 'w' })
      expect(after.inventory).toHaveLength(0)
    })

    it('canonicalises the destination edge', () => {
      const s = built()
      expect(moveWall(s, s.walls[0]!.uid, 3, 3, 'e').walls[0]).toMatchObject({
        x: 4,
        y: 3,
        side: 'w',
      })
    })

    it('refuses an edge another wall already stands on', () => {
      const spare = addToInventory(built(), { kind: 'wall' })
      const two = placeWall(spare, spare.inventory[0]!.uid, 5, 5, 'n')

      expect(two.walls).toHaveLength(2)
      expect(moveWall(two, two.walls[0]!.uid, 5, 5, 'n')).toBe(two)
    })

    it('leaves a wall put back on its own edge alone', () => {
      const s = built()
      expect(moveWall(s, s.walls[0]!.uid, 2, 2, 'n')).toBe(s)
    })

    it('refuses an edge off the grid, and an unknown wall', () => {
      const s = built()
      expect(moveWall(s, s.walls[0]!.uid, 20, 20, 'n')).toBe(s)
      expect(moveWall(s, 'nope', 1, 1, 'n')).toBe(s)
    })
  })
})

describe('the starting room', () => {
  it('comes furnished with movable decor rather than fixed scenery', () => {
    const s = initialState(1, 0)
    expect(s.decor.length).toBeGreaterThan(0)
    expect(s.decor.some(d => d.type === 'reception')).toBe(true)
    expect(s.decor.every(d => tileOccupant(s, d.x, d.y)?.kind === 'decor')).toBe(true)
  })

  it('starts with an empty bag and no walls', () => {
    const s = initialState(1, 0)
    expect(s.inventory).toEqual([])
    expect(s.walls).toEqual([])
  })
})
