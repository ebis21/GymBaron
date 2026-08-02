import type { DecorTypeId } from '../types'

export interface DecorType {
  id: DecorTypeId
  name: string
  price: number
}

/**
 * Furniture the player arranges for looks. None of it earns anything, so the
 * prices are low — this is spending money on a nicer room, not an investment.
 */
export const DECOR_TYPES: DecorType[] = [
  { id: 'plant', name: 'Roślina doniczkowa', price: 60 },
  { id: 'locker', name: 'Szafka', price: 120 },
  { id: 'watercooler', name: 'Dystrybutor wody', price: 150 },
  { id: 'reception', name: 'Recepcja', price: 400 },
]

const BY_ID = new Map<DecorTypeId, DecorType>(DECOR_TYPES.map(d => [d.id, d]))

export function decorType(id: DecorTypeId): DecorType {
  const t = BY_ID.get(id)
  if (!t) throw new Error(`Unknown decor type: ${id}`)
  return t
}

/** One wall segment on one tile edge. */
export const WALL_PRICE = 40
