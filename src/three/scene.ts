import * as THREE from 'three'
import type { Decor, GameState, Machine, MachineTypeId, Wall } from '../game/types'
import { GRID_H, GRID_W } from '../game/constants'
import { PATIENCE_MS } from '../game/constants'
import { tileOccupant, type PlacedKind } from '../game/build'
import { buildHall } from './models/floor'
import { buildDecor, buildWallSegment, WALL_THICK } from './models/decor'
import { buildGhost, buildMachine } from './models/machines'
import { animate, buildNpc, buildPlayer, type Rig } from './models/character'
import { DECOR_FOOTPRINT, MACHINE_FOOTPRINT, type Footprint } from './models/footprint'
import { stanceFor } from './models/stance'
import { Controls } from './controls'
import {
  DOOR_QUEUE_ANCHOR,
  HALL_D,
  HALL_W,
  REACH,
  TILE,
  insideGrid,
  overheadFraming,
  queueSpot,
  tileToWorld,
  worldToTile,
  type QueueAnchor,
} from './layout'
import { blockingSight } from './sight'
import { PALETTE, ownMaterials, toon } from './style'

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
  /** World units from the click to that edge — how surely an edge was meant. */
  edgeDistance: number
  object: { kind: PlacedKind; uid: string } | null
  wallUid: string | null
}

const PLAYER_SPEED = 5.4
const PLAYER_RADIUS = 0.42

/** How solid a partition stays while it is standing in front of the player. */
const WALL_FADED = 0.22
/** Where a character's eyes are, for the face-to-face camera. */
const EYE_HEIGHT = 1.5
/** How close to the reception desk counts as being behind it. */
const DESK_REACH = 2.6

const DEFAULT_UP = new THREE.Vector3(0, 1, 0)

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

/**
 * One obstacle on the floor: a centre, a facing, and how far it reaches along
 * its own two axes. Objects are placed a whole tile at a time but they are not
 * a whole tile big, so walking uses these rather than the tile grid.
 */
interface Solid {
  x: number
  z: number
  /** Sine and cosine of the object's rotation, kept so collision stays cheap. */
  sin: number
  cos: number
  hx: number
  hz: number
}

/**
 * A partition, plus everything needed to dissolve it. Walls own their
 * materials rather than sharing the cached ones, because one wall going
 * see-through must not take every other wall in the room with it.
 */
interface WallView {
  group: THREE.Group
  /** The painted body — what a sight line is tested against, and what fades. */
  meshes: THREE.Mesh[]
  /** Ink hulls, switched off entirely while the wall is see-through. */
  outlines: THREE.Mesh[]
  materials: THREE.Material[]
  opacity: number
}

interface NpcView {
  rig: Rig
  seed: number
  /** Countdown-of-patience bar, shown only while the client is queueing. */
  bar: THREE.Group
  barFill: THREE.Mesh
}

const BAR_WIDTH = 0.62
const BAR_FULL = new THREE.Color(PALETTE.ghost)
const BAR_EMPTY = new THREE.Color(PALETTE.ghostBad)

function buildPatienceBar(): { group: THREE.Group; fill: THREE.Mesh } {
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
  /** Collision boxes of everything standing on the floor, rebuilt on sync. */
  private solids: Solid[] = []

  private readonly decorViews = new Map<string, THREE.Group>()
  private readonly wallViews = new Map<string, WallView>()

  private readonly gridOverlay = new THREE.Group()
  private readonly marker: THREE.Mesh
  private preview: THREE.Group | null = null
  private previewType: MachineTypeId | null = null

  private readonly raycaster = new THREE.Raycaster()
  /** Kept apart from `raycaster`: this one carries a `far` limit of its own. */
  private readonly sightRay = new THREE.Raycaster()
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  private state: GameState | null = null
  private buildMode = false
  /** Client the player has stepped up to, or null for the usual chase camera. */
  private facing: string | null = null
  private selected: { kind: PlacedKind; uid: string } | null = null
  private focus: Focus = null
  private elapsed = 0
  private cameraPlaced = false

  /** Where the camera is aimed right now, eased towards the mode's target. */
  private readonly lookAtNow = new THREE.Vector3()
  /** Overhead framing of the whole hall, recomputed whenever the view resizes. */
  private readonly buildEye = new THREE.Vector3(0, 30, 0)
  private readonly buildUp = new THREE.Vector3(0, 0, -1)
  private readonly fog: THREE.Fog

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onFocus: (focus: Focus) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene.background = new THREE.Color(PALETTE.sky)
    this.fog = new THREE.Fog(PALETTE.sky, 34, 66)
    this.scene.fog = this.fog

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
    this.solids = []

    this.syncMachines(state.machines)
    this.syncDecor(state.decor)
    this.syncWalls(state.walls)
    this.syncNpcs(state)
  }

  /** Records an object's collision box, turned to match how it was placed. */
  private addSolid(x: number, y: number, rotation: number, print: Footprint): void {
    const at = tileToWorld(x, y)
    const angle = (rotation * Math.PI) / 2

    this.solids.push({
      x: at.x,
      z: at.z,
      sin: Math.sin(angle),
      cos: Math.cos(angle),
      hx: print.hx,
      hz: print.hz,
    })
  }

  private syncMachines(machines: Machine[]): void {
    const seen = new Set<string>()

    for (const machine of machines) {
      seen.add(machine.uid)
      this.addSolid(machine.x, machine.y, machine.rotation, MACHINE_FOOTPRINT[machine.type])

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
      this.addSolid(item.x, item.y, item.rotation, DECOR_FOOTPRINT[item.type])

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
        const group = buildWallSegment(TILE)
        ownMaterials(group)

        const meshes: THREE.Mesh[] = []
        const outlines: THREE.Mesh[] = []
        const materials: THREE.Material[] = []

        group.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return

          if (child.userData.outline) {
            outlines.push(child)
            return
          }

          // Stamped on the mesh so a raycast hit maps back to its wall.
          child.userData.wallUid = wall.uid
          meshes.push(child)
          materials.push(child.material as THREE.Material)
        })

        view = { group, meshes, outlines, materials, opacity: 1 }
        this.wallViews.set(wall.uid, view)
        this.scene.add(group)
      }

      const at = tileToWorld(wall.x, wall.y)
      if (wall.side === 'n') {
        view.group.position.set(at.x, 0, at.z - TILE / 2)
        view.group.rotation.y = 0
      } else {
        view.group.position.set(at.x - TILE / 2, 0, at.z)
        view.group.rotation.y = Math.PI / 2
      }
    }

    for (const [uid, view] of this.wallViews) {
      if (seen.has(uid)) continue
      this.scene.remove(view.group)
      for (const material of view.materials) material.dispose()
      this.wallViews.delete(uid)
    }
  }

  /**
   * Dissolves any partition standing between the camera and the player. Losing
   * sight of your own character behind a wall you built yourself is the one
   * thing a top-down room builder must never do, so the wall gives way rather
   * than the camera.
   */
  private updateWallSight(dt: number): void {
    const blocking = new Set<string>()

    // Nothing occludes from straight overhead, and a build view full of
    // half-dissolved walls would be harder to read, not easier.
    if (!this.buildMode && this.wallViews.size > 0) {
      const meshes: THREE.Mesh[] = []
      for (const view of this.wallViews.values()) meshes.push(...view.meshes)

      for (const uid of blockingSight(
        this.sightRay,
        this.camera.position,
        this.playerPos,
        meshes,
      )) {
        blocking.add(uid)
      }
    }

    for (const [uid, view] of this.wallViews) {
      const wanted = blocking.has(uid) ? WALL_FADED : 1
      if (Math.abs(view.opacity - wanted) < 0.005) {
        if (view.opacity === wanted) continue
        view.opacity = wanted
      } else {
        view.opacity += (wanted - view.opacity) * Math.min(1, dt * 10)
      }

      const solid = view.opacity > 0.995
      for (const mesh of view.outlines) mesh.visible = solid
      for (const mesh of view.meshes) mesh.castShadow = solid

      for (const material of view.materials) {
        material.opacity = view.opacity
        material.depthWrite = solid
        if (material.transparent === solid) {
          // Switching a material between the opaque and the see-through pass
          // changes how it is compiled, so it has to be told.
          material.transparent = !solid
          material.needsUpdate = true
        }
      }
    }
  }

  /** True while the player is stood at the reception desk. */
  private atReception(state: GameState): boolean {
    const desk = state.decor.find(d => d.type === 'reception')
    if (!desk) return false

    const at = tileToWorld(desk.x, desk.y)
    return Math.hypot(at.x - this.playerPos.x, at.z - this.playerPos.z) < DESK_REACH
  }

  /** Where the queue forms: in front of the reception desk, if one is placed. */
  private queueAnchor(state: GameState): QueueAnchor {
    const desk = state.decor.find(d => d.type === 'reception')
    if (!desk) return DOOR_QUEUE_ANCHOR

    const at = tileToWorld(desk.x, desk.y)
    return { x: at.x, z: at.z, angle: (desk.rotation * Math.PI) / 2 }
  }

  private syncNpcs(state: GameState): void {
    const seen = new Set<string>()
    let queueIndex = 0
    const anchor = this.queueAnchor(state)

    for (const client of state.clients) {
      seen.add(client.uid)

      let view = this.npcs.get(client.uid)
      if (!view) {
        // Derive the look from the uid so a visitor keeps one appearance.
        const seed = Number(client.uid.replace(/\D/g, '')) || 1
        const { group: bar, fill: barFill } = buildPatienceBar()
        view = { rig: buildNpc(client.kind, client.rarity, seed), seed, bar, barFill }
        this.npcs.set(client.uid, view)
        this.scene.add(view.rig.root, bar)
      }

      if (client.phase === 'queue') {
        const spot = queueSpot(queueIndex, anchor)
        queueIndex += 1
        view.rig.root.position.set(spot.x, 0, spot.z)
        view.rig.root.rotation.y = anchor.angle + Math.PI
        animate(view.rig, this.elapsed + view.seed, false)

        const remaining = Math.max(0, 1 - client.phaseMs / PATIENCE_MS)
        view.bar.visible = true
        view.bar.position.set(spot.x, 1.6, spot.z)
        view.barFill.scale.x = Math.max(0.001, remaining)
        ;(view.barFill.material as THREE.MeshBasicMaterial).color.lerpColors(
          BAR_EMPTY,
          BAR_FULL,
          remaining,
        )
        continue
      }

      view.bar.visible = false

      const machine = state.machines.find(m => m.uid === client.machineUid)
      if (!machine) continue

      // Each machine has its own spot: on the saddle, on the belt, flat on the
      // bench. It is given in the machine's local space, so it turns with the
      // equipment instead of staying pinned to a fixed world direction.
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
      stance.pose(view.rig, this.elapsed + view.seed)
    }

    for (const [uid, view] of this.npcs) {
      if (seen.has(uid)) continue
      this.scene.remove(view.rig.root)
      this.scene.remove(view.bar)
      this.npcs.delete(uid)
    }
  }

  // --- build mode -----------------------------------------------------------

  /**
   * Build mode is a different view of the same room: the camera leaves the
   * player's shoulder and hangs directly over the hall, so the whole floor
   * plan is on screen at once while things are being moved around.
   */
  setBuildMode(on: boolean): void {
    if (on === this.buildMode) return
    this.buildMode = on
    this.gridOverlay.visible = on

    // From that height the room would be lost inside the haze.
    this.scene.fog = on ? null : this.fog
    this.camera.up.copy(on ? this.buildUp : DEFAULT_UP)

    // Cut rather than swing: sliding between two views this far apart reads
    // as the room moving, not the camera.
    this.cameraPlaced = false

    if (!on) {
      this.setSelection(null)
      this.setPreview(null)
    }
  }

  /** Points the build camera at the whole hall, for the current viewport. */
  private frameHall(): void {
    const framing = overheadFraming(this.camera.fov, this.camera.aspect || 1)

    this.buildEye.set(0, framing.height, 0)
    this.buildUp.set(framing.up.x, 0, framing.up.z)

    if (this.buildMode) this.camera.up.copy(this.buildUp)
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
    const empty: PickResult = {
      tile: null,
      edge: null,
      edgeDistance: Infinity,
      object: null,
      wallUid: null,
    }
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

    // How far the click landed from that edge, so a caller can tell a tap
    // meant for a partition from one meant for the middle of the tile.
    const edgeDistance = (0.5 - Math.max(Math.abs(dx), Math.abs(dz))) * TILE

    return {
      tile,
      edge: { x: tile.x, y: tile.y, side },
      edgeDistance,
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
    this.updateWallSight(dt)

    this.renderer.render(this.scene, this.camera)
  }

  private movePlayer(dt: number): void {
    // Mid-conversation the player stands still and turns to whoever they are
    // talking to; walking away from a face-to-face would be nonsense.
    const partner = this.facingRig()
    if (partner) {
      this.playerFacing = Math.atan2(
        partner.root.position.x - this.playerPos.x,
        partner.root.position.z - this.playerPos.z,
      )
      this.turnPlayer(dt)
      animate(this.player, this.elapsed, false)
      return
    }

    const dir = this.controls.vector()
    const moving = dir.x !== 0 || dir.z !== 0

    if (moving) {
      const step = PLAYER_SPEED * dt

      // If a machine or wall was dropped on top of the player, every candidate
      // position collides and they would be walled in forever. Standing
      // inside something suspends collision until they are clear of it.
      // Escaping never lets them leave the room, only the object.
      const trappedBySolid = this.hitsSolid(this.playerPos.x, this.playerPos.z)
      const trappedByWall = this.hitsWall(this.playerPos.x, this.playerPos.z)
      const free = (x: number, z: number) =>
        this.insideBounds(x, z) &&
        (trappedBySolid || !this.hitsSolid(x, z)) &&
        (trappedByWall || !this.hitsWall(x, z))

      // Resolve each axis on its own so walking into a machine slides along it
      // instead of sticking.
      const tryX = this.playerPos.x + dir.x * step
      if (free(tryX, this.playerPos.z)) this.playerPos.x = tryX

      const tryZ = this.playerPos.z + dir.z * step
      if (free(this.playerPos.x, tryZ)) this.playerPos.z = tryZ

      this.playerFacing = Math.atan2(dir.x, dir.z)
    }

    this.turnPlayer(dt)
    animate(this.player, this.elapsed, moving)
  }

  /** Eases into the current heading rather than snapping to it. */
  private turnPlayer(dt: number): void {
    this.player.root.position.x = this.playerPos.x
    this.player.root.position.z = this.playerPos.z

    const turn =
      ((this.playerFacing - this.player.root.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI
    this.player.root.rotation.y += turn * Math.min(1, dt * 14)
  }

  /**
   * Steps the camera into the player's own eyes, facing one client. Passing
   * null hands the view back to the usual over-the-shoulder camera.
   */
  setFacing(clientUid: string | null): void {
    this.facing = clientUid
  }

  private facingRig(): Rig | null {
    if (!this.facing || this.buildMode) return null
    return this.npcs.get(this.facing)?.rig ?? null
  }

  /** Inside the four walls. This one is never suspended. */
  private insideBounds(x: number, z: number): boolean {
    const limitX = HALL_W / 2 - PLAYER_RADIUS - 0.3
    const limitZ = HALL_D / 2 - PLAYER_RADIUS - 0.3
    return Math.abs(x) <= limitX && Math.abs(z) <= limitZ
  }

  /**
   * Standing inside something. Each object is tested against its own box,
   * turned the way it was placed — so the player can walk right past the side
   * of a treadmill or squeeze behind a pot plant, instead of the whole two
   * metre tile being a wall.
   */
  private hitsSolid(x: number, z: number): boolean {
    for (const solid of this.solids) {
      const dx = x - solid.x
      const dz = z - solid.z

      // Cheap reject before the rotation: nothing reaches further than this.
      if (Math.abs(dx) > 1.6 || Math.abs(dz) > 1.6) continue

      // Into the object's own frame, which is the same as turning the point
      // back by the object's rotation.
      const localX = dx * solid.cos - dz * solid.sin
      const localZ = dx * solid.sin + dz * solid.cos

      if (
        Math.abs(localX) < solid.hx + PLAYER_RADIUS &&
        Math.abs(localZ) < solid.hz + PLAYER_RADIUS
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Overlapping a partition. Walls sit on tile edges rather than tiles, so
   * each one is checked as its own thin rectangle rather than through the
   * `blocked` tile set the way machines and decor are.
   */
  private hitsWall(x: number, z: number): boolean {
    const state = this.state
    if (!state) return false

    const thick = WALL_THICK / 2 + PLAYER_RADIUS
    const long = TILE / 2 + PLAYER_RADIUS

    for (const wall of state.walls) {
      const at = tileToWorld(wall.x, wall.y)
      if (wall.side === 'n') {
        if (Math.abs(x - at.x) < long && Math.abs(z - (at.z - TILE / 2)) < thick) return true
      } else {
        if (Math.abs(x - (at.x - TILE / 2)) < thick && Math.abs(z - at.z) < long) return true
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

      // Standing at the desk serves whoever is at the front of the line, even
      // when the line itself trails off across the room. Working the counter
      // is the job; chasing individual visitors around the floor is not.
      if (!next && this.atReception(state)) {
        const front = state.clients.find(c => c.phase === 'queue')
        if (front) next = { kind: 'scan', clientUid: front.uid }
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
    const partner = this.facingRig()

    // The player's own body would fill a first-person view from the inside.
    this.player.root.visible = partner === null

    // Build mode looks straight down at the middle of the room, a
    // conversation looks out of the player's own eyes, and otherwise the
    // camera sits roughly 45° above and behind — Hay Day's reading angle.
    let eye: THREE.Vector3
    let aim: THREE.Vector3

    if (this.buildMode) {
      eye = this.buildEye
      aim = new THREE.Vector3(0, 0, 0)
    } else if (partner) {
      const head = new THREE.Vector3(
        partner.root.position.x,
        EYE_HEIGHT,
        partner.root.position.z,
      )
      // A pace out of the player's own head, so the view is theirs without
      // the near plane clipping through their hair.
      eye = new THREE.Vector3(this.playerPos.x, EYE_HEIGHT, this.playerPos.z)
      eye.lerp(head, 0.16)
      aim = head
    } else {
      eye = new THREE.Vector3(this.playerPos.x - 1.5, 12.5, this.playerPos.z + 13.5)
      aim = new THREE.Vector3(this.playerPos.x, 1.1, this.playerPos.z - 0.5)
    }

    // Snap on the opening frame and on a change of view. Lerping in from the
    // origin would swoop the camera up through the floor on load.
    if (this.cameraPlaced) {
      const ease = Math.min(1, dt * (partner ? 5 : 3.2))
      this.camera.position.lerp(eye, ease)
      this.lookAtNow.lerp(aim, ease)
    } else {
      this.camera.position.copy(eye)
      this.lookAtNow.copy(aim)
      this.cameraPlaced = true
    }

    this.camera.lookAt(this.lookAtNow)
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

    // The overhead framing depends on the aspect ratio, so it has to be redone
    // whenever the window changes shape — including a phone being turned.
    this.frameHall()
  }

  dispose(): void {
    this.controls.dispose()
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose()
    })
    this.renderer.dispose()
  }
}
