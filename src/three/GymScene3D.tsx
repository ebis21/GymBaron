import { useEffect, useRef } from 'react'
import type { GameState, MachineTypeId } from '../game/types'
import { GymScene, type Focus } from './scene'

interface Props {
  state: GameState
  pending: MachineTypeId | null
  onFocus: (focus: Focus) => void
}

const STICK_RADIUS = 52

/**
 * The only bridge between React and three.js. React owns the canvas element
 * and nothing else — the scene keeps its own render loop, because rerendering
 * a component tree at 60fps to move one character would be absurd.
 */
export default function GymScene3D({ state, pending, onFocus }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<GymScene | null>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)

  // Read through a ref inside the loop so the effect never needs to re-run.
  const latest = useRef({ state, pending, onFocus })
  latest.current = { state, pending, onFocus }

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

      scene.sync(latest.current.state, latest.current.pending)
      scene.update(dt)
    }
    raf = requestAnimationFrame(frame)

    const onResize = () => scene.resize()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
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
      <div className="joystick" ref={stickRef} aria-hidden="true">
        <div className="joystick-knob" ref={knobRef} />
      </div>
    </>
  )
}
