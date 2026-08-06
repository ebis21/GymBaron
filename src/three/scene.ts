import * as THREE from 'three'
import type { Decor, GameState, Machine, MachineTypeId, Wall } from '../game/types'
import { tileOccupant, type PlacedKind } from '../game/build'
import { buildHall, disposeHall } from './models/floor'
import { buildDecor, buildWallSegment, WALL_THICK } from './models/decor'
import { buildGhost, buildMachine } from './models/machines'
import { animate, buildPlayer, type Rig } from './models/character'
import { DECOR_FOOTPRINT, MACHINE_FOOTPRINT, type Footprint } from './models/footprint'
import { Controls } from './controls'
import {
  HALL_D,
  HALL_W,
  REACH,
  TILE,
  gridH,
  gridW,
  hallD,
  hallW,
  insideGrid,
  isInStaffRoom,
  overheadFraming,
  queueSpot,
  syncRoomSize,
  tileToWorld,
  worldToTile,
} from './layout'
import { queueAnchorFor } from '../game/clientMove'
import { blockingSight } from './sight'
import { PALETTE, ownMaterials, toon } from './style'
import { ActorLayer } from './actors'

/** What the player is close enough to act on right now. */
export type Focus =
  | { kind: 'scan'; clientUid: string }
  | { kind: 'repair'; machineUid: string }
  | { kind: 'wipe'; stainUid: string }
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
/** How close to the reception desk counts as being behind it. */
const DESK_REACH = 2.6

/** Where the haze starts and ends in the hall the game ships with. */
const FOG_NEAR = 34
const FOG_FAR = 66
/** Corner-to-corner of that same hall — the yardstick a bigger room scales by. */
const BASE_REACH = Math.hypot(HALL_W, HALL_D)

const DEFAULT_UP = new THREE.Vector3(0, 1, 0)

const sameFocus = (a: Focus, b: Focus): boolean => {
  if (a === null || b === null) return a === b
  if (a.kind === 'scan' && b.kind === 'scan') return a.clientUid === b.clientUid
  if (a.kind === 'repair' && b.kind === 'repair') return a.machineUid === b.machineUid
  if (a.kind === 'wipe' && b.kind === 'wipe') return a.stainUid === b.stainUid
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
  private readonly playerPos = new THREE.Vector3(-hallW() / 2 + 3.4, 0, 3)
  private playerFacing = 0

  /** The room the 3D shell was last built for; a change rebuilds it. */
  private roomW = gridW()
  private roomH = gridH()
  private hall: THREE.Group
  /** Kept so an expansion can widen the shadow frustum with the floor. */
  private readonly sun: THREE.DirectionalLight

  private readonly machines = new Map<string, MachineView>()
  private readonly actors = new ActorLayer(this.scene)
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
    this.fog = new THREE.Fog(PALETTE.sky, FOG_NEAR, FOG_FAR)
    this.scene.fog = this.fog

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200)
    this.hall = buildHall(this.roomW, this.roomH)
    this.scene.add(this.hall)
    this.sun = this.addLights()
    this.fitToRoom()

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

    for (let y = 0; y < this.roomH; y += 1) {
      for (let x = 0; x < this.roomW; x += 1) {
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

    this.gridOverlay.visible = this.buildMode
  }

  /**
   * Empties the overlay. Every line owns its geometry and they all share one
   * material, so both have to go — a room bought a few times over a long
   * session would otherwise leak a grid's worth of buffers each time.
   */
  private clearGridOverlay(): void {
    const materials = new Set<THREE.Material>()

    for (const child of this.gridOverlay.children) {
      if (!(child instanceof THREE.Line)) continue
      child.geometry.dispose()
      materials.add(child.material as THREE.Material)
    }

    for (const material of materials) material.dispose()
    this.gridOverlay.clear()
  }

  private addLights(): THREE.DirectionalLight {
    // Sky above, warm bounce off the floor — the base of the Hay Day palette.
    this.scene.add(new THREE.HemisphereLight(PALETTE.sky, PALETTE.floorDark, 1.5))

    const sun = new THREE.DirectionalLight(PALETTE.sunlight, 2.1)
    sun.position.set(-9, 16, 9)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0006
    sun.shadow.camera.near = 1

    this.scene.add(sun)
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.35))
    return sun
  }

  // --- room size ------------------------------------------------------------

  /**
   * Everything sized off the hall rather than off the grid: the sun's shadow
   * box has to cover the whole floor or the far corner loses its shadows, and
   * the haze has to start beyond the back wall or a big room fades out before
   * the player can see the end of it.
   */
  private fitToRoom(): void {
    const w = hallW()
    const d = hallD()

    const cam = this.sun.shadow.camera
    cam.left = -w
    cam.right = w
    cam.top = d
    cam.bottom = -d
    cam.far = Math.max(60, w * 3)
    cam.updateProjectionMatrix()

    // The haze was tuned by eye on the starting hall, so rather than pick new
    // numbers it is stretched by however much further the room now reaches —
    // a bigger gym fades at the same point in its own depth, not sooner.
    const scale = Math.hypot(w, d) / BASE_REACH
    this.fog.near = FOG_NEAR * scale
    this.fog.far = FOG_FAR * scale
  }

  /**
   * Rebuilds the shell for a room of a different size. The hall and the grid
   * overlay are the only two things built for one floor plan and no other, so
   * they are thrown away whole rather than stretched; everything else is
   * placed from state every frame and re-centres on its own. A no-op when the
   * size has not moved, which is every frame but the one after a purchase.
   */
  setRoomSize(w: number, h: number): void {
    if (w === this.roomW && h === this.roomH) return

    // Both the grid and the hall are centred on the origin, so widening by two
    // columns slides every fixed point half a column's worth of world units to
    // the left — by the same amount for both. The player is the one thing on
    // the floor that has no tile of its own to be replaced from, so it is
    // carried across by hand; otherwise buying a wing would teleport them
    // sideways relative to a room that had not moved under their feet.
    this.playerPos.x -= ((w - this.roomW) * TILE) / 2
    this.playerPos.z -= ((h - this.roomH) * TILE) / 2

    this.roomW = w
    this.roomH = h

    this.scene.remove(this.hall)
    disposeHall(this.hall)
    this.hall = buildHall(w, h)
    this.scene.add(this.hall)

    this.clearGridOverlay()
    this.buildGridOverlay()

    this.fitToRoom()
    this.frameHall()

    // The player was standing somewhere in the old room's coordinates and the
    // whole floor plan just re-centred under them; nudge them back inside
    // rather than leaving them wedged in a wall.
    this.clampPlayerInside()

    // The overhead view is framed on the room's size, so it has to be re-cut
    // rather than eased across.
    this.cameraPlaced = false
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

    // Cheap and idempotent, and it means the renderer never depends on the
    // engine having run first — a save loaded straight into an expanded gym
    // draws the right room on its very first frame.
    syncRoomSize(state)
    this.setRoomSize(gridW(), gridH())

    this.syncMachines(state.machines)
    this.syncDecor(state.decor)
    this.syncWalls(state.walls)
    this.actors.sync(state, this.elapsed)
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
   * Marks which client the player is serving. It holds them still and turns
   * them to face that client; the camera is deliberately left alone. Passing
   * null hands them back to the walk controls.
   */
  setFacing(clientUid: string | null): void {
    this.facing = clientUid
  }

  private facingRig(): Rig | null {
    if (!this.facing || this.buildMode) return null
    return this.actors.rigFor(this.facing) ?? null
  }

  /** Inside the four walls. This one is never suspended. */
  private insideBounds(x: number, z: number): boolean {
    const limit = this.wallLimits()
    if (Math.abs(x) > limit.x || Math.abs(z) > limit.z) return false
    // The staff room is walled off from the gym floor. Nobody standing in it
    // is drawn, so letting the player walk in would put them in an empty box
    // behind a partition they can see over.
    return !isInStaffRoom(x, z)
  }

  private wallLimits(): { x: number; z: number } {
    return {
      x: hallW() / 2 - PLAYER_RADIUS - 0.3,
      z: hallD() / 2 - PLAYER_RADIUS - 0.3,
    }
  }

  /** Pulls the player back within the walls after the room changed shape. */
  /**
   * Drops the player at the front counter. A testing shortcut: the desk is
   * where almost everything worth checking happens, and walking there across
   * a hall that may have just doubled in size is not the thing being tested.
   *
   * Lands them beside the head of the queue rather than on the desk itself, so
   * whoever is waiting is immediately within reach of the action prompt.
   */
  teleportToReception(state: GameState): void {
    const anchor = queueAnchorFor(state)
    const spot = queueSpot(0, anchor)

    // One pace to the attendant's left of the first person in line, so the
    // player is not standing inside them.
    this.playerPos.set(spot.x - Math.cos(anchor.angle) * 1.1, 0, spot.z + Math.sin(anchor.angle) * 1.1)
    this.clampPlayerInside()
    this.playerFacing = anchor.angle + Math.PI
    // Cut rather than swoop across the room.
    this.cameraPlaced = false
  }

  private clampPlayerInside(): void {
    const limit = this.wallLimits()
    this.playerPos.x = Math.max(-limit.x, Math.min(limit.x, this.playerPos.x))
    this.playerPos.z = Math.max(-limit.z, Math.min(limit.z, this.playerPos.z))
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
        const rig = this.actors.rigFor(client.uid)
        if (!rig) continue

        const d = rig.root.position.distanceTo(this.playerPos)
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

      for (const stain of state.stains) {
        const at = tileToWorld(stain.x, stain.y)
        const d = Math.hypot(at.x - this.playerPos.x, at.z - this.playerPos.z)
        if (d < best) {
          best = d
          next = { kind: 'wipe', stainUid: stain.uid }
        }
      }
    }

    if (sameFocus(next, this.focus)) return
    this.focus = next
    this.onFocus(next)
  }

  private followCamera(dt: number): void {
    // Build mode looks straight down at the middle of the room; otherwise the
    // camera sits roughly 45° above and behind — Hay Day's reading angle.
    //
    // Talking to a client used to drop the camera into the player's own eyes.
    // It read as the screen lurching every time somebody was served, which is
    // the one moment the player is about to look at a panel of numbers, so the
    // move is gone: the player still stops and turns to face whoever they are
    // serving, and the camera simply stays where it was.
    let eye: THREE.Vector3
    let aim: THREE.Vector3

    if (this.buildMode) {
      eye = this.buildEye
      aim = new THREE.Vector3(0, 0, 0)
    } else {
      eye = new THREE.Vector3(this.playerPos.x - 1.5, 12.5, this.playerPos.z + 13.5)
      aim = new THREE.Vector3(this.playerPos.x, 1.1, this.playerPos.z - 0.5)
    }

    // Snap on the opening frame and on a change of view. Lerping in from the
    // origin would swoop the camera up through the floor on load.
    if (this.cameraPlaced) {
      const ease = Math.min(1, dt * 3.2)
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
    this.actors.dispose()
    this.clearGridOverlay()
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose()
    })
    this.renderer.dispose()
  }
}
