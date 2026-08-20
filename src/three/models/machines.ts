import * as THREE from 'three'
import type { BaseMachineTypeId, MachineTypeId } from '../../game/types'
import { bySupplierMachine, supplierOf, type SupplierId } from '../../game/content/suppliers'
import { PALETTE, blockAt, cylinder, toon } from '../style'

/**
 * Every machine in the game, built from rounded blocks and painted like a
 * toy. Each one returns a group standing on y = 0 and fitting inside a single
 * 2×2 tile, so the scene can drop it straight onto the grid.
 *
 * This module is the whole art budget for equipment. Swapping procedural
 * models for loaded glTF files means rewriting this file and nothing else.
 */

/**
 * Weight plate on its edge, the shape that reads as "gym" at a glance. A
 * cylinder stands on its end by default, so every plate has to be tipped onto
 * the axis of the bar it is loaded on — `axis` says which one that is.
 */
function plate(radius: number, color: string, axis: 'x' | 'z' = 'x'): THREE.Mesh {
  const disc = cylinder(radius, radius, 0.12, color, 20)
  if (axis === 'x') disc.rotation.z = Math.PI / 2
  else disc.rotation.x = Math.PI / 2
  return disc
}

function dumbbell(length: number, color: string): THREE.Group {
  const g = new THREE.Group()

  const bar = cylinder(0.06, 0.06, length, PALETTE.chrome, 10)
  bar.rotation.z = Math.PI / 2
  g.add(bar)

  for (const side of [-1, 1]) {
    const outer = plate(0.22, color)
    outer.position.x = side * (length / 2 - 0.06)
    const inner = plate(0.17, color)
    inner.position.x = side * (length / 2 - 0.22)
    g.add(outer, inner)
  }

  return g
}

/** Rack of dumbbells — the cheapest kit, and it should look it: just a shelf. */
function buildDumbbells(): THREE.Group {
  const g = new THREE.Group()

  g.add(blockAt(1.5, 0.16, 0.62, PALETTE.wood, 0, 0.34, 0, { radius: 0.06 }))
  g.add(blockAt(1.5, 0.16, 0.62, PALETTE.wood, 0, 0.74, -0.12, { radius: 0.06 }))

  for (const side of [-1, 1]) {
    g.add(blockAt(0.14, 0.9, 0.14, PALETTE.frameRed, side * 0.68, 0.45, 0.22, { radius: 0.05 }))
    g.add(blockAt(0.14, 0.9, 0.14, PALETTE.frameRed, side * 0.68, 0.45, -0.3, { radius: 0.05 }))
  }

  const colors = [PALETTE.frameYellow, PALETTE.frameTeal, PALETTE.frameBlue]
  colors.forEach((color, i) => {
    const d = dumbbell(0.72, color)
    d.position.set(-0.45 + i * 0.45, 0.52, 0.02)
    g.add(d)
  })

  const top = dumbbell(0.66, PALETTE.frameRed)
  top.position.set(-0.2, 0.92, -0.12)
  g.add(top)

  return g
}

/** Flat bench with a loaded barbell on the uprights. */
function buildBench(): THREE.Group {
  const g = new THREE.Group()

  g.add(blockAt(1.5, 0.22, 0.5, PALETTE.frameRed, 0, 0.62, 0, { radius: 0.1 }))
  g.add(blockAt(1.5, 0.1, 0.5, PALETTE.rubber, 0, 0.48, 0, { radius: 0.04 }))

  for (const x of [-0.55, 0.55]) {
    g.add(blockAt(0.16, 0.5, 0.16, PALETTE.chrome, x, 0.25, 0, { radius: 0.05 }))
  }
  g.add(blockAt(1.3, 0.12, 0.16, PALETTE.chrome, 0, 0.06, 0, { radius: 0.05 }))

  // Uprights and the bar resting on them.
  for (const z of [-0.42, 0.42]) {
    g.add(blockAt(0.16, 1.15, 0.16, PALETTE.frameBlue, -0.62, 0.57, z, { radius: 0.05 }))
  }

  const bar = cylinder(0.055, 0.055, 1.5, PALETTE.chrome, 12)
  bar.rotation.x = Math.PI / 2
  bar.position.set(-0.62, 1.16, 0)
  g.add(bar)

  // Plates loaded onto the bar: threaded on its Z axis, not lying on the floor.
  for (const side of [-1, 1]) {
    for (const [offset, radius] of [
      [0.6, 0.3],
      [0.46, 0.26],
    ] as const) {
      const disc = plate(radius, PALETTE.frameYellow, 'z')
      disc.position.set(-0.62, 1.16, side * offset)
      g.add(disc)
    }

    // Collar holding the stack against the sleeve.
    const collar = cylinder(0.09, 0.09, 0.09, PALETTE.chrome, 12)
    collar.rotation.x = Math.PI / 2
    collar.position.set(-0.62, 1.16, side * 0.68)
    g.add(collar)
  }

  return g
}

/** Treadmill: sloped deck, rolling belt, console up front. */
function buildTreadmill(): THREE.Group {
  const g = new THREE.Group()

  g.add(blockAt(0.86, 0.28, 1.6, PALETTE.frameCream, 0, 0.3, 0.06, { radius: 0.1 }))
  g.add(blockAt(0.66, 0.1, 1.35, PALETTE.rubber, 0, 0.47, 0.1, { radius: 0.04 }))

  for (const side of [-1, 1]) {
    g.add(blockAt(0.1, 0.12, 1.35, PALETTE.frameTeal, side * 0.4, 0.5, 0.1, { radius: 0.04 }))
  }

  // Uprights, console, and the two grab rails.
  for (const side of [-1, 1]) {
    g.add(blockAt(0.14, 1.15, 0.14, PALETTE.frameTeal, side * 0.36, 0.9, -0.62, { radius: 0.05 }))
    const rail = cylinder(0.05, 0.05, 0.7, PALETTE.chrome, 10)
    rail.rotation.x = Math.PI / 2
    rail.position.set(side * 0.36, 1.24, -0.3)
    g.add(rail)
  }

  g.add(blockAt(0.86, 0.44, 0.16, PALETTE.frameBlue, 0, 1.48, -0.6, { radius: 0.07 }))
  g.add(blockAt(0.62, 0.26, 0.06, PALETTE.window, 0, 1.5, -0.7, { radius: 0.04 }))

  return g
}

/** Lat pulldown: tall frame, weight stack, seat, bar on a cable. */
function buildLatPulldown(): THREE.Group {
  const g = new THREE.Group()

  g.add(blockAt(0.6, 0.2, 0.6, PALETTE.rubber, 0, 0.1, -0.5, { radius: 0.06 }))
  for (let i = 0; i < 6; i += 1) {
    const color = i < 3 ? PALETTE.frameYellow : PALETTE.chrome
    g.add(blockAt(0.52, 0.13, 0.52, color, 0, 0.28 + i * 0.15, -0.5, { radius: 0.04 }))
  }

  for (const side of [-1, 1]) {
    g.add(blockAt(0.14, 2.05, 0.14, PALETTE.frameBlue, side * 0.36, 1.02, -0.5, { radius: 0.05 }))
  }
  g.add(blockAt(0.9, 0.16, 0.6, PALETTE.frameBlue, 0, 2.05, -0.34, { radius: 0.06 }))

  // Cable running forward to the bar.
  const cable = cylinder(0.025, 0.025, 0.62, PALETTE.rubber, 6)
  cable.position.set(0, 1.78, -0.06)
  g.add(cable)

  const bar = cylinder(0.05, 0.05, 1.05, PALETTE.frameRed, 12)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, 1.47, -0.06)
  g.add(bar)
  for (const side of [-1, 1]) {
    const grip = cylinder(0.05, 0.05, 0.26, PALETTE.frameRed, 10)
    grip.position.set(side * 0.5, 1.35, -0.06)
    grip.rotation.z = side * 0.5
    g.add(grip)
  }

  // Seat and thigh pad.
  g.add(blockAt(0.62, 0.18, 0.52, PALETTE.frameRed, 0, 0.66, 0.18, { radius: 0.08 }))
  g.add(blockAt(0.18, 0.5, 0.18, PALETTE.chrome, 0, 0.4, 0.18, { radius: 0.06 }))
  g.add(blockAt(0.66, 0.16, 0.2, PALETTE.frameRed, 0, 1.0, 0.5, { radius: 0.07 }))

  return g
}

/** Spin bike: heavy flywheel up front, saddle and bars behind. */
function buildBike(): THREE.Group {
  const g = new THREE.Group()

  const flywheel = cylinder(0.42, 0.42, 0.12, PALETTE.frameYellow, 24)
  flywheel.rotation.z = Math.PI / 2
  flywheel.position.set(0, 0.62, -0.5)
  g.add(flywheel)

  const hub = cylinder(0.12, 0.12, 0.18, PALETTE.chrome, 12)
  hub.rotation.z = Math.PI / 2
  hub.position.set(0, 0.62, -0.5)
  g.add(hub)

  // Feet, frame spine, and the two posts.
  for (const z of [-0.6, 0.55]) {
    g.add(blockAt(0.8, 0.14, 0.18, PALETTE.frameTeal, 0, 0.07, z, { radius: 0.06 }))
  }
  g.add(blockAt(0.16, 0.16, 1.3, PALETTE.frameTeal, 0, 0.16, -0.02, { radius: 0.06 }))

  const spine = blockAt(0.16, 1.0, 0.16, PALETTE.frameTeal, 0, 0.6, 0.34, { radius: 0.06 })
  spine.rotation.x = -0.22
  g.add(spine)

  const stem = blockAt(0.16, 1.15, 0.16, PALETTE.frameTeal, 0, 0.7, -0.34, { radius: 0.06 })
  stem.rotation.x = 0.2
  g.add(stem)

  g.add(blockAt(0.24, 0.12, 0.52, PALETTE.rubber, 0, 1.09, 0.26, { radius: 0.06 }))

  const bars = cylinder(0.045, 0.045, 0.6, PALETTE.chrome, 10)
  bars.rotation.z = Math.PI / 2
  bars.position.set(0, 1.28, -0.44)
  g.add(bars)
  for (const side of [-1, 1]) {
    const horn = cylinder(0.045, 0.045, 0.3, PALETTE.frameRed, 10)
    horn.rotation.x = Math.PI / 2
    horn.position.set(side * 0.28, 1.28, -0.3)
    g.add(horn)
  }

  for (const side of [-1, 1]) {
    const crank = blockAt(0.08, 0.34, 0.08, PALETTE.chrome, side * 0.18, 0.44, -0.14, {
      radius: 0.03,
    })
    crank.rotation.x = side * 0.9
    g.add(crank)
  }

  return g
}

/** Cable crossover: two towers, a crossbar, and stacks on both sides. */
function buildCable(): THREE.Group {
  const g = new THREE.Group()

  for (const side of [-1, 1]) {
    const x = side * 0.62

    g.add(blockAt(0.5, 0.16, 0.9, PALETTE.rubber, x, 0.08, 0, { radius: 0.05 }))
    g.add(blockAt(0.2, 2.3, 0.2, PALETTE.frameRed, x, 1.15, -0.3, { radius: 0.06 }))
    g.add(blockAt(0.2, 2.3, 0.2, PALETTE.frameRed, x, 1.15, 0.3, { radius: 0.06 }))

    for (let i = 0; i < 7; i += 1) {
      const color = i < 4 ? PALETTE.frameBlue : PALETTE.chrome
      g.add(blockAt(0.34, 0.12, 0.5, color, x, 0.26 + i * 0.14, 0, { radius: 0.03 }))
    }

    const pulley = cylinder(0.12, 0.12, 0.08, PALETTE.frameYellow, 14)
    pulley.rotation.x = Math.PI / 2
    pulley.position.set(x, 2.16, 0)
    g.add(pulley)

    const cable = cylinder(0.022, 0.022, 0.5, PALETTE.rubber, 6)
    cable.position.set(x, 1.86, 0)
    g.add(cable)

    const handle = cylinder(0.045, 0.045, 0.26, PALETTE.frameYellow, 10)
    handle.rotation.z = Math.PI / 2
    handle.position.set(x, 1.58, 0)
    g.add(handle)
  }

  // Crossbar tying the two towers together, plus a pull-up grip.
  g.add(blockAt(1.6, 0.2, 0.24, PALETTE.frameRed, 0, 2.36, 0, { radius: 0.07 }))
  const chin = cylinder(0.05, 0.05, 0.9, PALETTE.chrome, 12)
  chin.rotation.z = Math.PI / 2
  chin.position.set(0, 2.2, 0.24)
  g.add(chin)

  return g
}

const BASE_BUILDERS: Record<BaseMachineTypeId, () => THREE.Group> = {
  dumbbells: buildDumbbells,
  bench: buildBench,
  treadmill: buildTreadmill,
  latpulldown: buildLatPulldown,
  bike: buildBike,
  cable: buildCable,
}

/**
 * The badge bolted to the foot of a supplier's machine. It is the only thing
 * that distinguishes their kit from the equipment it is a better version of,
 * and that is the point: a player should recognise a bench as a bench across
 * the room, and read the tier off the colour once they are standing at it.
 */
const SUPPLIER_TINT: Record<SupplierId, string> = {
  ferrum: PALETTE.frameBlue,
  apex: PALETTE.frameYellow,
}

function badged(model: THREE.Group, tint: string): THREE.Group {
  model.add(blockAt(0.34, 0.1, 0.06, tint, 0, 0.06, 0.42, { radius: 0.03 }))
  return model
}

/**
 * Supplier kit reuses the archetype's model rather than getting one of its
 * own. Ten bespoke meshes would be ten chances to ship a machine nobody
 * modelled, and the fiction does not want them anyway — a Ferrum bench is a
 * bench, made better.
 */
const BUILDERS: Record<MachineTypeId, () => THREE.Group> = {
  ...BASE_BUILDERS,
  ...bySupplierMachine((archetype, id) => () => {
    const owner = supplierOf(id)
    const model = BASE_BUILDERS[archetype]()
    return owner ? badged(model, SUPPLIER_TINT[owner]) : model
  }),
}

export function buildMachine(type: MachineTypeId): THREE.Group {
  return BUILDERS[type]()
}

/**
 * Ghost preview of a machine about to be placed. Same silhouette, no outline,
 * washed green so it reads as intent rather than a real object.
 */
export function buildGhost(type: MachineTypeId): THREE.Group {
  const g = buildMachine(type)
  const material = toon(PALETTE.ghost, { transparent: true, opacity: 0.45 })

  g.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.material = material
      child.castShadow = false
      child.receiveShadow = false
    }
  })

  return g
}
