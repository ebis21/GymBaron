import * as THREE from 'three'

const ATLAS_SIZE = 2
const SPILL_VARIANTS = ATLAS_SIZE * ATLAS_SIZE
let atlas: THREE.Texture | null = null

/** One generated atlas is shared by every floor decal; only UVs vary. */
function spillAtlas(): THREE.Texture {
  if (atlas) return atlas

  atlas = new THREE.TextureLoader().load('/assets/game/drink-spills-atlas.png')
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.minFilter = THREE.LinearMipmapLinearFilter
  atlas.magFilter = THREE.LinearFilter
  return atlas
}

/**
 * A top-down drink decal cropped from the generated 2×2 atlas. Cola, sports
 * drink, iced coffee and strawberry shake rotate deterministically by uid, so
 * a stain stays the same drink throughout its lifetime.
 */
export function buildStain(variant: number): THREE.Mesh {
  const index = Math.abs(variant) % SPILL_VARIANTS
  const col = index % ATLAS_SIZE
  const rowFromTop = Math.floor(index / ATLAS_SIZE)
  const u0 = col / ATLAS_SIZE
  const v0 = (ATLAS_SIZE - 1 - rowFromTop) / ATLAS_SIZE

  const geometry = new THREE.PlaneGeometry(1.75, 1.75)
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, u0 + uv.getX(i) / ATLAS_SIZE, v0 + uv.getY(i) / ATLAS_SIZE)
  }
  uv.needsUpdate = true

  const material = new THREE.MeshBasicMaterial({
    map: spillAtlas(),
    transparent: true,
    opacity: 0.92,
    alphaTest: 0.025,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.025
  mesh.renderOrder = 2
  return mesh
}
