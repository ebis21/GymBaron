import type { Client, GameState } from '../game/types'
import { entryFee } from '../game/economy'
import { machineType } from '../game/content/machines'
import { RARITY_LABEL, RARITY_MULTIPLIER } from '../game/content/rarity'
import { LIL_D_FAKE_PAYMENT } from '../game/constants'
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
  const isLilD = client.special === 'lil-d'
  const fee = free
    ? isLilD ? LIL_D_FAKE_PAYMENT : entryFee(free.type, client.kind, client.rarity)
    : 0
  const numericId = Number(client.uid.replace(/\D/g, '')) || 1
  const appearance = isLilD ? 'mężczyzna' : numericId % 2 === 0 ? 'kobieta' : 'mężczyzna'

  return (
    <div className="client-card">
      <button className="client-close" onClick={onClose} aria-label="Zamknij">
        ✕
      </button>

      <span className={`client-rarity ${client.rarity}`}>{RARITY_LABEL[client.rarity]}</span>

      {isLilD && <h2 className="client-secret-name">LIL D.</h2>}

      <p className="client-kind">
        {isLilD
          ? 'Gość specjalny · płaci grubym plikiem gotówki'
          : client.kind === 'member'
            ? 'Członek — zniżka z karnetu'
            : `Przechodzień z ulicy · ${appearance}`}
      </p>

      <div className="client-rows">
        {isLilD ? (
          <div className="client-row secret-cash">
            <span>Nominał banknotów</span>
            <strong>{money(LIL_D_FAKE_PAYMENT)}</strong>
          </div>
        ) : (
          <div className="client-row">
            <span>Mnożnik gościa</span>
            <strong>×{RARITY_MULTIPLIER[client.rarity].toFixed(1)}</strong>
          </div>
        )}
        <div className="client-row">
          <span>Wolne stanowisko</span>
          <strong>{free ? machineType(free.type).name : '—'}</strong>
        </div>
      </div>

      <button className="btn primary block big" disabled={!free} onClick={onScan}>
        {free
          ? isLilD ? `Przyjmij gotówkę · +${money(fee)}?` : `Skanuj karnet · +${money(fee)}`
          : 'Brak wolnej maszyny'}
      </button>
    </div>
  )
}
