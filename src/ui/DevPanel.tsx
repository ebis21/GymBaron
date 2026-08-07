import { useGameStore } from '../store/gameStore'
import { DAY_MS, STAFF_UNLOCK_LEVEL } from '../game/constants'
import { summonLilD } from '../game/clients'
import { DOOR_QUEUE_Z, doorX } from '../game/layout'
import type { Client, ClientRarity } from '../game/types'
import { useI18n } from '../i18n'

const SHOWCASE_RARITIES: ClientRarity[] = ['common', 'rare', 'epic', 'legend', 'influencer']

/**
 * Testing shortcut, not a real feature: lets you jump straight to the parts
 * of the game that normally take a long grind to reach (staff, big
 * purchases) instead of replaying from a fresh save every time. Only built
 * into `npm run dev` — Vite strips this whole module from `npm run build`,
 * so it never ships in the mobile app.
 */
interface Props {
  /** Drops the player at the front counter; the scene owns their position. */
  onTeleportToReception: () => void
}

export default function DevPanel({ onTeleportToReception }: Props) {
  const { t } = useI18n()
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
          trainerUid: null,
          x: doorX(),
          z: DOOR_QUEUE_Z,
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
      <button onClick={() => cheat({ cash: state.cash + 1000 })}>+1000 kr</button>
      <button onClick={() => cheat({ cash: state.cash + 10000 })}>+10 000 kr</button>
      <button onClick={() => cheat({ level: state.level + 1, xp: 0 })}>{t.dev.levelUp}</button>
      <button onClick={() => cheat({ level: STAFF_UNLOCK_LEVEL, xp: 0 })}>
        {t.dev.staffLevel(STAFF_UNLOCK_LEVEL)}
      </button>
      <button onClick={onTeleportToReception}>{t.dev.teleport}</button>
      <button onClick={() => cheat({ dayMs: DAY_MS })}>{t.dev.closingTime}</button>
      <button onClick={() => cheat(summonLilD(state))}>{t.dev.summonLilD}</button>
      <button onClick={summonShowcase}>{t.dev.rankShowcase}</button>
      <button onClick={restart}>{t.dev.restart}</button>
    </div>
  )
}
