const KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

export interface MoveVector {
  x: number
  z: number
}

/**
 * Turns a keyboard and an on-screen stick into one normalised direction. The
 * two sources are additive, so a laptop with a touchscreen can use either
 * without a mode switch.
 */
export class Controls {
  private readonly held = new Set<string>()
  private stick: MoveVector = { x: 0, z: 0 }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!KEYS[e.code]) return
    // Arrow keys scroll the page otherwise, which fights the camera.
    e.preventDefault()
    this.held.add(e.code)
  }

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code)
  }

  /** A tab that loses focus must not leave a key stuck down. */
  private readonly onBlur = () => {
    this.held.clear()
  }

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  /** Called by the joystick component; values are already in −1…1. */
  setStick(x: number, z: number): void {
    this.stick = { x, z }
  }

  vector(): MoveVector {
    let x = this.stick.x
    let z = this.stick.z

    for (const code of this.held) {
      const dir = KEYS[code]
      if (dir) {
        x += dir[0]
        z += dir[1]
      }
    }

    const length = Math.hypot(x, z)
    if (length < 0.08) return { x: 0, z: 0 }
    // Normalise so diagonals are not faster than the cardinals.
    return length > 1 ? { x: x / length, z: z / length } : { x, z }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.held.clear()
  }
}
