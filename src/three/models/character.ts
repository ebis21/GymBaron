import * as THREE from 'three'
import type { ClientKind, ClientRarity, StaffRank, StaffRole } from '../../game/types'
import { RARITY_LABEL } from '../../game/content/rarity'
import { ROLE_LABEL } from '../../game/content/staff'
import { PALETTE, blockAt, cylinder, sphere } from '../style'

/**
 * Stubby big-headed characters, the way Hay Day draws people: a head about a
 * third of the body, no neck, no faces to speak of. Every figure exposes its
 * limbs so the scene can walk them without an animation system.
 */
export interface Rig {
  root: THREE.Group
  /** Everything above the feet. Poses tip this over to lie a figure down. */
  hips: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
}

/** Resting height of the hips inside the root. */
const HIP_Y = 0.52

interface Look {
  shirt: string
  trousers: string
  skin: string
  hair: string
}

const RARITY_TINT: Record<ClientRarity, string> = {
  common: '#8a7f6f',
  rare: PALETTE.frameBlue,
  epic: PALETTE.shirtC,
  legend: '#e09a12',
  influencer: PALETTE.crestInfluencer,
}

const TAG_WIDTH = 320
const TAG_HEIGHT = 88
const tagTextures = new Map<ClientRarity, THREE.Texture>()

/** Painted once per rarity and shared — a room can hold a lot of commons. */
function rarityTexture(rarity: ClientRarity): THREE.Texture {
  const cached = tagTextures.get(rarity)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = TAG_WIDTH
  canvas.height = TAG_HEIGHT
  const ctx = canvas.getContext('2d')!

  const inset = 8
  const radius = (TAG_HEIGHT - inset * 2) / 2
  ctx.beginPath()
  ctx.roundRect(inset, inset, TAG_WIDTH - inset * 2, TAG_HEIGHT - inset * 2, radius)
  ctx.fillStyle = RARITY_TINT[rarity]
  ctx.fill()
  ctx.lineWidth = 7
  ctx.strokeStyle = '#2b2438'
  ctx.stroke()

  ctx.fillStyle = '#fffdf7'
  ctx.font = '800 42px Nunito, "Baloo 2", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(RARITY_LABEL[rarity], TAG_WIDTH / 2, TAG_HEIGHT / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  tagTextures.set(rarity, texture)
  return texture
}

function rarityTag(rarity: ClientRarity): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: rarityTexture(rarity), transparent: true }),
  )
  sprite.scale.set(1.05, 1.05 * (TAG_HEIGHT / TAG_WIDTH), 1)
  sprite.position.y = 2.05
  return sprite
}

function figure(look: Look, badge: string | null, rarity: ClientRarity | null = null): Rig {
  const root = new THREE.Group()

  const hips = new THREE.Group()
  hips.position.y = HIP_Y
  root.add(hips)

  hips.add(blockAt(0.52, 0.6, 0.34, look.shirt, 0, 0.3, 0, { radius: 0.14 }))

  const head = sphere(0.29, look.skin, 16)
  head.position.set(0, 0.92, 0)
  hips.add(head)

  hips.add(blockAt(0.5, 0.22, 0.5, look.hair, 0, 1.08, -0.02, { radius: 0.14 }))

  // A name tag over the head, so how much someone is worth reads from across
  // the room. It hangs off the root rather than the hips: a client lying on a
  // bench should still have their label the right way up, above them.
  if (rarity) root.add(rarityTag(rarity))

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

  return { root, hips, armL, armR, legL, legR }
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
  return figure(look, kind === 'member' ? PALETTE.frameYellow : null, rarity)
}

const roleTagTextures = new Map<StaffRole, THREE.Texture>()

/** Painted once per role and shared, same as `rarityTexture` below it. */
function roleTexture(role: StaffRole): THREE.Texture {
  const cached = roleTagTextures.get(role)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = TAG_WIDTH
  canvas.height = TAG_HEIGHT
  const ctx = canvas.getContext('2d')!

  const inset = 8
  const radius = (TAG_HEIGHT - inset * 2) / 2
  ctx.beginPath()
  ctx.roundRect(inset, inset, TAG_WIDTH - inset * 2, TAG_HEIGHT - inset * 2, radius)
  ctx.fillStyle = PALETTE.frameCream
  ctx.fill()
  ctx.lineWidth = 7
  ctx.strokeStyle = '#2b2438'
  ctx.stroke()

  ctx.fillStyle = '#2b2434'
  ctx.font = '800 40px Nunito, "Baloo 2", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ROLE_LABEL[role], TAG_WIDTH / 2, TAG_HEIGHT / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  roleTagTextures.set(role, texture)
  return texture
}

/**
 * Employees carry two tags rather than clients' one: their job title, since
 * that is what the player is scanning the floor for, and their rank tucked
 * in smaller underneath — the same rarity tag clients wear, just secondary
 * here rather than the headline.
 */
export function buildStaffNpc(role: StaffRole, rank: StaffRank, variant: number): Rig {
  const look: Look = {
    shirt: SHIRTS[variant % SHIRTS.length]!,
    trousers: variant % 2 === 0 ? PALETTE.playerTrousers : PALETTE.rubber,
    skin: SKINS[variant % SKINS.length]!,
    hair: PALETTE.hair,
  }
  const rig = figure(look, null, null)

  const title = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: roleTexture(role), transparent: true }),
  )
  title.scale.set(1.05, 1.05 * (TAG_HEIGHT / TAG_WIDTH), 1)
  title.position.y = 2.32
  rig.root.add(title)

  const rank1 = rarityTag(rank)
  rank1.scale.multiplyScalar(0.72)
  rank1.position.y = 2.03
  rig.root.add(rank1)

  return rig
}

/** Puts the body back upright before a pose that assumes it. */
function stand(rig: Rig): void {
  rig.hips.rotation.set(0, 0, 0)
  rig.hips.position.set(0, HIP_Y, 0)
  rig.armL.rotation.set(0, 0, 0)
  rig.armR.rotation.set(0, 0, 0)
  rig.legL.rotation.set(0, 0, 0)
  rig.legR.rotation.set(0, 0, 0)
}

/**
 * Walk cycle and idle breathing, driven straight off the clock. Cheaper and
 * steadier than a keyframed clip, and it never desyncs from movement.
 */
export function animate(rig: Rig, timeSec: number, moving: boolean): void {
  stand(rig)

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

/**
 * How somebody uses one particular machine. Poses only ever touch the hips and
 * the limbs — where the figure stands, how high, and which way it faces is the
 * scene's business, and a pose that moved the root would fight it.
 */
export type Pose = (rig: Rig, timeSec: number) => void

/**
 * Flat on their back under the bar. This is the only pose that lays the body
 * down: the hips tip a quarter turn backwards, which sends the head along the
 * figure's own −Z and turns its face to the ceiling.
 */
export const poseBenchPress: Pose = (rig, t) => {
  stand(rig)
  const pump = Math.sin(t * 3.4)

  rig.hips.rotation.x = -Math.PI / 2
  rig.hips.position.set(0, 0.88, 0)

  // Arms straight up, bending at the bottom of each rep.
  const press = -Math.PI / 2 + 0.42 + pump * 0.42
  rig.armL.rotation.x = press
  rig.armR.rotation.x = press

  // Legs down either side of the bench rather than through it.
  rig.legL.rotation.set(1.45, 0, 0.5)
  rig.legR.rotation.set(1.45, 0, -0.5)
}

/** Seated, hauling a bar down from overhead. */
export const poseSeatedPull: Pose = (rig, t) => {
  stand(rig)
  const pump = Math.sin(t * 3)

  const reach = -2.2 + Math.abs(pump) * 0.85
  rig.armL.rotation.set(reach, 0, 0.22)
  rig.armR.rotation.set(reach, 0, -0.22)
  rig.legL.rotation.x = -1.35
  rig.legR.rotation.x = -1.35
  rig.hips.position.y = HIP_Y - 0.04 + Math.abs(pump) * 0.04
}

/** Seated on the saddle, hands on the bars, legs going round. */
export const poseCycle: Pose = (rig, t) => {
  stand(rig)
  const spin = t * 6

  rig.armL.rotation.set(-1.35, 0, 0.12)
  rig.armR.rotation.set(-1.35, 0, -0.12)
  rig.legL.rotation.x = -1.1 + Math.sin(spin) * 0.55
  rig.legR.rotation.x = -1.1 + Math.sin(spin + Math.PI) * 0.55
  rig.hips.rotation.x = 0.28
}

/** Running on the belt: the walk cycle, quicker, holding onto the rails. */
export const poseRun: Pose = (rig, t) => {
  stand(rig)
  const swing = Math.sin(t * 11) * 0.85

  rig.legL.rotation.x = swing
  rig.legR.rotation.x = -swing
  rig.armL.rotation.set(-0.9, 0, 0.18)
  rig.armR.rotation.set(-0.9, 0, -0.18)
  rig.hips.position.y = HIP_Y + Math.abs(Math.sin(t * 11)) * 0.07
  rig.hips.rotation.x = 0.12
}

/** Standing at the rack, curling a pair of dumbbells. */
export const poseCurl: Pose = (rig, t) => {
  stand(rig)
  const pump = (Math.sin(t * 3.6) + 1) / 2

  const curl = -0.15 - pump * 1.5
  rig.armL.rotation.set(curl, 0, 0.12)
  rig.armR.rotation.set(curl, 0, -0.12)
  rig.hips.position.y = HIP_Y - pump * 0.03
}

/** Standing between the towers, bringing both handles together. */
export const poseCablePull: Pose = (rig, t) => {
  stand(rig)
  const pump = (Math.sin(t * 2.6) + 1) / 2

  rig.armL.rotation.set(-1.5, 0, 1.15 - pump * 0.85)
  rig.armR.rotation.set(-1.5, 0, -1.15 + pump * 0.85)
  rig.legL.rotation.set(0.12, 0, 0.16)
  rig.legR.rotation.set(0.12, 0, -0.16)
  rig.hips.rotation.x = 0.14 + pump * 0.1
}

/**
 * Receptionist at the desk: a steady lean over the counter with one hand
 * dipping down to the scanner, distinct from idle breathing so "working"
 * actually reads as doing something.
 */
export const poseScan: Pose = (rig, t) => {
  stand(rig)
  const dip = Math.sin(t * 2.2)

  rig.hips.rotation.x = 0.18 + Math.abs(dip) * 0.05
  rig.armR.rotation.set(-0.85 + dip * 0.2, 0, -0.12)
  rig.armL.rotation.set(0.08, 0, 0.08)
}
