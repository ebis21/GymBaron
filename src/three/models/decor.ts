import * as THREE from 'three'
import type { DecorTypeId } from '../../game/types'
import { PALETTE, blockAt, cylinder, sphere } from '../style'

/**
 * Furniture. Same rules as the machines: built from rounded blocks, standing
 * on y = 0, fitting inside one 2x2 tile so the grid can place it anywhere.
 */

function buildPlant(): THREE.Group {
  const g = new THREE.Group()

  const pot = cylinder(0.32, 0.24, 0.5, PALETTE.pot)
  pot.position.y = 0.25
  g.add(pot)

  const rim = cylinder(0.36, 0.36, 0.1, PALETTE.frameRed, 14)
  rim.position.y = 0.48
  g.add(rim)

  const leaves: Array<[number, number, number, number]> = [
    [0, 0.78, 0, 0.42],
    [0.24, 1.08, 0.1, 0.3],
    [-0.22, 1.02, -0.12, 0.28],
    [0.05, 1.3, -0.05, 0.2],
  ]
  for (const [x, y, z, r] of leaves) {
    const leaf = sphere(r, PALETTE.leaf, 12)
    leaf.position.set(x, y, z)
    g.add(leaf)
  }

  return g
}

function buildReception(): THREE.Group {
  const g = new THREE.Group()

  g.add(blockAt(1.7, 1.05, 0.8, PALETTE.wood, 0, 0.52, 0, { radius: 0.14 }))
  g.add(blockAt(1.9, 0.16, 1.0, PALETTE.frameCream, 0, 1.12, 0, { radius: 0.07 }))

  // Monitor and a mug, so it reads as a desk somebody works at.
  const screen = blockAt(0.6, 0.44, 0.09, PALETTE.frameTeal, -0.35, 1.42, -0.1, { radius: 0.05 })
  screen.rotation.y = 0.3
  g.add(screen)

  const mug = cylinder(0.09, 0.09, 0.16, PALETTE.frameRed, 10)
  mug.position.set(0.45, 1.28, 0.12)
  g.add(mug)

  return g
}

function buildLocker(): THREE.Group {
  const g = new THREE.Group()

  g.add(blockAt(1.1, 1.7, 0.5, PALETTE.frameBlue, 0, 0.85, 0, { radius: 0.08 }))

  // Two doors with handles.
  for (const side of [-1, 1]) {
    g.add(blockAt(0.46, 1.5, 0.08, PALETTE.frameCream, side * 0.27, 0.9, 0.26, { radius: 0.06 }))
    const handle = cylinder(0.04, 0.04, 0.18, PALETTE.chrome, 8)
    handle.position.set(side * 0.06, 0.9, 0.33)
    g.add(handle)
  }

  g.add(blockAt(1.16, 0.1, 0.56, PALETTE.chrome, 0, 1.74, 0, { radius: 0.04 }))
  return g
}

function buildWatercooler(): THREE.Group {
  const g = new THREE.Group()

  g.add(blockAt(0.52, 0.95, 0.46, PALETTE.frameCream, 0, 0.48, 0, { radius: 0.08 }))
  g.add(blockAt(0.3, 0.16, 0.1, PALETTE.frameBlue, 0, 0.72, 0.24, { radius: 0.04 }))

  const bottle = cylinder(0.26, 0.2, 0.62, PALETTE.window, 14)
  bottle.position.y = 1.28
  g.add(bottle)

  const neck = cylinder(0.11, 0.14, 0.16, PALETTE.window, 10)
  neck.position.y = 0.99
  g.add(neck)

  return g
}

const BUILDERS: Record<DecorTypeId, () => THREE.Group> = {
  plant: buildPlant,
  reception: buildReception,
  locker: buildLocker,
  watercooler: buildWatercooler,
}

export function buildDecor(type: DecorTypeId): THREE.Group {
  return BUILDERS[type]()
}

/** Height and thickness of a partition, shared by the model and the preview. */
export const WALL_HEIGHT = 2.2
export const WALL_THICK = 0.22

/**
 * One partition segment, drawn along the local X axis and centred on the edge
 * it sits on. The caller rotates it for a north or a west edge.
 */
export function buildWallSegment(tile: number): THREE.Group {
  const g = new THREE.Group()

  g.add(
    blockAt(tile, WALL_HEIGHT, WALL_THICK, PALETTE.wall, 0, WALL_HEIGHT / 2, 0, {
      radius: 0.06,
      outline: 0.02,
    }),
  )
  // Capping rail — a bare slab looks unfinished from above.
  g.add(
    blockAt(tile, 0.14, WALL_THICK + 0.08, PALETTE.skirting, 0, WALL_HEIGHT, 0, {
      radius: 0.05,
      outline: 0.02,
    }),
  )

  return g
}
