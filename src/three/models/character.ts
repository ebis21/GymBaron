import * as THREE from 'three'
import type { ClientKind, ClientRarity, StaffRank, StaffRole } from '../../game/types'
import { RARITY_LABEL } from '../../game/content/rarity'
import { currentLanguage, strings } from '../../i18n'
import { PALETTE, blockAt, cylinder, sphere, toon } from '../style'

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
  /** Permanent forward lean used by characters such as the elderly LIL D. */
  restTilt?: number
  /** A cane-bearing arm stays planted instead of swinging through the prop. */
  steadyRightArm?: boolean
  /** Handheld props are put away while the owner uses exercise equipment. */
  stowDuringWorkout?: THREE.Object3D[]
}

/** Resting height of the hips inside the root. */
const HIP_Y = 0.52

interface Look {
  shirt: string
  trousers: string
  skin: string
  hair: string
}

type Gender = 'female' | 'male'

interface BodyDetails {
  gender?: Gender
  torsoW?: number
  torsoD?: number
  armW?: number
  legW?: number
  headRadius?: number
  biceps?: boolean
  baggySleeves?: boolean
  hairStyle?: 'short' | 'long' | 'fluffy' | 'receding' | 'old'
  chain?: boolean
  syringe?: boolean
  cane?: boolean
  cash?: boolean
}

const RARITY_TINT: Record<ClientRarity, string> = {
  common: '#8a7f6f',
  rare: PALETTE.frameBlue,
  epic: PALETTE.shirtC,
  legend: '#e09a12',
  influencer: PALETTE.crestInfluencer,
  secret: '#2b1838',
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

  ctx.fillStyle = rarity === 'secret' ? '#f6d36d' : '#fffdf7'
  ctx.font = `${rarity === 'secret' ? '800 30px' : '800 42px'} Nunito, "Baloo 2", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(rarity === 'secret' ? 'LIL D. · SECRET' : RARITY_LABEL[rarity], TAG_WIDTH / 2, TAG_HEIGHT / 2 + 2)

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

/** A slim tube joining two local-space points, useful for cords and chains. */
function tubeBetween(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  color: string,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from)
  const tube = cylinder(radius, radius, direction.length(), color, 10)
  tube.position.copy(from).add(to).multiplyScalar(0.5)
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return tube
}

/** A necklace that hangs from the neckline instead of lying flat as a ring. */
export function buildGoldChain(torsoDepth: number): THREE.Group {
  const chain = new THREE.Group()
  chain.name = 'accessory-chain'

  const front = torsoDepth / 2 + 0.035
  const left = new THREE.Vector3(-0.17, 0.64, front)
  const right = new THREE.Vector3(0.17, 0.64, front)
  const drop = new THREE.Vector3(0, 0.43, front + 0.045)
  chain.add(
    tubeBetween(left, drop, 0.022, '#f6c64a'),
    tubeBetween(right, drop, 0.022, '#f6c64a'),
  )

  const medallion = cylinder(0.085, 0.085, 0.045, '#f6c64a', 14)
  medallion.name = 'chain-medallion'
  medallion.rotation.x = Math.PI / 2
  medallion.position.set(0, 0.39, front + 0.065)
  chain.add(medallion)
  return chain
}

/** A card with two visible cords, rather than a badge glued to the shirt. */
function buildMemberLanyard(color: string, torsoDepth: number): THREE.Group {
  const lanyard = new THREE.Group()
  lanyard.name = 'accessory-lanyard'

  const front = torsoDepth / 2 + 0.026
  const drop = new THREE.Vector3(0, 0.4, front + 0.015)
  lanyard.add(
    tubeBetween(new THREE.Vector3(-0.11, 0.64, front), drop, 0.012, '#7d4a26'),
    tubeBetween(new THREE.Vector3(0.11, 0.64, front), drop, 0.012, '#7d4a26'),
    blockAt(0.16, 0.2, 0.045, color, 0, 0.31, front + 0.035, { radius: 0.04 }),
  )
  return lanyard
}

/** Built around an arm pivot: the hand is at y=-0.46 and the tip reaches ground. */
export function buildCaneAccessory(): THREE.Group {
  const cane = new THREE.Group()
  cane.name = 'accessory-cane'

  const shaft = cylinder(0.035, 0.035, 0.61, '#70452f', 10)
  shaft.name = 'cane-shaft'
  shaft.position.set(0, -0.755, 0.045)

  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.035, 7, 14, Math.PI),
    toon('#70452f'),
  )
  hook.name = 'cane-hook'
  hook.position.set(-0.1, -0.45, 0.045)
  hook.castShadow = true

  const tip = sphere(0.042, '#3d3550', 8)
  tip.name = 'cane-tip'
  tip.position.set(0, -1.065, 0.045)
  cane.add(shaft, hook, tip)
  return cane
}

export function buildSyringeAccessory(): THREE.Group {
  const syringe = new THREE.Group()
  syringe.name = 'accessory-syringe'

  const barrel = cylinder(0.026, 0.026, 0.25, '#d8f4ff', 10)
  barrel.rotation.z = Math.PI / 2
  syringe.add(barrel)

  const dose = cylinder(0.018, 0.018, 0.15, '#ef5d99', 8)
  dose.rotation.z = Math.PI / 2
  dose.position.x = -0.02
  syringe.add(dose)

  const needle = cylinder(0.008, 0.008, 0.16, '#6c7785', 8)
  needle.rotation.z = Math.PI / 2
  needle.position.x = 0.2
  syringe.add(needle)
  return syringe
}

function buildCashAccessory(): THREE.Group {
  const cash = new THREE.Group()
  cash.name = 'accessory-cash'
  cash.add(
    blockAt(0.2, 0.115, 0.024, '#78a45e', 0, 0, 0, { radius: 0.015 }),
    blockAt(0.18, 0.1, 0.022, '#9cc47d', 0.035, 0.025, 0.018, { radius: 0.012 }),
  )
  return cash
}

function figure(
  look: Look,
  badge: string | null,
  rarity: ClientRarity | null = null,
  details: BodyDetails = {},
): Rig {
  const root = new THREE.Group()
  const gender = details.gender ?? 'male'
  const torsoW = details.torsoW ?? (gender === 'female' ? 0.48 : 0.52)
  const torsoD = details.torsoD ?? 0.34
  const armW = details.armW ?? 0.17
  const legW = details.legW ?? 0.19
  const headRadius = details.headRadius ?? 0.29

  const hips = new THREE.Group()
  hips.position.y = HIP_Y
  root.add(hips)

  hips.add(blockAt(torsoW, 0.6, torsoD, look.shirt, 0, 0.3, 0, { radius: 0.14 }))
  hips.add(blockAt(gender === 'female' ? 0.52 : 0.46, 0.14, 0.34, look.trousers, 0, 0.04, 0, {
    radius: 0.06,
  }))

  const head = sphere(headRadius, look.skin, 16)
  head.position.set(0, 0.92, 0)
  hips.add(head)

  const hairStyle = details.hairStyle ?? (gender === 'female' ? 'long' : 'short')
  if (hairStyle === 'fluffy') {
    for (const [x, y, z, scale] of [
      [-0.19, 1.08, 0, 1], [0, 1.15, 0, 1.15], [0.19, 1.08, 0, 1],
      [-0.1, 1.07, -0.14, 0.9], [0.1, 1.07, -0.14, 0.9],
    ] as const) {
      const tuft = sphere(0.14 * scale, look.hair, 12)
      tuft.position.set(x, y, z)
      hips.add(tuft)
    }
  } else if (hairStyle === 'receding' || hairStyle === 'old') {
    for (const side of [-1, 1]) {
      const patch = sphere(hairStyle === 'old' ? 0.12 : 0.1, look.hair, 10)
      patch.scale.set(0.9, 1.15, 1)
      patch.position.set(side * 0.2, 1.03, -0.02)
      hips.add(patch)
    }
    hips.add(blockAt(0.32, 0.12, 0.16, look.hair, 0, 1.05, -0.2, { radius: 0.07 }))
  } else {
    hips.add(blockAt(0.5, hairStyle === 'long' ? 0.3 : 0.22, 0.5, look.hair, 0, 1.08, -0.02, {
      radius: 0.14,
    }))
    if (hairStyle === 'long') {
      const ponytail = sphere(0.15, look.hair, 12)
      ponytail.position.set(0, 0.89, -0.27)
      hips.add(ponytail)
    }
  }

  // A name tag over the head, so how much someone is worth reads from across
  // the room. It hangs off the root rather than the hips: a client lying on a
  // bench should still have their label the right way up, above them.
  if (rarity && typeof document !== 'undefined') root.add(rarityTag(rarity))

  for (const side of [-1, 1]) {
    const eye = sphere(0.045, '#2b2438', 8)
    eye.position.set(side * 0.1, 0.95, 0.26)
    hips.add(eye)
  }

  // A member wears their pass on a lanyard — one glance tells the two apart.
  if (badge) {
    hips.add(buildMemberLanyard(badge, torsoD))
  }

  const arm = (x: number): THREE.Group => {
    const pivot = new THREE.Group()
    pivot.position.set(x, 0.56, 0)
    if (details.baggySleeves) {
      pivot.add(blockAt(armW * 1.15, 0.28, armW * 1.15, look.shirt, 0, -0.14, 0, {
        radius: armW * 0.48,
      }))
      pivot.add(blockAt(armW * 0.9, 0.27, armW * 0.9, look.skin, 0, -0.39, 0, {
        radius: armW * 0.42,
      }))
    } else {
      pivot.add(blockAt(armW, 0.46, armW, look.skin, 0, -0.23, 0, { radius: armW * 0.4 }))
    }
    if (details.biceps) {
      const muscle = sphere(armW * 0.72, look.skin, 12)
      muscle.scale.set(1, 1.25, 1)
      muscle.position.y = -0.18
      pivot.add(muscle)
    }
    hips.add(pivot)
    return pivot
  }

  const leg = (x: number): THREE.Group => {
    const pivot = new THREE.Group()
    pivot.position.set(x, 0.02, 0)
    pivot.add(blockAt(legW, 0.5, legW, look.trousers, 0, -0.25, 0, { radius: legW * 0.4 }))
    hips.add(pivot)
    return pivot
  }
  const shoulderX = torsoW / 2 + armW * 0.5
  const armL = arm(-shoulderX)
  const armR = arm(shoulderX)
  const legL = leg(-0.14)
  const legR = leg(0.14)
  const stowDuringWorkout: THREE.Object3D[] = []

  if (details.chain) {
    hips.add(buildGoldChain(torsoD))
  }

  if (details.syringe) {
    const syringe = buildSyringeAccessory()
    syringe.position.set(0, details.baggySleeves ? -0.52 : -0.46, 0.08)
    syringe.rotation.set(0.16, 0, -0.58)
    armR.add(syringe)
    stowDuringWorkout.push(syringe)
  }

  if (details.cane) {
    const cane = buildCaneAccessory()
    armR.add(cane)
    stowDuringWorkout.push(cane)
  }

  if (details.cash) {
    const cash = buildCashAccessory()
    cash.position.set(0, -0.47, 0.1)
    cash.rotation.set(-0.12, 0.16, -0.2)
    armL.add(cash)
    stowDuringWorkout.push(cash)
  }

  // Soft contact patch so nobody looks like they are hovering.
  const blob = cylinder(0.34, 0.34, 0.02, '#c9a878', 14)
  blob.position.y = 0.012
  blob.castShadow = false
  root.add(blob)

  return {
    root,
    hips,
    armL,
    armR,
    legL,
    legR,
    restTilt: details.cane ? 0.13 : 0,
    steadyRightArm: details.cane,
    stowDuringWorkout,
  }
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
  const gender: Gender = variant % 2 === 0 ? 'female' : 'male'
  const skin = SKINS[variant % SKINS.length]!
  const badge = kind === 'member' ? PALETTE.frameYellow : null

  if (rarity === 'secret') {
    return figure(
      { shirt: '#6d5a7e', trousers: '#3f4350', skin: '#d5aa86', hair: '#d7d2c7' },
      null,
      rarity,
      {
        gender: 'male', torsoW: 0.44, torsoD: 0.32, armW: 0.12, legW: 0.14,
        headRadius: 0.27, hairStyle: 'old', cane: true, cash: true,
      },
    )
  }

  const look: Look = {
    shirt: gender === 'female' ? '#c77e91' : '#6f9ca0',
    trousers: gender === 'female' ? '#423f5b' : '#57616b',
    skin,
    hair: gender === 'female' ? '#5a372d' : PALETTE.hair,
  }
  const details: BodyDetails = { gender }

  if (rarity === 'common') {
    details.torsoW = gender === 'female' ? 0.5 : 0.56
    details.torsoD = 0.4
    details.armW = 0.14
    details.legW = 0.18
    details.baggySleeves = true
  } else if (rarity === 'rare') {
    look.shirt = gender === 'female' ? '#f3dce7' : '#f3eee3'
    look.trousers = gender === 'female' ? '#7b4d74' : '#38495a'
    details.torsoW = gender === 'female' ? 0.49 : 0.56
    details.armW = 0.18
  } else if (rarity === 'epic') {
    look.shirt = gender === 'female' ? '#744fc4' : '#3656a5'
    details.torsoW = gender === 'female' ? 0.52 : 0.6
    details.armW = gender === 'female' ? 0.21 : 0.24
    details.biceps = true
  } else if (rarity === 'legend') {
    look.shirt = '#f4ead5'
    look.trousers = gender === 'female' ? '#9a621f' : '#56452e'
    details.torsoW = gender === 'female' ? 0.54 : 0.62
    details.armW = gender === 'female' ? 0.23 : 0.26
    details.biceps = true
    details.hairStyle = 'receding'
  } else {
    look.shirt = gender === 'female' ? '#dc65a0' : '#54447d'
    look.trousers = gender === 'female' ? '#76658c' : '#343542'
    look.hair = gender === 'female' ? '#7e4d38' : '#4e332d'
    details.torsoW = gender === 'female' ? 0.62 : 0.68
    details.torsoD = 0.42
    details.armW = gender === 'female' ? 0.28 : 0.32
    details.legW = 0.24
    details.biceps = true
    details.baggySleeves = true
    details.hairStyle = 'fluffy'
    details.chain = true
    details.syringe = true
  }

  return figure(look, badge, rarity, details)
}

/**
 * Keyed by language as well as role: the job title is painted into the bitmap,
 * so a cache keyed on the role alone would leave the old language floating
 * over everybody's head until the page reloaded.
 */
const roleTagTextures = new Map<string, THREE.Texture>()

/** Painted once per role and language, then shared, same as `rarityTexture`. */
function roleTexture(role: StaffRole): THREE.Texture {
  const language = currentLanguage()
  const key = `${language}:${role}`
  const cached = roleTagTextures.get(key)
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
  ctx.fillText(strings().content.roles[role], TAG_WIDTH / 2, TAG_HEIGHT / 2 + 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  roleTagTextures.set(key, texture)
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
  const rig = figure(look, null, null, { gender: variant % 2 === 0 ? 'female' : 'male' })

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
  rig.hips.rotation.set(rig.restTilt ?? 0, 0, 0)
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
    rig.armR.rotation.x = rig.steadyRightArm ? 0.03 : swing * 0.8
    rig.root.position.y = Math.abs(Math.sin(timeSec * 9)) * 0.06
    return
  }

  const breathe = Math.sin(timeSec * 2) * 0.06
  rig.legL.rotation.x = 0
  rig.legR.rotation.x = 0
  rig.armL.rotation.x = breathe
  rig.armR.rotation.x = rig.steadyRightArm ? 0.03 : -breathe
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
