import type { DiamondUpgradeId, DiamondUpgradeLevels, GameState } from './types'
import { patienceMs } from './upgrades'

export interface DiamondUpgradeSpec {
  id: DiamondUpgradeId
  name: string
  description: string
  costs: readonly number[]
  effectPerLevel: string
}

export const DIAMOND_UPGRADE_SPECS: readonly DiamondUpgradeSpec[] = [
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

const byId = new Map(DIAMOND_UPGRADE_SPECS.map(spec => [spec.id, spec]))

export const emptyDiamondUpgrades = (): DiamondUpgradeLevels => ({
  queue_patience: 0,
  repair_discount: 0,
  xp_boost: 0,
})

export function diamondUpgradeSpec(id: DiamondUpgradeId): DiamondUpgradeSpec {
  const spec = byId.get(id)
  if (!spec) throw new Error(`Unknown diamond upgrade: ${id}`)
  return spec
}

export function diamondUpgradeCost(state: GameState, id: DiamondUpgradeId): number | null {
  return diamondUpgradeSpec(id).costs[state.diamondUpgrades[id]] ?? null
}

/** Refuses invalid, unaffordable and post-game purchases without mutating state. */
export function buyDiamondUpgrade(state: GameState, id: DiamondUpgradeId): GameState {
  const cost = diamondUpgradeCost(state, id)
  if (state.gameOver || cost === null || state.diamonds < cost) return state

  return {
    ...state,
    diamonds: state.diamonds - cost,
    diamondUpgrades: {
      ...state.diamondUpgrades,
      [id]: state.diamondUpgrades[id] + 1,
    },
  }
}

/** Stacks on top of the normal cash patience track. */
export function queuePatienceMs(state: GameState): number {
  return patienceMs(state) * (1 + state.diamondUpgrades.queue_patience * 0.1)
}

export function repairPrice(state: GameState, basePrice: number): number {
  return Math.ceil(basePrice * (1 - state.diamondUpgrades.repair_discount * 0.1))
}

export function xpMultiplier(state: GameState): number {
  return 1 + state.diamondUpgrades.xp_boost * 0.1
}

/** Satisfaction rewards are intentionally small and require real footfall. */
export function dailyDiamondReward(state: GameState): number {
  if (state.satisfaction >= 90 && state.today.clientsServed >= 20) return 2
  if (state.satisfaction >= 75 && state.today.clientsServed >= 10) return 1
  return 0
}
