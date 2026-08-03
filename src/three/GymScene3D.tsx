import { useEffect, useRef } from 'react'
import type { GameState, MachineTypeId } from '../game/types'
import type { PlacedKind } from '../game/build'
import { GymScene, type Focus, type PickResult } from './scene'

interface Props {
  state: GameState
  buildMode: boolean
  selected: { kind: PlacedKind; uid: string } | null
  preview: MachineTypeId | null
  /** Client the player is face to face with, or null for the usual camera. */
  facing: string | null
  onFocus: (focus: Focus) => void
  /** Fires only in build mode, when the player clicks the floor. */
  onPick: (pick: PickResult) => void
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
  onFocus,
  onPick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<GymScene | null>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)

  // Read through a ref inside the loop so the effect never needs to re-run.
  const latest = useRef({ state, buildMode, onPick, onFocus })
  latest.current = { state, buildMode, onPick, onFocus }

  // Mode, selection, and preview are cheap setters, pushed on every render.
  useEffect(() => {
    sceneRef.current?.setBuildMode(buildMode)
  }, [buildMode])

  // The stick is about to disappear from under the player's thumb; leaving its
  // last value behind would walk the character off on its own.
  useEffect(() => {
    if (!buildMode && !facing) return
    sceneRef.current?.setStick(0, 0)
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
  }, [buildMode, facing])

  useEffect(() => {
    sceneRef.current?.setSelection(selected)
  }, [selected])

  useEffect(() => {
    sceneRef.current?.setPreview(preview)
  }, [preview])

  useEffect(() => {
    sceneRef.current?.setFacing(facing)
  }, [facing])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new GymScene(canvas, focus => latest.current.onFocus(focus))
    sceneRef.current = scene

    let raf = 0
    let last = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = last === 0 ? 16 : now - last
      last = now

      scene.sync(latest.current.state)
      scene.update(dt)
    }
    raf = requestAnimationFrame(frame)

    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)

    // A drag is the camera or a stray swipe, not a placement, so only a click
    // that barely moved counts as pointing at a tile.
    let downAt: { x: number; y: number } | null = null

    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY }
    }

    const onPointerUp = (e: PointerEvent) => {
      const start = downAt
      downAt = null
      if (!start || !latest.current.buildMode) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return

      latest.current.onPick(scene.pick(e.clientX, e.clientY))
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
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
        className={`joystick${buildMode || facing ? ' hidden' : ''}`}
        ref={stickRef}
        aria-hidden="true"
      >
        <div className="joystick-knob" ref={knobRef} />
      </div>
    </>
  )
}
