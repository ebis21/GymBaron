import { useGameStore } from '../store/gameStore'
import { STAFF_UNLOCK_LEVEL } from '../game/constants'

/**
 * Testing shortcut, not a real feature: lets you jump straight to the parts
 * of the game that normally take a long grind to reach (staff, big
 * purchases) instead of replaying from a fresh save every time. Only built
 * into `npm run dev` — Vite strips this whole module from `npm run build`,
 * so it never ships in the mobile app.
 */
export default function DevPanel() {
  const state = useGameStore(s => s.state)
  const cheat = useGameStore(s => s.cheat)
  const restart = useGameStore(s => s.restart)

  return (
    <div className="dev-panel">
      <span className="dev-panel-tag">DEV</span>
      <button onClick={() => cheat({ cash: state.cash + 1000 })}>+1000 zł</button>
      <button onClick={() => cheat({ cash: state.cash + 10000 })}>+10 000 zł</button>
      <button onClick={() => cheat({ level: state.level + 1, xp: 0 })}>Poziom +1</button>
      <button onClick={() => cheat({ level: STAFF_UNLOCK_LEVEL, xp: 0 })}>
        Poziom {STAFF_UNLOCK_LEVEL} (personel)
      </button>
      <button onClick={restart}>Restart zapisu</button>
    </div>
  )
}
