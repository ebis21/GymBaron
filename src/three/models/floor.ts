import * as THREE from 'three'
import { GRID_H, GRID_W } from '../../game/constants'
import { GRID_OFFSET_X, HALL_D, HALL_W, TILE, WALL_H, tileToWorld } from '../layout'
import { PALETTE, block, blockAt, cylinder, sphere, toon } from '../style'

/** Checkerboard floor. Two warm tones, no texture file, reads from any height. */
function buildFloor(): THREE.Group {
  const group = new THREE.Group()

  // Plain slab under everything. The checkerboard only covers the equipment
  // grid, so without this the entrance aisle would be a hole to the sky.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(HALL_W, 0.3, HALL_D),
    toon(PALETTE.floorLight),
  )
  // Sits a hair below the tiles so the two surfaces cannot z-fight.
  slab.position.y = -0.16
  slab.receiveShadow = true
  group.add(slab)

  const geometry = new THREE.BoxGeometry(TILE, 0.2, TILE)

  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      const light = (x + y) % 2 === 0
      const tile = new THREE.Mesh(geometry, toon(light ? PALETTE.floorLight : PALETTE.floorDark))
      const at = tileToWorld(x, y)
      tile.position.set(at.x, -0.1, at.z)
      tile.receiveShadow = true
      group.add(tile)
    }
  }

  // A teal training mat down the equipment floor, the way a real gym zones it.
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(GRID_W * TILE - TILE, 0.06, TILE * 1.4),
    toon(PALETTE.matDark),
  )
  mat.position.set(GRID_OFFSET_X, 0.02, 0)
  mat.receiveShadow = true
  group.add(mat)

  return group
}

function buildWalls(): THREE.Group {
  const group = new THREE.Group()
  const t = 0.5
  const half = WALL_H / 2

  // Back and side walls only — the front is left open so the camera can see in.
  const back = blockAt(HALL_W + t * 2, WALL_H, t, PALETTE.wall, 0, half, -HALL_D / 2 - t / 2, {
    radius: 0.12,
    outline: 0,
  })
  const left = blockAt(t, WALL_H, HALL_D, PALETTE.wall, -HALL_W / 2 - t / 2, half, 0, {
    radius: 0.12,
    outline: 0,
  })
  const right = blockAt(t, WALL_H, HALL_D, PALETTE.wall, HALL_W / 2 + t / 2, half, 0, {
    radius: 0.12,
    outline: 0,
  })
  group.add(back, left, right)

  // Skirting board — the small trim that stops a room looking like a box.
  group.add(
    blockAt(HALL_W + t * 2, 0.35, 0.12, PALETTE.skirting, 0, 0.17, -HALL_D / 2 - 0.1, {
      radius: 0.05,
      outline: 0,
    }),
  )

  // Windows along the back wall, letting the warm sky in.
  for (let i = -1; i <= 1; i += 1) {
    const frame = blockAt(3.2, 2.0, 0.18, PALETTE.wallTrim, i * 4.6, 2.6, -HALL_D / 2 - 0.28, {
      radius: 0.1,
      outline: 0.02,
    })
    const glass = blockAt(2.7, 1.55, 0.1, PALETTE.window, i * 4.6, 2.6, -HALL_D / 2 - 0.34, {
      radius: 0.08,
      outline: 0,
    })
    group.add(frame, glass)
  }

  return group
}

/** Reception desk in the corner — the spot the whole business orbits. */
function buildReception(): THREE.Group {
  const group = new THREE.Group()

  const desk = block(2.6, 1.05, 1.1, PALETTE.wood, { radius: 0.14 })
  desk.position.set(-HALL_W / 2 + 1.6, 0.52, -HALL_D / 2 + 1.0)
  group.add(desk)

  group.add(
    blockAt(2.9, 0.16, 1.35, PALETTE.frameCream, -HALL_W / 2 + 1.6, 1.12, -HALL_D / 2 + 1.0, {
      radius: 0.07,
    }),
  )
  group.add(
    blockAt(0.7, 0.5, 0.08, PALETTE.frameTeal, -HALL_W / 2 + 1.6, 1.45, -HALL_D / 2 + 1.0, {
      radius: 0.05,
    }),
  )

  return group
}

function buildPlant(x: number, z: number): THREE.Group {
  const group = new THREE.Group()

  const pot = cylinder(0.32, 0.24, 0.5, PALETTE.pot)
  pot.position.y = 0.25
  group.add(pot)

  const leaves: Array<[number, number, number, number]> = [
    [0, 0.75, 0, 0.42],
    [0.22, 1.05, 0.1, 0.3],
    [-0.2, 1.0, -0.12, 0.27],
  ]
  for (const [px, py, pz, r] of leaves) {
    const leaf = sphere(r, PALETTE.leaf, 12)
    leaf.position.set(px, py, pz)
    group.add(leaf)
  }

  group.position.set(x, 0, z)
  return group
}

/**
 * The whole room, built once. Nothing in here reacts to game state — machines
 * and people are added separately by the scene.
 */
export function buildHall(): THREE.Group {
  const hall = new THREE.Group()
  hall.add(buildFloor(), buildWalls(), buildReception())

  hall.add(buildPlant(HALL_W / 2 - 0.9, -HALL_D / 2 + 0.9))
  hall.add(buildPlant(HALL_W / 2 - 0.9, HALL_D / 2 - 0.9))
  hall.add(buildPlant(-HALL_W / 2 + 0.9, HALL_D / 2 - 0.9))

  return hall
}
