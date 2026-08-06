import { useGameStore } from '../store/gameStore'
import { STAFF_UNLOCK_LEVEL } from '../game/constants'
import { summonLilD } from '../game/clients'
import { DOOR_QUEUE_ANCHOR, DOOR_X } from '../game/layout'
import type { Client, ClientRarity } from '../game/types'

const SHOWCASE_RARITIES: ClientRarity[] = ['common', 'rare', 'epic', 'legend', 'influencer']

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

  const summonShowcase = () => {
    let nextUid = state.nextUid
    const clients: Client[] = []

    for (const rarity of SHOWCASE_RARITIES) {
      // Consecutive ids guarantee one female and one male body variant.
      for (let variant = 0; variant < 2; variant += 1) {
        clients.push({
          uid: `c${nextUid++}`,
          kind: 'walkin',
          rarity,
          phase: 'arriving',
          phaseMs: 0,
          machineUid: null,
          memberUid: null,
          x: DOOR_X,
          z: DOOR_QUEUE_ANCHOR.z,
          path: [],
          goal: null,
        })
      }
    }

    cheat({ clients: [...state.clients, ...clients], nextUid })
  }

  return (
    <div className="dev-panel">
      <span className="dev-panel-tag">DEV</span>
      <button onClick={() => cheat({ cash: state.cash + 1000 })}>+1000 zł</button>
      <button onClick={() => cheat({ cash: state.cash + 10000 })}>+10 000 zł</button>
      <button onClick={() => cheat({ level: state.level + 1, xp: 0 })}>Poziom +1</button>
      <button onClick={() => cheat({ level: STAFF_UNLOCK_LEVEL, xp: 0 })}>
        Poziom {STAFF_UNLOCK_LEVEL} (personel)
      </button>
      <button onClick={() => cheat(summonLilD(state))}>Przywołaj LIL D.</button>
      <button onClick={summonShowcase}>Parada rang ♀/♂</button>
      <button onClick={restart}>Restart zapisu</button>
    </div>
  )
}
