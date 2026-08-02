import * as THREE from 'three'
import type { GameState, Machine, MachineTypeId } from '../game/types'
import { buildHall } from './models/floor'
import { buildGhost, buildMachine } from './models/machines'
import { animate, animateWorkout, buildNpc, buildPlayer, type Rig } from './models/character'
import { Controls } from './controls'
import {
  HALL_D,
  HALL_W,
  REACH,
  TILE,
  insideGrid,
  queueSpot,
  tileToWorld,
  worldToTile,
} from './layout'
import { PALETTE, toon } from './style'

/** What the player is close enough to act on right now. */
export type Focus =
  | { kind: 'scan'; clientUid: string }
  | { kind: 'repair'; machineUid: string }
  | { kind: 'place'; x: number; y: number }
  | null

const PLAYER_SPEED = 5.4
const PLAYER_RADIUS = 0.42
/** Half-width of a machine's footprint for collision, a little under a tile. */
const MACHINE_HALF = 0.78

const sameFocus = (a: Focus, b: Focus): boolean => {
  if (a === null || b === null) return a === b
  if (a.kind === 'scan' && b.kind === 'scan') return a.clientUid === b.clientUid
  if (a.kind === 'repair' && b.kind === 'repair') return a.machineUid === b.machineUid
  if (a.kind === 'place' && b.kind === 'place') return a.x === b.x && a.y === b.y
  return false
}

interface MachineView {
  group: THREE.Group
  broken: THREE.Mesh
}

interface NpcView {
  rig: Rig
  seed: number
}

/**
 * Owns the whole 3D world. The engine never learns that this exists: the scene
 * reads game state in `sync`, reports what the player is standing next to
 * through `onFocus`, and otherwise minds its own business.
 */
export class GymScene {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls = new Controls()

  private readonly player: Rig
  private readonly playerPos = new THREE.Vector3(-HALL_W / 2 + 3.4, 0, 3)
  private playerFacing = 0

  private readonly machines = new Map<string, MachineView>()
  private readonly npcs = new Map<string, NpcView>()
  private readonly blocked = new Set<string>()

  private ghost: THREE.Group | null = null
  private ghostType: MachineTypeId | null = null
  private readonly ghostPad: THREE.Mesh

  private state: GameState | null = null
  private pending: MachineTypeId | null = null
  private focus: Focus = null
  private elapsed = 0
  private cameraPlaced = false

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFocus: (focus: Focus) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene.background = new THREE.Color(PALETTE.sky)
    this.scene.fog = new THREE.Fog(PALETTE.sky, 34, 66)

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200)
    this.scene.add(buildHall())
    this.addLights()

    this.player = buildPlayer()
    this.scene.add(this.player.root)

    // Footprint under the player, shown only while a purchase is in hand.
    this.ghostPad = new THREE.Mesh(
      new THREE.BoxGeometry(TILE * 0.94, 0.04, TILE * 0.94),
      toon(PALETTE.ghost, { transparent: true, opacity: 0.5 }),
    )
    this.ghostPad.visible = false
    this.scene.add(this.ghostPad)

    this.resize()
  }

  private addLights(): void {
    // Sky above, warm bounce off the floor — the base of the Hay Day palette.
    this.scene.add(new THREE.HemisphereLight(PALETTE.sky, PALETTE.floorDark, 1.5))

    const sun = new THREE.DirectionalLight(PALETTE.sunlight, 2.1)
    sun.position.set(-9, 16, 9)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0006

    const cam = sun.shadow.camera
    cam.left = -HALL_W
    cam.right = HALL_W
    cam.top = HALL_D
    cam.bottom = -HALL_D
    cam.near = 1
    cam.far = 60
    cam.updateProjectionMatrix()

    this.scene.add(sun)
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.35))
  }

  // --- state synchronisation ------------------------------------------------

  /**
   * Brings the 3D world in line with the engine. Objects are matched by uid so
   * a frame only touches what actually changed — rebuilding the room every
   * tick would throw away the shadow maps.
   */
  sync(state: GameState, pending: MachineTypeId | null): void {
    this.state = state
    this.pending = pending

    this.syncMachines(state.machines)
    this.syncNpcs(state)
    this.syncGhost(pending)
  }

  private syncMachines(machines: Machine[]): void {
    const seen = new Set<string>()
    this.blocked.clear()

    for (const machine of machines) {
      seen.add(machine.uid)
      this.blocked.add(`${machine.x},${machine.y}`)

      let view = this.machines.get(machine.uid)
      if (!view) {
        const group = buildMachine(machine.type)
        const at = tileToWorld(machine.x, machine.y)
        group.position.set(at.x, 0, at.z)
        // Machines in the back rows face into the room.
        group.rotation.y = machine.y < 3 ? 0 : Math.PI

        const broken = new THREE.Mesh(
          new THREE.TorusGeometry(0.75, 0.09, 8, 24),
          toon(PALETTE.ghostBad),
        )
        broken.rotation.x = Math.PI / 2
        broken.position.y = 0.06
        broken.visible = false
        group.add(broken)

        view = { group, broken }
        this.machines.set(machine.uid, view)
        this.scene.add(group)
      }

      view.broken.visible = machine.durability <= 0
    }

    for (const [uid, view] of this.machines) {
      if (seen.has(uid)) continue
      this.scene.remove(view.group)
      this.machines.delete(uid)
    }
  }

  private syncNpcs(state: GameState): void {
    const seen = new Set<string>()
    let queueIndex = 0

    for (const client of state.clients) {
      seen.add(client.uid)

      let view = this.npcs.get(client.uid)
      if (!view) {
        // Derive the look from the uid so a visitor keeps one appearance.
        const seed = Number(client.uid.replace(/\D/g, '')) || 1
        view = { rig: buildNpc(client.kind, seed), seed }
        this.npcs.set(client.uid, view)
        this.scene.add(view.rig.root)
      }

      if (client.phase === 'queue') {
        const spot = queueSpot(queueIndex)
        queueIndex += 1
        view.rig.root.position.set(spot.x, 0, spot.z)
        view.rig.root.rotation.y = Math.PI / 2
        animate(view.rig, this.elapsed + view.seed, false)
        continue
      }

      const machine = state.machines.find(m => m.uid === client.machineUid)
      if (!machine) continue

      const at = tileToWorld(machine.x, machine.y)
      view.rig.root.position.set(at.x, 0, at.z + 0.55)
      view.rig.root.rotation.y = Math.PI
      animateWorkout(view.rig, this.elapsed + view.seed)
    }

    for (const [uid, view] of this.npcs) {
      if (seen.has(uid)) continue
      this.scene.remove(view.rig.root)
      this.npcs.delete(uid)
    }
  }

  private syncGhost(pending: MachineTypeId | null): void {
    if (pending === this.ghostType) return

    if (this.ghost) {
      this.scene.remove(this.ghost)
      this.ghost = null
    }
    this.ghostType = pending

    if (pending) {
      this.ghost = buildGhost(pending)
      this.scene.add(this.ghost)
    }
  }

  // --- per-frame ------------------------------------------------------------

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 100) / 1000
    this.elapsed += dt

    this.movePlayer(dt)
    this.updateGhost()
    this.updateFocus()
    this.followCamera(dt)

    this.renderer.render(this.scene, this.camera)
  }

  private movePlayer(dt: number): void {
    const dir = this.controls.vector()
    const moving = dir.x !== 0 || dir.z !== 0

    if (moving) {
      const step = PLAYER_SPEED * dt
      // Resolve each axis on its own so walking into a machine slides along it
      // instead of sticking.
      const tryX = this.playerPos.x + dir.x * step
      if (this.walkable(tryX, this.playerPos.z)) this.playerPos.x = tryX

      const tryZ = this.playerPos.z + dir.z * step
      if (this.walkable(this.playerPos.x, tryZ)) this.playerPos.z = tryZ

      this.playerFacing = Math.atan2(dir.x, dir.z)
    }

    this.player.root.position.x = this.playerPos.x
    this.player.root.position.z = this.playerPos.z

    // Ease into the new heading rather than snapping.
    const turn =
      ((this.playerFacing - this.player.root.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI
    this.player.root.rotation.y += turn * Math.min(1, dt * 14)

    animate(this.player, this.elapsed, moving)
  }

  private walkable(x: number, z: number): boolean {
    const limitX = HALL_W / 2 - PLAYER_RADIUS - 0.3
    const limitZ = HALL_D / 2 - PLAYER_RADIUS - 0.3
    if (Math.abs(x) > limitX || Math.abs(z) > limitZ) return false

    // Machines are solid. Check the tile the player would stand on and its
    // neighbours, since the body is wider than a point.
    const tile = worldToTile(x, z)
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const tx = tile.x + dx
        const ty = tile.y + dy
        if (!this.blocked.has(`${tx},${ty}`)) continue

        const at = tileToWorld(tx, ty)
        const hitX = Math.abs(x - at.x) < MACHINE_HALF + PLAYER_RADIUS
        const hitZ = Math.abs(z - at.z) < MACHINE_HALF + PLAYER_RADIUS
        if (hitX && hitZ) return false
      }
    }

    return true
  }

  private freeTileUnderPlayer(): { x: number; y: number } | null {
    const tile = worldToTile(this.playerPos.x, this.playerPos.z)
    if (!insideGrid(tile.x, tile.y)) return null
    if (this.blocked.has(`${tile.x},${tile.y}`)) return null
    return tile
  }

  private updateGhost(): void {
    const tile = this.pending ? this.freeTileUnderPlayer() : null

    if (!this.ghost || !tile) {
      this.ghostPad.visible = false
      if (this.ghost) this.ghost.visible = false
      return
    }

    const at = tileToWorld(tile.x, tile.y)
    this.ghost.visible = true
    this.ghost.position.set(at.x, 0, at.z)
    this.ghostPad.visible = true
    this.ghostPad.position.set(at.x, 0.03, at.z)
  }

  /**
   * Picks the single nearest thing worth a button press. Placing a machine
   * wins over everything else — with a purchase in hand that is plainly what
   * the player is trying to do.
   */
  private updateFocus(): void {
    const state = this.state
    let next: Focus = null

    if (state && this.pending) {
      const tile = this.freeTileUnderPlayer()
      if (tile) next = { kind: 'place', x: tile.x, y: tile.y }
    } else if (state) {
      let best = REACH

      for (const client of state.clients) {
        if (client.phase !== 'queue') continue
        const view = this.npcs.get(client.uid)
        if (!view) continue

        const d = view.rig.root.position.distanceTo(this.playerPos)
        if (d < best) {
          best = d
          next = { kind: 'scan', clientUid: client.uid }
        }
      }

      for (const machine of state.machines) {
        if (machine.durability > 0) continue
        const at = tileToWorld(machine.x, machine.y)
        const d = Math.hypot(at.x - this.playerPos.x, at.z - this.playerPos.z)
        if (d < best) {
          best = d
          next = { kind: 'repair', machineUid: machine.uid }
        }
      }
    }

    if (sameFocus(next, this.focus)) return
    this.focus = next
    this.onFocus(next)
  }

  private followCamera(dt: number): void {
    // Roughly 45° above and behind — Hay Day's reading angle.
    const target = new THREE.Vector3(this.playerPos.x - 1.5, 12.5, this.playerPos.z + 13.5)

    // Snap on the opening frame. Lerping in from the origin would swoop the
    // camera up through the floor every time the game loads.
    if (this.cameraPlaced) {
      this.camera.position.lerp(target, Math.min(1, dt * 3.2))
    } else {
      this.camera.position.copy(target)
      this.cameraPlaced = true
    }

    this.camera.lookAt(this.playerPos.x, 1.1, this.playerPos.z - 0.5)
  }

  // --- lifecycle ------------------------------------------------------------

  setStick(x: number, z: number): void {
    this.controls.setStick(x, z)
  }

  resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth
    const height = this.canvas.clientHeight || window.innerHeight

    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.controls.dispose()
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose()
    })
    this.renderer.dispose()
  }
}
