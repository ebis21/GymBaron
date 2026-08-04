import * as THREE from 'three'

/**
 * A flat, slightly irregular puddle laid on the floor. Kept dark and matte so
 * it reads as dirt at a glance from the overhead build camera, where a stain
 * is only a few pixels across.
 */
export function buildStain(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(0.62, 12)
  const material = new THREE.MeshStandardMaterial({
    color: 0x3f3326,
    roughness: 1,
    transparent: true,
    opacity: 0.82,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.02 // just clear of the floor, to dodge z-fighting
  return mesh
}
