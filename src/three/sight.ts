import * as THREE from 'three'

/**
 * Chest and head. Two samples rather than one: a low wall can cut across the
 * body while the head is still perfectly visible, and fading in that case
 * would make the room flicker every time the player walked past a partition.
 */
const SAMPLE_HEIGHTS = [1.35, 0.55]

/**
 * Which of `meshes` stand between the camera and the player. Meshes are
 * expected to carry the id of whatever they belong to in
 * `userData.wallUid`; anything without one is ignored.
 *
 * Split out of the scene so the geometry can be checked without a WebGL
 * context — whether a partition of a given height actually intercepts the
 * camera's sight line is a question of angles, not of rendering.
 */
export function blockingSight(
  ray: THREE.Raycaster,
  camera: THREE.Vector3,
  player: THREE.Vector3,
  meshes: THREE.Mesh[],
): Set<string> {
  const blocking = new Set<string>()
  if (meshes.length === 0) return blocking

  const direction = new THREE.Vector3()

  for (const height of SAMPLE_HEIGHTS) {
    direction.set(player.x, height, player.z).sub(camera)
    const distance = direction.length()
    if (distance < 0.001) continue

    ray.set(camera, direction.divideScalar(distance))
    // Anything past the player is behind them, not in the way.
    ray.far = distance

    for (const hit of ray.intersectObjects(meshes, false)) {
      const uid = hit.object.userData.wallUid
      if (typeof uid === 'string') blocking.add(uid)
    }
  }

  return blocking
}
