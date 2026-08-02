import * as THREE from 'three'
import type { Decor, GameState, Machine, MachineTypeId, Wall } from '../game/types'
import { GRID_H, GRID_W } from '../game/constants'
import { tileOccupant, type PlacedKind } from '../game/build'
import { buildHall } from './models/floor'
import { buildDecor, buildWallSegment } from './models/decor'
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
  | null

export type EdgeSide = 'n' | 's' | 'e' | 'w'

/**
 * Everything a single click could plausibly mean, resolved in one go. The HUD
 * decides which part matters based on what the player is holding — a tile when
 * placing a bench, an edge when placing a wall, an object when editing.
 */
export interface PickResult {
  tile: { x: number; y: number } | null
  edge: { x: number; y: number; side: EdgeSide } | null
  object: { kind: PlacedKind; uid: string } | null
  wallUid: string | null
}

const PLAYER_SPEED = 5.4
const PLAYER_RADIUS = 0.42
/** Half-width of a machine's footprint for collision, a little under a tile. */
const MACHINE_HALF = 0.78

const sameFocus = (a: Focus, b: Focus): boolean => {
  if (a === null || b === null) return a === b
  if (a.kind === 'scan' && b.kind === 'scan') return a.clientUid === b.clientUid
  if (a.kind === 'repair' && b.kind === 'repair') return a.machineUid === b.machineUid
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

  private readonly decorViews = new Map<string, THREE.Group>()
  private readonly wallViews = new Map<string, THREE.Group>()

  private readonly gridOverlay = new THREE.Group()
  private readonly marker: THREE.Mesh
  private preview: THREE.Group | null = null
  private previewType: MachineTypeId | null = null

  private readonly raycaster = new THREE.Raycaster()
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  private state: GameState | null = null
  private buildMode = false
  private selected: { kind: PlacedKind; uid: string } | null = null
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

    // Highlight quad. One mesh, moved around, rather than one per tile.
    this.marker = new THREE.Mesh(
      new THREE.BoxGeometry(TILE * 0.94, 0.04, TILE * 0.94),
      toon(PALETTE.ghost, { transparent: true, opacity: 0.5 }),
    )
    this.marker.visible = false
    this.scene.add(this.marker)

    this.buildGridOverlay()
    this.scene.add(this.gridOverlay)

    this.resize()
  }

  /** Faint outline on every tile, shown only while building. */
  private buildGridOverlay(): void {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color('#7d4a26'),
      transparent: true,
      opacity: 0.35,
    })
    const half = TILE / 2

    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        const at = tileToWorld(x, y)
        const points = [
          new THREE.Vector3(at.x - half, 0.03, at.z - half),
          new THREE.Vector3(at.x + half, 0.03, at.z - half),
          new THREE.Vector3(at.x + half, 0.03, at.z + half),
          new THREE.Vector3(at.x - half, 0.03, at.z + half),
          new THREE.Vector3(at.x - half, 0.03, at.z - half),
        ]
        this.gridOverlay.add(
          new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material),
        )
      }
    }

    this.gridOverlay.visible = false
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
  sync(state: GameState): void {
    this.state = state

    this.syncMachines(state.machines)
    this.syncDecor(state.decor)
    this.syncWalls(state.walls)
    this.syncNpcs(state)
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

      // Position and rotation come from state every frame, so moving or
      // turning a machine in build mode needs no special case here.
      const at = tileToWorld(machine.x, machine.y)
      view.group.position.set(at.x, 0, at.z)
      view.group.rotation.y = (machine.rotation * Math.PI) / 2
      view.broken.visible = machine.durability <= 0
    }

    for (const [uid, view] of this.machines) {
      if (seen.has(uid)) continue
      this.scene.remove(view.group)
      this.machines.delete(uid)
    }
  }

  private syncDecor(decor: Decor[]): void {
    const seen = new Set<string>()

    for (const item of decor) {
      seen.add(item.uid)
      this.blocked.add(`${item.x},${item.y}`)

      let view = this.decorViews.get(item.uid)
      if (!view) {
        view = buildDecor(item.type)
        this.decorViews.set(item.uid, view)
        this.scene.add(view)
      }

      const at = tileToWorld(item.x, item.y)
      view.position.set(at.x, 0, at.z)
      view.rotation.y = (item.rotation * Math.PI) / 2
    }

    for (const [uid, view] of this.decorViews) {
      if (seen.has(uid)) continue
      this.scene.remove(view)
      this.decorViews.delete(uid)
    }
  }

  /**
   * Partitions sit on tile edges. A north edge runs along X at the tile's
   * upper boundary; a west edge is the same segment turned a quarter turn.
   */
  private syncWalls(walls: Wall[]): void {
    const seen = new Set<string>()

    for (const wall of walls) {
      seen.add(wall.uid)

      let view = this.wallViews.get(wall.uid)
      if (!view) {
        view = buildWallSegment(TILE)
        this.wallViews.set(wall.uid, view)
        this.scene.add(view)
      }

      const at = tileToWorld(wall.x, wall.y)
      if (wall.side === 'n') {
        view.position.set(at.x, 0, at.z - TILE / 2)
        view.rotation.y = 0
      } else {
        view.position.set(at.x - TILE / 2, 0, at.z)
        view.rotation.y = Math.PI / 2
      }
    }

    for (const [uid, view] of this.wallViews) {
      if (seen.has(uid)) continue
      this.scene.remove(view)
      this.wallViews.delete(uid)
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

  // --- build mode -----------------------------------------------------------

  setBuildMode(on: boolean): void {
    this.buildMode = on
    this.gridOverlay.visible = on
    if (!on) {
      this.setSelection(null)
      this.setPreview(null)
    }
  }

  /** Highlights the tile a selected object stands on. */
  setSelection(selected: { kind: PlacedKind; uid: string } | null): void {
    this.selected = selected
  }

  /** Ghost of the machine the player is about to drop, or null. */
  setPreview(type: MachineTypeId | null): void {
    if (type === this.previewType) return

    if (this.preview) {
      this.scene.remove(this.preview)
      this.preview = null
    }
    this.previewType = type

    if (type) {
      this.preview = buildGhost(type)
      this.preview.visible = false
      this.scene.add(this.preview)
    }
  }

  /**
   * Turns a screen position into everything it could refer to. Rather than
   * raycasting meshes, this hits the ground plane once and reads the answer
   * out of game state — so clicking the base of a tall machine selects the
   * machine, not whatever happens to be behind it.
   */
  pick(clientX: number, clientY: number): PickResult {
    const empty: PickResult = { tile: null, edge: null, object: null, wallUid: null }
    const state = this.state
    if (!state) return empty

    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )

    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return empty

    const tile = worldToTile(hit.x, hit.z)
    if (!insideGrid(tile.x, tile.y)) return empty

    // Which of the tile's four edges the click sat nearest to.
    const centre = tileToWorld(tile.x, tile.y)
    const dx = (hit.x - centre.x) / TILE
    const dz = (hit.z - centre.z) / TILE
    const side: EdgeSide =
      Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : dz > 0 ? 's' : 'n'

    const canonical =
      side === 's'
        ? { x: tile.x, y: tile.y + 1, side: 'n' as const }
        : side === 'e'
          ? { x: tile.x + 1, y: tile.y, side: 'w' as const }
          : { x: tile.x, y: tile.y, side }

    const wall = state.walls.find(
      w => w.x === canonical.x && w.y === canonical.y && w.side === canonical.side,
    )

    return {
      tile,
      edge: { x: tile.x, y: tile.y, side },
      object: tileOccupant(state, tile.x, tile.y),
      wallUid: wall?.uid ?? null,
    }
  }

  /** Shows the ghost or the selection halo on one tile. */
  private updateMarker(): void {
    const state = this.state
    if (!this.buildMode || !state) {
      this.marker.visible = false
      if (this.preview) this.preview.visible = false
      return
    }

    const selected = this.selected
    const target = !selected
      ? undefined
      : selected.kind === 'machine'
        ? state.machines.find(m => m.uid === selected.uid)
        : state.decor.find(d => d.uid === selected.uid)

    if (!target) {
      this.marker.visible = false
      return
    }

    const at = tileToWorld(target.x, target.y)
    this.marker.visible = true
    this.marker.position.set(at.x, 0.03, at.z)
  }

  // --- per-frame ------------------------------------------------------------

  update(dtMs: number): void {
    const dt = Math.min(dtMs, 100) / 1000
    this.elapsed += dt

    this.movePlayer(dt)
    this.updateMarker()
    this.updateFocus()
    this.followCamera(dt)

    this.renderer.render(this.scene, this.camera)
  }

  private movePlayer(dt: number): void {
    const dir = this.controls.vector()
    const moving = dir.x !== 0 || dir.z !== 0

    if (moving) {
      const step = PLAYER_SPEED * dt

      // If a machine was dropped on top of the player, every candidate
      // position collides and they would be walled in forever. Standing
      // inside something suspends collision until they are clear of it.
      // Escaping never lets them leave the room, only the object.
      const trapped = this.hitsMachine(this.playerPos.x, this.playerPos.z)
      const free = (x: number, z: number) =>
        this.insideBounds(x, z) && (trapped || !this.hitsMachine(x, z))

      // Resolve each axis on its own so walking into a machine slides along it
      // instead of sticking.
      const tryX = this.playerPos.x + dir.x * step
      if (free(tryX, this.playerPos.z)) this.playerPos.x = tryX

      const tryZ = this.playerPos.z + dir.z * step
      if (free(this.playerPos.x, tryZ)) this.playerPos.z = tryZ

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

  /** Inside the four walls. This one is never suspended. */
  private insideBounds(x: number, z: number): boolean {
    const limitX = HALL_W / 2 - PLAYER_RADIUS - 0.3
    const limitZ = HALL_D / 2 - PLAYER_RADIUS - 0.3
    return Math.abs(x) <= limitX && Math.abs(z) <= limitZ
  }

  /**
   * Overlapping a machine's footprint. Checks the tile under the point and
   * its neighbours, since the body is wider than a point.
   */
  private hitsMachine(x: number, z: number): boolean {
    const tile = worldToTile(x, z)

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const tx = tile.x + dx
        const ty = tile.y + dy
        if (!this.blocked.has(`${tx},${ty}`)) continue

        const at = tileToWorld(tx, ty)
        const hitX = Math.abs(x - at.x) < MACHINE_HALF + PLAYER_RADIUS
        const hitZ = Math.abs(z - at.z) < MACHINE_HALF + PLAYER_RADIUS
        if (hitX && hitZ) return true
      }
    }

    return false
  }

  /**
   * Picks the single nearest thing worth a button press. Build mode reports
   * nothing: the player is arranging the room, and a second floating button
   * fighting the build controls would only get in the way.
   */
  private updateFocus(): void {
    const state = this.state
    let next: Focus = null

    if (state && !this.buildMode) {
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
