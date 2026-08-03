import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Every colour and every material in the game comes from here. The look is
 * Hay Day: warm daylight, candy-saturated paint, no grey steel anywhere. Kit
 * that would be gunmetal in a real gym is painted coral and teal instead,
 * because readability at a distance beats realism in a toy world.
 */
export const PALETTE = {
  sky: '#bfe9ff',
  sunlight: '#fff4d6',

  floorLight: '#f6dfae',
  floorDark: '#ecc98a',

  wall: '#fdf3e0',
  wallTrim: '#f0d9b5',
  skirting: '#d9a441',
  window: '#cdeeff',

  frameRed: '#e8624a',
  frameBlue: '#4b83c4',
  frameTeal: '#3fa796',
  frameYellow: '#f4b942',
  frameCream: '#fff1d6',

  rubber: '#3d3550',
  chrome: '#dfe6ef',
  leather: '#8f4a3c',
  wood: '#c98a4b',

  skin: '#f2c199',
  skinDeep: '#c98a5e',
  shirtA: '#ef7d57',
  shirtB: '#4fc3a1',
  shirtC: '#7a6ff0',
  shirtD: '#f2b134',
  hair: '#4a3728',
  playerShirt: '#f25c54',
  playerTrousers: '#3b5b8c',

  leaf: '#5fb85f',
  pot: '#d97757',
  ghost: '#7ee787',
  ghostBad: '#ff8f8f',
  crestInfluencer: '#ff5fae',
} as const

/**
 * Three-step ramp. Toon shading is what separates a cartoon from a plastic
 * render — light either hits a surface or it does not, with one soft step in
 * between and no gradient anywhere.
 */
function gradientMap(): THREE.DataTexture {
  const steps = new Uint8Array([90, 190, 255])
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

const RAMP = gradientMap()
const cache = new Map<string, THREE.MeshToonMaterial>()

/** Shared toon material per colour — one gym holds a lot of repeated paint. */
export function toon(color: string, opts: { transparent?: boolean; opacity?: number } = {}) {
  const key = `${color}|${opts.transparent ?? false}|${opts.opacity ?? 1}`
  const hit = cache.get(key)
  if (hit) return hit

  const mat = new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: RAMP,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  })
  cache.set(key, mat)
  return mat
}

const OUTLINE = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#2b2438'),
  side: THREE.BackSide,
})

/** Chunky rounded box — the single shape the whole art style is built from. */
export function rounded(
  w: number,
  h: number,
  d: number,
  radius = Math.min(w, h, d) * 0.22,
  segments = 3,
): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, segments, Math.max(0.01, radius))
}

export interface BlockOptions {
  radius?: number
  outline?: number
  castShadow?: boolean
  receiveShadow?: boolean
}

/**
 * A painted block with an ink outline, drawn as an inverted copy of the mesh
 * scaled up a hair. Cheaper than a post-process pass and it survives any
 * camera angle.
 */
export function block(
  w: number,
  h: number,
  d: number,
  color: string,
  opts: BlockOptions = {},
): THREE.Group {
  const group = new THREE.Group()
  const geometry = rounded(w, h, d, opts.radius)

  const mesh = new THREE.Mesh(geometry, toon(color))
  mesh.castShadow = opts.castShadow ?? true
  mesh.receiveShadow = opts.receiveShadow ?? true
  group.add(mesh)

  const thickness = opts.outline ?? 0.035
  if (thickness > 0) {
    const ink = new THREE.Mesh(geometry, OUTLINE)
    ink.scale.setScalar(1 + thickness / Math.max(w, h, d))
    // Flagged so anything that fades an object can take the outline off
    // altogether: an inverted hull painted ink has no inside worth seeing
    // through, and dimming it just turns the object into a black slab.
    ink.userData.outline = true
    group.add(ink)
  }

  return group
}

/** Convenience: a block already moved to its resting place. */
export function blockAt(
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number,
  opts: BlockOptions = {},
): THREE.Group {
  const g = block(w, h, d, color, opts)
  g.position.set(x, y, z)
  return g
}

export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: string,
  radialSegments = 16,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    toon(color),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Breaks a group off the shared material cache and hands back its own copies,
 * so it can be faded — or otherwise repainted — without every other object of
 * the same colour changing with it. Only worth doing for the few objects that
 * really animate their material; everything else keeps sharing.
 */
export function ownMaterials(root: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = []

  root.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    const own = (child.material as THREE.Material).clone()
    child.material = own
    materials.push(own)
  })

  return materials
}

export function sphere(radius: number, color: string, segments = 18): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), toon(color))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
