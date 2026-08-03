import type { Client, GameState } from '../game/types'
import { entryFee } from '../game/economy'
import { machineType } from '../game/content/machines'
import { RARITY_LABEL, RARITY_MULTIPLIER } from '../game/content/rarity'
import { money } from './format'

interface Props {
  state: GameState
  client: Client
  onScan: () => void
  onClose: () => void
}

/**
 * The counter, seen from behind it. The player is stood face to face with one
 * visitor, so this is a card about that one person rather than another button
 * floating over the room — who they are, what they are worth, and the one
 * decision available.
 */
export default function ClientCard({ state, client, onScan, onClose }: Props) {
  const free = state.machines.find(m => m.durability > 0 && m.occupiedBy === null)
  const fee = free ? entryFee(free.type, client.kind, client.rarity) : 0

  return (
    <div className="client-card">
      <button className="client-close" onClick={onClose} aria-label="Zamknij">
        ✕
      </button>

      <span className={`client-rarity ${client.rarity}`}>{RARITY_LABEL[client.rarity]}</span>

      <p className="client-kind">
        {client.kind === 'member' ? 'Członek — karnet, 90% zniżki' : 'Przechodzień z ulicy'}
      </p>

      <div className="client-rows">
        <div className="client-row">
          <span>Mnożnik gościa</span>
          <strong>×{RARITY_MULTIPLIER[client.rarity].toFixed(1)}</strong>
        </div>
        <div className="client-row">
          <span>Wolne stanowisko</span>
          <strong>{free ? machineType(free.type).name : '—'}</strong>
        </div>
      </div>

      <button className="btn primary block big" disabled={!free} onClick={onScan}>
        {free ? `Skanuj karnet · +${money(fee)}` : 'Brak wolnej maszyny'}
      </button>
    </div>
  )
}
