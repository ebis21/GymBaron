import { PATIENCE_MS } from './constants'
import type { GameState, UpgradeId, UpgradeLevels } from './types'

export interface UpgradeSpec {
  id: UpgradeId
  name: string
  description: string
  costs: readonly number[]
  effectPerLevel: string
}

export const UPGRADE_SPECS: readonly UpgradeSpec[] = [
  {
    id: 'queue_patience',
    name: 'Spokojna kolejka',
    description: 'Klienci dłużej czekają na obsługę przy recepcji.',
    costs: [5, 8, 12],
    effectPerLevel: '+10% czasu',
  },
  {
    id: 'repair_discount',
    name: 'Warsztat premium',
    description: 'Ręczne naprawy maszyn kosztują mniej kredytów.',
    costs: [5, 8, 12],
    effectPerLevel: '−10% kosztu',
  },
  {
    id: 'xp_boost',
    name: 'Akademia trenera',
    description: 'Każde źródło doświadczenia daje więcej XP.',
    costs: [6, 10, 15],
    effectPerLevel: '+10% XP',
  },
] as const

const byId = new Map(UPGRADE_SPECS.map(spec => [spec.id, spec]))

export const emptyUpgrades = (): UpgradeLevels => ({
  queue_patience: 0,
  repair_discount: 0,
  xp_boost: 0,
})

export function upgradeSpec(id: UpgradeId): UpgradeSpec {
  const spec = byId.get(id)
  if (!spec) throw new Error(`Unknown upgrade: ${id}`)
  return spec
}

export function upgradeCost(state: GameState, id: UpgradeId): number | null {
  return upgradeSpec(id).costs[state.upgrades[id]] ?? null
}

/** Refuses invalid, unaffordable and post-game purchases without mutating state. */
export function buyUpgrade(state: GameState, id: UpgradeId): GameState {
  const cost = upgradeCost(state, id)
  if (state.gameOver || cost === null || state.diamonds < cost) return state

  return {
    ...state,
    diamonds: state.diamonds - cost,
    upgrades: { ...state.upgrades, [id]: state.upgrades[id] + 1 },
  }
}

export function queuePatienceMs(state: GameState): number {
  return PATIENCE_MS * (1 + state.upgrades.queue_patience * 0.1)
}

export function repairPrice(state: GameState, basePrice: number): number {
  return Math.ceil(basePrice * (1 - state.upgrades.repair_discount * 0.1))
}

export function xpMultiplier(state: GameState): number {
  return 1 + state.upgrades.xp_boost * 0.1
}

/** Satisfaction rewards are intentionally small and require real footfall. */
export function dailyDiamondReward(state: GameState): number {
  if (state.satisfaction >= 90 && state.today.clientsServed >= 20) return 2
  if (state.satisfaction >= 75 && state.today.clientsServed >= 10) return 1
  return 0
}
