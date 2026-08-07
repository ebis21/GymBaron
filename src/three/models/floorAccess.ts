import * as THREE from 'three'
import { blockAt, cylinder, toon } from '../style'

export interface FloorAccessView {
  root: THREE.Group
  shackle: THREE.Group
  status: THREE.Mesh
}

const INK = '#2b2438'
const GOLD = '#f4b942'
const GOLD_DARK = '#c88927'
const LOCKED = '#e8624a'
const OPEN = '#5fb85f'

/**
 * A chunky wall-mounted padlock. It is deliberately oversized: from the
 * isometric camera it has to read as an interaction point, not wall trim.
 */
export function buildFloorAccess(): FloorAccessView {
  const root = new THREE.Group()
  root.name = 'floor-access'

  // Cream mounting plate and the dark inset behind the lock make the silhouette
  // survive the pale wall even in direct sunlight.
  root.add(
    blockAt(1.65, 2.35, 0.16, '#fff1d6', 0, 1.72, 0, { radius: 0.16, outline: 0.025 }),
    blockAt(1.28, 1.68, 0.12, INK, 0, 1.62, 0.12, { radius: 0.18, outline: 0 }),
  )

  // Up arrow: this fixture leads to another storey even before its lock can be
  // afforded. The triangle is flat to the wall like the rest of the plaque.
  const arrowStem = blockAt(0.18, 0.42, 0.09, GOLD, 0, 2.4, 0.23, {
    radius: 0.04,
    outline: 0,
  })
  const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 3), toon(GOLD))
  arrowHead.position.set(0, 2.73, 0.23)
  arrowHead.castShadow = true
  root.add(arrowStem, arrowHead)

  const body = blockAt(1.02, 0.82, 0.38, LOCKED, 0, 1.26, 0.32, {
    radius: 0.16,
    outline: 0.04,
  })
  root.add(body)

  // Keyhole, built as a dot and a short slot to stay readable at a distance.
  const keyDot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), toon(INK))
  keyDot.position.set(0, 1.38, 0.55)
  const keySlot = blockAt(0.1, 0.24, 0.08, INK, 0, 1.19, 0.54, {
    radius: 0.03,
    outline: 0,
  })
  root.add(keyDot, keySlot)

  // The shackle is one movable group. On purchase it lifts and twists aside,
  // leaving the very same wall object as the permanent floor selector.
  const shackle = new THREE.Group()
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.105, 10, 24, Math.PI),
    toon(GOLD_DARK),
  )
  arc.castShadow = true
  arc.position.y = 0.22
  shackle.add(arc)

  for (const x of [-0.38, 0.38]) {
    const leg = cylinder(0.105, 0.105, 0.43, GOLD_DARK, 12)
    leg.position.set(x, 0, 0)
    shackle.add(leg)
  }
  shackle.position.set(0, 1.83, 0.34)
  root.add(shackle)

  const status = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), toon(LOCKED))
  status.position.set(0.55, 2.11, 0.26)
  root.add(status)

  root.traverse(child => {
    child.userData.floorAccess = true
  })

  return { root, shackle, status }
}

export function setFloorAccessUnlocked(view: FloorAccessView, unlocked: boolean): void {
  view.shackle.position.x = unlocked ? 0.22 : 0
  view.shackle.position.y = unlocked ? 2.05 : 1.83
  view.shackle.rotation.z = unlocked ? -0.28 : 0
  view.status.material = toon(unlocked ? OPEN : LOCKED)
}
