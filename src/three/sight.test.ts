import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { buildWallSegment } from './models/decor'
import { TILE, tileToWorld } from './layout'
import { blockingSight } from './sight'
import { FOLLOW_DEPTH, FOLLOW_HEIGHT } from './scene'

/**
 * The follow camera's offset from the player, taken from `followCamera` rather
 * than copied, so moving the camera moves these tests with it. The whole
 * question they answer is whether a partition is tall enough to cut that
 * particular sight line — a shallower camera would be blocked by everything, a
 * steeper one by nothing.
 */
const eye = (x: number, z: number) =>
  new THREE.Vector3(x - 1.5, FOLLOW_HEIGHT, z + FOLLOW_DEPTH)

/** One partition, placed exactly the way `syncWalls` places it. */
function wall(uid: string, x: number, y: number, side: 'n' | 'w'): THREE.Mesh[] {
  const group = buildWallSegment(TILE)
  const at = tileToWorld(x, y)

  if (side === 'n') group.position.set(at.x, 0, at.z - TILE / 2)
  else {
    group.position.set(at.x - TILE / 2, 0, at.z)
    group.rotation.y = Math.PI / 2
  }
  group.updateMatrixWorld(true)

  const meshes: THREE.Mesh[] = []
  group.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    child.userData.wallUid = uid
    meshes.push(child)
  })
  return meshes
}

describe('blockingSight', () => {
  const ray = () => new THREE.Raycaster()

  /** Middle of the room, with a partition along the tile's northern edge. */
  const at = tileToWorld(2, 3)
  const edgeZ = at.z - TILE / 2
  const meshes = wall('w1', 2, 3, 'n')

  it('reports a wall the player is standing right behind', () => {
    const px = at.x
    const pz = edgeZ - 0.53

    expect(blockingSight(ray(), eye(px, pz), new THREE.Vector3(px, 0, pz), meshes)).toEqual(
      new Set(['w1']),
    )
  })

  it('leaves the same wall alone once the player steps round to its near side', () => {
    const px = at.x
    const pz = edgeZ + 0.53

    expect(blockingSight(ray(), eye(px, pz), new THREE.Vector3(px, 0, pz), meshes).size).toBe(0)
  })

  it('ignores a wall the player is nowhere near', () => {
    const px = at.x + 6
    const pz = edgeZ - 0.53

    expect(blockingSight(ray(), eye(px, pz), new THREE.Vector3(px, 0, pz), meshes).size).toBe(0)
  })

  it('lets go of a wall the player has walked well clear of', () => {
    const px = at.x
    const pz = edgeZ - 4

    expect(blockingSight(ray(), eye(px, pz), new THREE.Vector3(px, 0, pz), meshes).size).toBe(0)
  })

  it('finds nothing at all in a room without partitions', () => {
    expect(blockingSight(ray(), eye(0, 0), new THREE.Vector3(0, 0, 0), []).size).toBe(0)
  })
})
