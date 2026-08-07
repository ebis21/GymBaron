import * as THREE from 'three'
import type { Client, GameState, Staff } from '../game/types'
import { buildNpc, buildStaffNpc, animate, poseScan, type Rig } from './models/character'
import { stanceFor } from './models/stance'
import { buildStain } from './models/stain'
import { isAtStaffDoor, tileToWorld } from '../game/layout'
import { PATIENCE_MS } from '../game/constants'
import { STAIN_OLD_MS } from '../game/stains'
import { currentLanguage } from '../i18n'
import { queueAnchorFor } from '../game/clientMove'
import { bookingFor } from '../game/staff'
import { PALETTE, blockAt, sphere } from './style'

const BAR_WIDTH = 0.62
const BAR_FULL = new THREE.Color(PALETTE.ghost)
const BAR_EMPTY = new THREE.Color(PALETTE.ghostBad)

// Moved here verbatim from scene.ts, which no longer needs it.
export function buildPatienceBar(): { group: THREE.Group; fill: THREE.Mesh } {
  const group = new THREE.Group()

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(BAR_WIDTH + 0.06, 0.16),
    new THREE.MeshBasicMaterial({ color: '#2b2438', depthTest: false }),
  )
  group.add(bg)

  // Geometry offset so the mesh spans 0..BAR_WIDTH in local space — scaling
  // it then drains the bar from the right instead of squeezing both edges in.
  const fillGeometry = new THREE.PlaneGeometry(BAR_WIDTH, 0.12)
  fillGeometry.translate(BAR_WIDTH / 2, 0, 0)
  const fill = new THREE.Mesh(
    fillGeometry,
    new THREE.MeshBasicMaterial({ color: PALETTE.ghost, depthTest: false }),
  )
  fill.position.set(-BAR_WIDTH / 2, 0, 0.001)
  group.add(fill)

  group.renderOrder = 10
  group.visible = false
  return { group, fill }
}

interface ActorView {
  rig: Rig
  seed: number
  bar: THREE.Group
  barFill: THREE.Mesh
}

/**
 * A coach's whistle on a cord. Every role is drawn the same figure and told
 * apart by the name tag over its head, which is a lot of reading at this
 * camera height — so the one role the player books by hand gets something on
 * the body too. Geometry is fresh per figure, which is what `disposeSubtree`
 * frees; the paint is the shared toon cache, same as every other prop, and is
 * deliberately not disposed with it.
 */
function addWhistle(rig: Rig): void {
  const cord = blockAt(0.44, 0.05, 0.05, PALETTE.frameRed, 0, 0.63, 0.15, { radius: 0.02 })
  cord.rotation.z = 0.14
  rig.hips.add(cord)

  const whistle = sphere(0.08, PALETTE.frameYellow, 10)
  whistle.position.set(0.02, 0.44, 0.2)
  rig.hips.add(whistle)
}

/**
 * Frees a subtree's GPU resources when an actor leaves the floor. Geometry
 * is always safe to free: `blockAt`/`sphere`/`cylinder` (and the bar's own
 * planes) build a fresh one per mesh, never a shared one. Materials are not
 * always safe — a rig's paint comes from `toon()`'s colour cache in style.ts
 * and is shared with every other rig, machine and wall painted the same
 * hue, so disposing it here would break whoever else is still using it.
 * `ownMaterial` marks the few things built with a private material instead:
 * the patience bar's two planes. The one exception either way is a Sprite
 * (the rarity tag) — its own material is always private per rig, even
 * though the texture it points at is still the shared per-rarity cache, so
 * only the material is disposed, never `sprite.material.map`.
 */
function disposeSubtree(root: THREE.Object3D, ownMaterial: boolean): void {
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (ownMaterial) (obj.material as THREE.Material).dispose()
    } else if (obj instanceof THREE.Sprite) {
      obj.material.dispose()
    }
  })
}

/**
 * Draws everyone on the floor. Positions come from the engine, which owns
 * movement so that time spent away from the app still counts; this layer only
 * smooths them out so a 30 Hz simulation does not look like a slideshow.
 */
export class ActorLayer {
  private readonly views = new Map<string, ActorView>()
  private readonly stains = new Map<string, THREE.Mesh>()
  /** Language the current rigs were built in; see `dropViews`. */
  private builtLanguage = currentLanguage()

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Throws every rig away so the next `sync` rebuilds them. Only the language
   * switch needs this: job titles are painted into a sprite when the employee
   * is first drawn, so an employee already on the floor would otherwise keep
   * the old language over their head for as long as they stay hired.
   */
  private dropViews(): void {
    for (const view of this.views.values()) {
      this.scene.remove(view.rig.root)
      this.scene.remove(view.bar)
      disposeSubtree(view.rig.root, false)
      disposeSubtree(view.bar, true)
    }
    this.views.clear()
  }

  sync(state: GameState, elapsed: number): void {
    const language = currentLanguage()
    if (language !== this.builtLanguage) {
      this.dropViews()
      this.builtLanguage = language
    }

    const seen = new Set<string>()

    for (const client of state.clients) {
      seen.add(client.uid)
      const view = this.viewFor(client.uid, () => {
        const seed = Number(client.uid.replace(/\D/g, '')) || 1
        const { group: bar, fill: barFill } = buildPatienceBar()
        return { rig: buildNpc(client.kind, client.rarity, seed), seed, bar, barFill }
      })

      this.place(view, client, state, elapsed)
    }

    for (const staff of state.staff) {
      if (staff.owed > 0) continue // on strike: not in the building, don't even create a view

      seen.add(staff.uid)
      const view = this.viewFor(staff.uid, () => {
        const seed = Number(staff.uid.replace(/\D/g, '')) || 1
        const { group: bar, fill: barFill } = buildPatienceBar()
        const rig = buildStaffNpc(staff.role, staff.rank, seed)
        if (staff.role === 'trainer') addWhistle(rig)
        return { rig, seed, bar, barFill }
      })

      this.placeStaff(view, staff, state, elapsed)
    }

    for (const [uid, view] of this.views) {
      if (seen.has(uid)) continue
      this.scene.remove(view.rig.root)
      this.scene.remove(view.bar)
      disposeSubtree(view.rig.root, false)
      disposeSubtree(view.bar, true)
      this.views.delete(uid)
    }

    const seenStains = new Set<string>()
    for (const stain of state.stains) {
      seenStains.add(stain.uid)
      let mesh = this.stains.get(stain.uid)
      if (!mesh) {
        const variant = Number(stain.uid.replace(/\D/g, '')) || 0
        mesh = buildStain(variant)
        this.stains.set(stain.uid, mesh)
        this.scene.add(mesh)
      }

      const at = tileToWorld(stain.x, stain.y)
      mesh.position.x = at.x
      mesh.position.z = at.z

      const stale = stain.ageMs > STAIN_OLD_MS
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = stale ? 1.0 : 0.92
      mesh.scale.setScalar(stale ? 1.25 : 1)
    }

    for (const [uid, mesh] of this.stains) {
      if (seenStains.has(uid)) continue
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      this.stains.delete(uid)
    }
  }

  /** The rig for one uid, if it is currently on the floor — the camera and
   *  focus-picking in `scene.ts` need to reach into a specific actor's rig. */
  rigFor(uid: string): Rig | undefined {
    return this.views.get(uid)?.rig
  }

  dispose(): void {
    for (const [, view] of this.views) {
      this.scene.remove(view.rig.root)
      this.scene.remove(view.bar)
      disposeSubtree(view.rig.root, false)
      disposeSubtree(view.bar, true)
    }
    this.views.clear()

    for (const [, mesh] of this.stains) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.stains.clear()
  }

  private viewFor(uid: string, make: () => ActorView): ActorView {
    const existing = this.views.get(uid)
    if (existing) return existing

    const view = make()
    this.views.set(uid, view)
    this.scene.add(view.rig.root, view.bar)
    return view
  }

  private place(view: ActorView, client: Client, state: GameState, elapsed: number): void {
    // On a machine the pose is the machine's business: on the saddle, on the
    // belt, flat on the bench, turned with the equipment.
    if (client.phase === 'workout') {
      const machine = state.machines.find(m => m.uid === client.machineUid)
      if (!machine) return

      view.bar.visible = false
      const angle = (machine.rotation * Math.PI) / 2
      const at = tileToWorld(machine.x, machine.y)
      const stance = stanceFor(machine.type)
      const sin = Math.sin(angle)
      const cos = Math.cos(angle)

      view.rig.root.position.set(
        at.x + stance.x * cos + stance.z * sin,
        stance.lift,
        at.z - stance.x * sin + stance.z * cos,
      )
      view.rig.root.rotation.y = angle + stance.facing
      stance.pose(view.rig, elapsed + view.seed)
      return
    }

    // Smoothing, not simulation: the engine's position is the truth, this just
    // stops the 30 Hz step from reading as a stutter.
    const target = new THREE.Vector3(client.x, 0, client.z)
    if (view.rig.root.position.lengthSq() === 0) view.rig.root.position.copy(target)
    else view.rig.root.position.lerp(target, 0.25)

    // Face the way you are going; standing still, keep the last heading —
    // except settled in the queue, where the desk is the point, not
    // whichever way the last step of the walk-up happened to leave you.
    const dx = client.x - view.rig.root.position.x
    const dz = client.z - view.rig.root.position.z
    if (client.phase === 'queue' && client.path.length === 0) {
      view.rig.root.rotation.y = queueAnchorFor(state).angle + Math.PI
    } else if (dx * dx + dz * dz > 1e-4) {
      view.rig.root.rotation.y = Math.atan2(dx, dz)
    }

    const walking = client.path.length > 0
    animate(view.rig, elapsed + view.seed, walking)

    view.bar.visible = client.phase === 'queue'
    if (client.phase === 'queue') {
      const remaining = Math.max(0, 1 - client.phaseMs / PATIENCE_MS)
      view.bar.position.set(client.x, 1.6, client.z)
      view.barFill.scale.x = Math.max(0.001, remaining)
      ;(view.barFill.material as THREE.MeshBasicMaterial).color.lerpColors(
        BAR_EMPTY,
        BAR_FULL,
        remaining,
      )
    }
  }

  private placeStaff(view: ActorView, staff: Staff, state: GameState, elapsed: number): void {
    view.bar.visible = false

    // Off shift they are through the staff door and out of the building. There
    // is nothing behind it to model — stepping off the doorstep is the whole
    // animation, and standing on it is the whole of being away.
    view.rig.root.visible = !isAtStaffDoor(staff.x, staff.z)

    const target = new THREE.Vector3(staff.x, 0, staff.z)
    if (view.rig.root.position.lengthSq() === 0) view.rig.root.position.copy(target)
    else view.rig.root.position.lerp(target, 0.25)

    const walking = staff.path.length > 0
    const atDesk = staff.role === 'reception' && staff.targetUid !== null && !walking

    // A trainer who has arrived turns to the person they are coaching — the
    // whole point of the booking is that the two are working together, and a
    // coach staring off at the wall beside the machine says the opposite.
    const coaching = !walking && staff.role === 'trainer'
      ? bookingFor(state, staff.uid)
      : null

    // Face the way you are going; a receptionist who has arrived faces across
    // the desk into the queue instead, not whichever way the last step of the
    // walk-up happened to leave them.
    if (atDesk) {
      view.rig.root.rotation.y = queueAnchorFor(state).angle
    } else if (coaching) {
      const dx = coaching.x - staff.x
      const dz = coaching.z - staff.z
      if (dx * dx + dz * dz > 1e-4) view.rig.root.rotation.y = Math.atan2(dx, dz)
    } else {
      const dx = staff.x - view.rig.root.position.x
      const dz = staff.z - view.rig.root.position.z
      if (dx * dx + dz * dz > 1e-4) {
        view.rig.root.rotation.y = Math.atan2(dx, dz)
      }
    }

    if (atDesk && staff.workMs > 0) {
      poseScan(view.rig, elapsed + view.seed)
    } else {
      animate(view.rig, elapsed + view.seed, walking)
    }
  }
}
