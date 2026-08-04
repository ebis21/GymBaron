import * as THREE from 'three'
import type { Client, GameState } from '../game/types'
import { buildNpc, animate, type Rig } from './models/character'
import { stanceFor } from './models/stance'
import { tileToWorld } from '../game/layout'
import { PATIENCE_MS } from '../game/constants'
import { PALETTE } from './style'

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
 * Draws everyone on the floor. Positions come from the engine, which owns
 * movement so that time spent away from the app still counts; this layer only
 * smooths them out so a 30 Hz simulation does not look like a slideshow.
 */
export class ActorLayer {
  private readonly views = new Map<string, ActorView>()

  constructor(private readonly scene: THREE.Scene) {}

  sync(state: GameState, elapsed: number): void {
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

    for (const [uid, view] of this.views) {
      if (seen.has(uid)) continue
      this.scene.remove(view.rig.root)
      this.scene.remove(view.bar)
      this.views.delete(uid)
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
    }
    this.views.clear()
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

    // Face the way you are going; standing still, keep the last heading.
    const dx = client.x - view.rig.root.position.x
    const dz = client.z - view.rig.root.position.z
    if (dx * dx + dz * dz > 1e-4) view.rig.root.rotation.y = Math.atan2(dx, dz)

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
}
