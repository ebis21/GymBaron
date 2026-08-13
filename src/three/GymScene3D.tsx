import { useEffect, useRef } from 'react'
import type { GameState, MachineTypeId } from '../game/types'
import type { PlacedKind } from '../game/build'
import type { AlertKind } from '../game/alerts'
import { gymAlerts, nearestAlert } from '../game/alerts'
import { REACH } from './layout'
import { FLOOR_SQUASH, GymScene, type Focus, type PickResult } from './scene'

interface Props {
  state: GameState
  buildMode: boolean
  selected: { kind: PlacedKind; uid: string } | null
  preview: MachineTypeId | null
  /** Client the player is face to face with, or null for the usual camera. */
  facing: string | null
  /** A modal interaction freezes movement without pretending to face a client. */
  paused: boolean
  /**
   * Trouble the player has asked to be led to, or null for no arrow. A kind
   * rather than one target: which broken machine is nearest changes with every
   * step, and re-picking it per frame is what keeps the arrow honest.
   */
  guide: AlertKind | null
  /**
   * Bumped to drop the player at the front counter. A counter rather than a
   * boolean so that asking for it twice in a row still moves them twice.
   */
  teleport: number
  onFocus: (focus: Focus) => void
  /** Fires only in build mode, when the player clicks the floor. */
  onPick: (pick: PickResult) => void
  onFloorAccess: () => void
}

const STICK_RADIUS = 52

/**
 * The only bridge between React and three.js. React owns the canvas element
 * and nothing else — the scene keeps its own render loop, because rerendering
 * a component tree at 60fps to move one character would be absurd.
 */
export default function GymScene3D({
  state,
  buildMode,
  selected,
  preview,
  facing,
  paused,
  guide,
  teleport,
  onFocus,
  onPick,
  onFloorAccess,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<GymScene | null>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)

  // Read through a ref inside the loop so the effect never needs to re-run.
  const latest = useRef({ state, buildMode, guide, onPick, onFocus, onFloorAccess })
  latest.current = { state, buildMode, guide, onPick, onFocus, onFloorAccess }

  // Mode, selection, and preview are cheap setters, pushed on every render.
  useEffect(() => {
    sceneRef.current?.setBuildMode(buildMode)
  }, [buildMode])

  // The stick is about to disappear from under the player's thumb; leaving its
  // last value behind would walk the character off on its own.
  useEffect(() => {
    if (!buildMode && !facing && !paused) return
    sceneRef.current?.setStick(0, 0)
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
  }, [buildMode, facing, paused])

  useEffect(() => {
    sceneRef.current?.setSelection(selected)
  }, [selected])

  useEffect(() => {
    sceneRef.current?.setPreview(preview)
  }, [preview])

  useEffect(() => {
    sceneRef.current?.setFacing(facing)
  }, [facing])

  // Zero is the initial value, not a request — teleporting on mount would drop
  // the player at the desk every time the app opened.
  useEffect(() => {
    if (teleport > 0) sceneRef.current?.teleportToReception(latest.current.state)
  }, [teleport])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new GymScene(canvas, focus => latest.current.onFocus(focus))
    sceneRef.current = scene

    let raf = 0
    let last = 0

    /**
     * Swings the guide arrow round to whichever piece of trouble is nearest,
     * per frame and straight onto the element. It has to move with the walk,
     * and rerendering React sixty times a second to turn one chevron would be
     * the same mistake the joystick already avoids.
     *
     * Hidden rather than removed while there is nothing to point at, so the
     * arrow never costs a layout pass on the frame it comes back.
     */
    const aimGuide = (live: GymScene) => {
      const arrow = guideRef.current
      if (!arrow) return

      const kind = latest.current.guide
      // Build mode looks straight down from somewhere else entirely: the
      // screen directions this arrow is drawn in do not survive that camera.
      const target =
        kind && !latest.current.buildMode
          ? nearestAlert(gymAlerts(latest.current.state), kind, live.playerAt())
          : null

      // Close enough to act on it — the action button is already saying so,
      // and an arrow at the player's own feet only spins.
      if (!target || target.distance < REACH) {
        arrow.classList.add('hidden')
        return
      }

      const at = live.playerAt()
      // Screen up is world −Z and screen right is world +X: the follow camera
      // never yaws, so no basis is needed, only the pitch's foreshortening.
      const dx = target.at.x - at.x
      const dy = (target.at.z - at.z) * FLOOR_SQUASH
      arrow.style.setProperty('--guide-angle', `${(Math.atan2(dx, -dy) * 180) / Math.PI}deg`)
      arrow.classList.remove('hidden')
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = last === 0 ? 16 : now - last
      last = now

      scene.sync(latest.current.state)
      scene.update(dt)
      aimGuide(scene)
    }
    raf = requestAnimationFrame(frame)

    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(canvas)

    // A drag is the camera or a stray swipe, not a placement, so only a click
    // that barely moved counts as pointing at a tile.
    let downAt: { x: number; y: number } | null = null

    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY }
    }

    const onPointerUp = (e: PointerEvent) => {
      const start = downAt
      downAt = null
      if (!start) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return

      if (latest.current.buildMode) {
        latest.current.onPick(scene.pick(e.clientX, e.clientY))
      } else if (scene.pickFloorAccess(e.clientX, e.clientY)) {
        latest.current.onFloorAccess()
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  // --- virtual joystick -----------------------------------------------------

  useEffect(() => {
    const pad = stickRef.current
    const knob = knobRef.current
    if (!pad || !knob) return

    let pointer: number | null = null
    let originX = 0
    let originY = 0

    const move = (dx: number, dy: number) => {
      const length = Math.hypot(dx, dy)
      const scale = length > STICK_RADIUS ? STICK_RADIUS / length : 1
      const kx = dx * scale
      const ky = dy * scale

      knob.style.transform = `translate(${kx}px, ${ky}px)`
      sceneRef.current?.setStick(kx / STICK_RADIUS, ky / STICK_RADIUS)
    }

    const onDown = (e: PointerEvent) => {
      pointer = e.pointerId
      pad.setPointerCapture(e.pointerId)
      const rect = pad.getBoundingClientRect()
      originX = rect.left + rect.width / 2
      originY = rect.top + rect.height / 2
      move(e.clientX - originX, e.clientY - originY)
    }

    const onMove = (e: PointerEvent) => {
      if (pointer !== e.pointerId) return
      e.preventDefault()
      move(e.clientX - originX, e.clientY - originY)
    }

    const onUp = (e: PointerEvent) => {
      if (pointer !== e.pointerId) return
      pointer = null
      knob.style.transform = 'translate(0px, 0px)'
      sceneRef.current?.setStick(0, 0)
    }

    pad.addEventListener('pointerdown', onDown)
    pad.addEventListener('pointermove', onMove)
    pad.addEventListener('pointerup', onUp)
    pad.addEventListener('pointercancel', onUp)

    return () => {
      pad.removeEventListener('pointerdown', onDown)
      pad.removeEventListener('pointermove', onMove)
      pad.removeEventListener('pointerup', onUp)
      pad.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="gym-canvas" />
      {/* Build mode looks down on the room from overhead and a conversation
          holds the player still — neither has any use for a walk stick. */}
      <div
        className={`joystick${buildMode || facing || paused ? ' hidden' : ''}`}
        ref={stickRef}
        aria-hidden="true"
      >
        <div className="joystick-knob" ref={knobRef} />
      </div>

      {/* Orbits the player, pointing the way to whatever the HUD's alert chip
          was tapped for. Starts hidden; the frame loop is what reveals it. */}
      <div
        className={`guide hidden${guide ? ` ${guide}` : ''}`}
        ref={guideRef}
        aria-hidden="true"
      >
        <span className="guide-head">▲</span>
      </div>
    </>
  )
}
