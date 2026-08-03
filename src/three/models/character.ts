import * as THREE from 'three'
import type { ClientKind, ClientRarity } from '../../game/types'
import { PALETTE, blockAt, cylinder, sphere } from '../style'

/**
 * Stubby big-headed characters, the way Hay Day draws people: a head about a
 * third of the body, no neck, no faces to speak of. Every figure exposes its
 * limbs so the scene can walk them without an animation system.
 */
export interface Rig {
  root: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
}

interface Look {
  shirt: string
  trousers: string
  skin: string
  hair: string
}

function figure(look: Look, badge: string | null, crest: string | null = null): Rig {
  const root = new THREE.Group()

  const hips = new THREE.Group()
  hips.position.y = 0.52
  root.add(hips)

  hips.add(blockAt(0.52, 0.6, 0.34, look.shirt, 0, 0.3, 0, { radius: 0.14 }))

  const head = sphere(0.29, look.skin, 16)
  head.position.set(0, 0.92, 0)
  hips.add(head)

  hips.add(blockAt(0.5, 0.22, 0.5, look.hair, 0, 1.08, -0.02, { radius: 0.14 }))

  // A rare-or-better client floats a small gem over their head, so their
  // value reads from across the room, not just from the scan hint.
  if (crest) {
    const gem = sphere(0.09, crest, 10)
    gem.position.set(0, 1.42, 0)
    hips.add(gem)
  }

  for (const side of [-1, 1]) {
    const eye = sphere(0.045, '#2b2438', 8)
    eye.position.set(side * 0.1, 0.95, 0.26)
    hips.add(eye)
  }

  // A member wears their pass on a lanyard — one glance tells the two apart.
  if (badge) {
    hips.add(blockAt(0.16, 0.2, 0.05, badge, 0, 0.4, 0.2, { radius: 0.04 }))
  }

  const limb = (x: number, y: number, w: number, h: number, color: string): THREE.Group => {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, 0)
    // Offset the mesh so the pivot sits at the shoulder or hip, not the middle.
    pivot.add(blockAt(w, h, w, color, 0, -h / 2, 0, { radius: w * 0.4 }))
    hips.add(pivot)
    return pivot
  }

  const armL = limb(-0.34, 0.56, 0.17, 0.46, look.skin)
  const armR = limb(0.34, 0.56, 0.17, 0.46, look.skin)
  const legL = limb(-0.14, 0.02, 0.19, 0.5, look.trousers)
  const legR = limb(0.14, 0.02, 0.19, 0.5, look.trousers)

  // Soft contact patch so nobody looks like they are hovering.
  const blob = cylinder(0.34, 0.34, 0.02, '#c9a878', 14)
  blob.position.y = 0.012
  blob.castShadow = false
  root.add(blob)

  return { root, armL, armR, legL, legR }
}

export function buildPlayer(): Rig {
  return figure(
    {
      shirt: PALETTE.playerShirt,
      trousers: PALETTE.playerTrousers,
      skin: PALETTE.skin,
      hair: PALETTE.hair,
    },
    null,
  )
}

const SHIRTS = [PALETTE.shirtA, PALETTE.shirtB, PALETTE.shirtC, PALETTE.shirtD]
const SKINS = [PALETTE.skin, PALETTE.skinDeep]

/** Common gets no crest — a gem over every head would just be noise. */
const RARITY_CREST: Record<ClientRarity, string | null> = {
  common: null,
  rare: PALETTE.frameBlue,
  epic: PALETTE.shirtC,
  legend: PALETTE.frameYellow,
  influencer: PALETTE.crestInfluencer,
}

/**
 * `variant` is derived from the client's id, so the same person keeps the same
 * shirt for their whole visit instead of flickering between frames.
 */
export function buildNpc(kind: ClientKind, rarity: ClientRarity, variant: number): Rig {
  const look: Look = {
    shirt: SHIRTS[variant % SHIRTS.length]!,
    trousers: variant % 2 === 0 ? PALETTE.playerTrousers : PALETTE.rubber,
    skin: SKINS[variant % SKINS.length]!,
    hair: PALETTE.hair,
  }
  return figure(look, kind === 'member' ? PALETTE.frameYellow : null, RARITY_CREST[rarity])
}

/**
 * Walk cycle and idle breathing, driven straight off the clock. Cheaper and
 * steadier than a keyframed clip, and it never desyncs from movement.
 */
export function animate(rig: Rig, timeSec: number, moving: boolean): void {
  if (moving) {
    const swing = Math.sin(timeSec * 9) * 0.7
    rig.legL.rotation.x = swing
    rig.legR.rotation.x = -swing
    rig.armL.rotation.x = -swing * 0.8
    rig.armR.rotation.x = swing * 0.8
    rig.root.position.y = Math.abs(Math.sin(timeSec * 9)) * 0.06
    return
  }

  const breathe = Math.sin(timeSec * 2) * 0.06
  rig.legL.rotation.x = 0
  rig.legR.rotation.x = 0
  rig.armL.rotation.x = breathe
  rig.armR.rotation.x = -breathe
  rig.root.position.y = 0
}

/** Someone mid-set: seated, pumping. Used for clients on a machine. */
export function animateWorkout(rig: Rig, timeSec: number): void {
  const pump = Math.sin(timeSec * 5)
  rig.armL.rotation.x = -1.1 + pump * 0.5
  rig.armR.rotation.x = -1.1 + pump * 0.5
  rig.legL.rotation.x = -0.5
  rig.legR.rotation.x = -0.5
  rig.root.position.y = 0.1 + pump * 0.03
}
