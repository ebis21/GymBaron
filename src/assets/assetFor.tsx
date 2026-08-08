import type { FC } from 'react'
import type { BaseMachineTypeId, MachineTypeId } from '../game/types'
import { bySupplierMachine } from '../game/content/suppliers'

export type AssetId = MachineTypeId | 'client' | 'floor' | 'logo'

export interface AssetProps {
  className?: string
}

/**
 * Every visual in the game resolves through this module. Nothing outside
 * `src/assets/` may reference an image file directly, so swapping these SVG
 * placeholders for generated artwork is a change confined to this folder.
 */

const STEEL = '#8d97a8'
const CHARCOAL = '#2b3038'
const ORANGE = '#f07b1d'

const svg =
  (body: React.ReactNode): FC<AssetProps> =>
  ({ className }) => (
    <svg viewBox="0 0 64 64" className={className} role="presentation" focusable="false">
      {body}
    </svg>
  )

const Dumbbells = svg(
  <>
    <rect x="10" y="28" width="44" height="8" rx="4" fill={STEEL} />
    <rect x="4" y="20" width="10" height="24" rx="3" fill={CHARCOAL} />
    <rect x="50" y="20" width="10" height="24" rx="3" fill={CHARCOAL} />
    <rect x="14" y="24" width="6" height="16" rx="2" fill={ORANGE} />
    <rect x="44" y="24" width="6" height="16" rx="2" fill={ORANGE} />
  </>,
)

const Bench = svg(
  <>
    <rect x="8" y="24" width="48" height="10" rx="5" fill={CHARCOAL} />
    <rect x="14" y="34" width="6" height="20" rx="2" fill={STEEL} />
    <rect x="44" y="34" width="6" height="20" rx="2" fill={STEEL} />
    <rect x="6" y="14" width="18" height="8" rx="4" fill={ORANGE} />
  </>,
)

const Treadmill = svg(
  <>
    <rect x="6" y="36" width="46" height="14" rx="7" fill={CHARCOAL} />
    <circle cx="15" cy="43" r="4" fill={STEEL} />
    <circle cx="43" cy="43" r="4" fill={STEEL} />
    <rect x="44" y="10" width="6" height="28" rx="3" fill={STEEL} />
    <rect x="38" y="8" width="20" height="6" rx="3" fill={ORANGE} />
  </>,
)

const LatPulldown = svg(
  <>
    <rect x="28" y="8" width="8" height="34" rx="3" fill={STEEL} />
    <rect x="14" y="8" width="36" height="6" rx="3" fill={ORANGE} />
    <rect x="18" y="42" width="28" height="12" rx="4" fill={CHARCOAL} />
    <rect x="24" y="20" width="16" height="6" rx="3" fill={CHARCOAL} />
  </>,
)

const Bike = svg(
  <>
    <circle cx="20" cy="44" r="11" fill="none" stroke={CHARCOAL} strokeWidth="5" />
    <circle cx="46" cy="44" r="8" fill="none" stroke={STEEL} strokeWidth="5" />
    <path d="M20 44 L32 22 L46 44" fill="none" stroke={CHARCOAL} strokeWidth="5" />
    <rect x="24" y="16" width="18" height="6" rx="3" fill={ORANGE} />
  </>,
)

const Cable = svg(
  <>
    <rect x="8" y="8" width="8" height="46" rx="3" fill={CHARCOAL} />
    <rect x="48" y="8" width="8" height="46" rx="3" fill={CHARCOAL} />
    <rect x="8" y="8" width="48" height="6" rx="3" fill={STEEL} />
    <rect x="18" y="20" width="10" height="20" rx="3" fill={ORANGE} />
    <rect x="36" y="20" width="10" height="20" rx="3" fill={ORANGE} />
  </>,
)

const Client = svg(
  <>
    <circle cx="32" cy="18" r="10" fill={ORANGE} />
    <path d="M14 56 Q32 32 50 56 Z" fill={CHARCOAL} />
  </>,
)

const Floor = svg(
  <>
    <rect x="0" y="0" width="64" height="64" fill="#1a1e26" />
    <rect x="4" y="4" width="56" height="56" rx="4" fill="#222833" />
  </>,
)

/**
 * Shield crest, drawn inline rather than loaded from a file: it renders at any
 * size without a network fetch. The generated raster version of this mark
 * lives in `public/assets/` and is what the native app icons use.
 */
const Logo = svg(
  <>
    <path d="M32 4 L58 14 V32 Q58 50 32 60 Q6 50 6 32 V14 Z" fill={CHARCOAL} />
    <path d="M32 9 L53 17 V32 Q53 46 32 54 Q11 46 11 32 V17 Z" fill="none" stroke={ORANGE} strokeWidth="2.5" />
    <path d="M32 18 Q40 18 40 27 V42 L32 50 L24 42 V27 Q24 18 32 18 Z" fill={ORANGE} />
    <rect x="8" y="28" width="48" height="7" rx="3.5" fill={STEEL} stroke="#14161c" strokeWidth="2" />
    <rect x="10" y="23" width="9" height="17" rx="3" fill={STEEL} stroke="#14161c" strokeWidth="2" />
    <rect x="45" y="23" width="9" height="17" rx="3" fill={STEEL} stroke="#14161c" strokeWidth="2" />
  </>,
)

const BASE_MACHINE_ASSETS: Record<BaseMachineTypeId, FC<AssetProps>> = {
  dumbbells: Dumbbells,
  bench: Bench,
  treadmill: Treadmill,
  latpulldown: LatPulldown,
  bike: Bike,
  cable: Cable,
}

/**
 * Supplier kit borrows its archetype's icon, exactly as it borrows the model:
 * the shop row already carries the name and the tier's numbers, and a second
 * silhouette for the same machine would say less than either.
 */
const ASSETS: Record<AssetId, FC<AssetProps>> = {
  ...BASE_MACHINE_ASSETS,
  ...bySupplierMachine(archetype => BASE_MACHINE_ASSETS[archetype]),
  client: Client,
  floor: Floor,
  logo: Logo,
}

export function assetFor(id: AssetId): FC<AssetProps> {
  return ASSETS[id]
}
