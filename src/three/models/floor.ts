import * as THREE from 'three'
import { AISLE, TILE, WALL_H, staffDoorPoint, tileToWorld } from '../layout'
import { PALETTE, blockAt, toon } from '../style'

/**
 * The hall's outer measurements, derived from the equipment grid it has to
 * hold. Taken as arguments rather than read from the layout register so the
 * shell can be rebuilt for a size before anything else has caught up with it.
 */
const hallSize = (gw: number, gh: number) => ({ w: gw * TILE + AISLE, d: gh * TILE })

/** Checkerboard floor. Two warm tones, no texture file, reads from any height. */
function buildFloor(gw: number, gh: number): THREE.Group {
  const group = new THREE.Group()
  const { w, d } = hallSize(gw, gh)

  // Plain slab under everything. The checkerboard only covers the equipment
  // grid, so without this the entrance aisle would be a hole to the sky.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), toon(PALETTE.floorLight))
  // Sits a hair below the tiles so the two surfaces cannot z-fight.
  slab.position.y = -0.16
  slab.receiveShadow = true
  group.add(slab)

  const geometry = new THREE.BoxGeometry(TILE, 0.2, TILE)

  for (let y = 0; y < gh; y += 1) {
    for (let x = 0; x < gw; x += 1) {
      const light = (x + y) % 2 === 0
      const tile = new THREE.Mesh(geometry, toon(light ? PALETTE.floorLight : PALETTE.floorDark))
      const at = tileToWorld(x, y)
      tile.position.set(at.x, -0.1, at.z)
      tile.receiveShadow = true
      group.add(tile)
    }
  }

  return group
}

function buildWalls(gw: number, gh: number): THREE.Group {
  const group = new THREE.Group()
  const { w, d } = hallSize(gw, gh)
  const t = 0.5
  const half = WALL_H / 2

  // Back and side walls only — the front is left open so the camera can see in.
  const back = blockAt(w + t * 2, WALL_H, t, PALETTE.wall, 0, half, -d / 2 - t / 2, {
    radius: 0.12,
    outline: 0,
  })
  const left = blockAt(t, WALL_H, d, PALETTE.wall, -w / 2 - t / 2, half, 0, {
    radius: 0.12,
    outline: 0,
  })
  const right = blockAt(t, WALL_H, d, PALETTE.wall, w / 2 + t / 2, half, 0, {
    radius: 0.12,
    outline: 0,
  })
  group.add(back, left, right)

  // Skirting board — the small trim that stops a room looking like a box.
  group.add(
    blockAt(w + t * 2, 0.35, 0.12, PALETTE.skirting, 0, 0.17, -d / 2 - 0.1, {
      radius: 0.05,
      outline: 0,
    }),
  )

  // Windows along the back wall, letting the warm sky in. The gap between them
  // is a fraction of the wall rather than a fixed 4.6, so a wider hall spreads
  // them out instead of leaving three windows huddled in the middle of it.
  const gap = w * 0.23

  for (let i = -1; i <= 1; i += 1) {
    const frame = blockAt(3.2, 2.0, 0.18, PALETTE.wallTrim, i * gap, 2.6, -d / 2 - 0.28, {
      radius: 0.1,
      outline: 0.02,
    })
    const glass = blockAt(2.7, 1.55, 0.1, PALETTE.window, i * gap, 2.6, -d / 2 - 0.34, {
      radius: 0.08,
      outline: 0,
    })
    group.add(frame, glass)
  }

  return group
}

/**
 * The staff door: a doorway in the back wall, up in the entrance aisle, and
 * nothing at all behind it. There is no room to model — an employee with
 * nothing to do is not in the building, so the door is purely the place they
 * walk out of and back into. `placeStaff` stops drawing whoever is standing on
 * its threshold, which is the entire trick.
 */
function buildStaffDoor(gh: number): THREE.Group {
  const group = new THREE.Group()
  const at = staffDoorPoint()
  // The inner face of the back wall, which `buildWalls` puts at -d / 2. The
  // door sits just inside it, on the room's side, or the wall would swallow it.
  const z = -(gh * TILE) / 2

  const frame = blockAt(1.9, 2.6, 0.2, PALETTE.wallTrim, at.x, 1.3, z + 0.12, {
    radius: 0.1,
    outline: 0.02,
  })
  const leaf = blockAt(1.5, 2.2, 0.14, PALETTE.skirting, at.x, 1.1, z + 0.2, {
    radius: 0.08,
    outline: 0,
  })
  const handle = blockAt(0.13, 0.13, 0.13, PALETTE.wall, at.x + 0.52, 1.1, z + 0.3, {
    radius: 0.05,
    outline: 0,
  })
  // A lintel sign, so it reads as the way in for staff rather than a cupboard.
  const sign = blockAt(1.1, 0.32, 0.1, PALETTE.wall, at.x, 2.8, z + 0.16, {
    radius: 0.06,
    outline: 0.02,
  })

  group.add(frame, leaf, handle, sign)
  return group
}

/**
 * The shell of the room: floor, outer walls, windows. Nothing in here reacts to
 * game state and nothing here can be edited. The reception desk and the plants
 * used to live in this file, but the player can now move them, so they became
 * ordinary decor entities that the scene places from state.
 *
 * Built for one grid size and thrown away whole when the player buys a bigger
 * one — the shell is a few dozen meshes, so rebuilding it beats trying to
 * stretch walls and re-tile a floor in place.
 */
export function buildHall(gw: number, gh: number): THREE.Group {
  const hall = new THREE.Group()
  hall.add(buildFloor(gw, gh), buildWalls(gw, gh), buildStaffDoor(gh))
  return hall
}

/**
 * Frees the GPU buffers behind a discarded shell. Materials are deliberately
 * left alone: `toon()` hands out one shared material per colour, so disposing
 * the hall's would strip the paint off every machine in the room too.
 */
export function disposeHall(hall: THREE.Object3D): void {
  const seen = new Set<THREE.BufferGeometry>()
  hall.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    // One geometry is shared between a block and its ink outline.
    if (seen.has(child.geometry)) return
    seen.add(child.geometry)
    child.geometry.dispose()
  })
}
