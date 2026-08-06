import { useState } from 'react'
import type { Client, GameState } from '../game/types'
import { entryFee, reputationBonus } from '../game/economy'
import { freeTrainers } from '../game/clients'
import { machineType } from '../game/content/machines'
import { RARITY_LABEL, RARITY_MULTIPLIER } from '../game/content/rarity'
import { LIL_D_FAKE_PAYMENT, MEMBER_DISCOUNT, TRAINER_UNLOCK_LEVEL } from '../game/constants'
import { money } from './format'

interface Props {
  state: GameState
  client: Client
  /** `trainerUid` is the coach the player booked, or null for a plain visit. */
  onScan: (trainerUid: string | null) => void
  onClose: () => void
}

/**
 * The counter, seen from behind it. The player is stood face to face with one
 * visitor, so this is a card about that one person rather than another button
 * floating over the room — who they are, what they are worth, and the two
 * decisions available: let them in, and whether to sell them a trainer.
 */
export default function ClientCard({ state, client, onScan, onClose }: Props) {
  const free = state.machines.find(m => m.durability > 0 && m.occupiedBy === null)
  const isLilD = client.special === 'lil-d'

  const available = freeTrainers(state)
  const hasTrainers = state.staff.some(s => s.role === 'trainer')
  const [booked, setBooked] = useState(false)

  // Only ever offered while somebody is actually free to take the session, so
  // a coach who gets booked between this card opening and the button being
  // pressed cannot leave a stale ×1.5 on screen. `scanClient` re-checks anyway.
  const coach = booked ? available[0] ?? null : null

  const plainFee = free ? entryFee(free.type, client.kind, client.rarity, state.reputation) : 0
  const fee = free
    ? isLilD
      ? LIL_D_FAKE_PAYMENT
      : entryFee(free.type, client.kind, client.rarity, state.reputation, coach !== null)
    : 0

  const repBonus = Math.round((reputationBonus(state.reputation) - 1) * 100)
  const memberOff = Math.round((1 - MEMBER_DISCOUNT) * 100)

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
            ? `Członek — karnet, ${memberOff}% zniżki`
            : `Przechodzień z ulicy · ${appearance}`}
      </p>

      <div className="client-rows">
        {isLilD ? (
          <div className="client-row secret-cash">
            <span>Nominał banknotów</span>
            <strong>{money(LIL_D_FAKE_PAYMENT)}</strong>
          </div>
        ) : (
          <>
            <div className="client-row">
              <span>Mnożnik gościa</span>
              <strong>×{RARITY_MULTIPLIER[client.rarity].toFixed(1)}</strong>
            </div>
            <div className="client-row">
              <span>Renoma</span>
              <strong>{repBonus > 0 ? `+${repBonus}%` : '—'}</strong>
            </div>
          </>
        )}
        <div className="client-row">
          <span>Wolne stanowisko</span>
          <strong>{free ? machineType(free.type).name : '—'}</strong>
        </div>
      </div>

      {!isLilD && (
        <div className="client-trainer">
          {available.length > 0 ? (
            <button
              className={`trainer-toggle${booked ? ' on' : ''}`}
              onClick={() => setBooked(b => !b)}
            >
              <span className="trainer-mark">{booked ? '✓' : '+'}</span>
              <span className="trainer-text">
                <strong>Trener personalny</strong>
                <small>
                  {booked
                    ? `${available[0]!.name} · +${money(fee - plainFee)}`
                    : `×1.5 za wizytę · wolnych: ${available.length}`}
                </small>
              </span>
            </button>
          ) : (
            <p className="trainer-hint">
              {hasTrainers
                ? 'Wszyscy trenerzy są w tej chwili zajęci.'
                : state.level >= TRAINER_UNLOCK_LEVEL
                  ? 'Zatrudnij trenera w Personelu, żeby sprzedawać sesje ×1.5.'
                  : `Trenerzy personalni od poziomu ${TRAINER_UNLOCK_LEVEL}.`}
            </p>
          )}
        </div>
      )}

      <button
        className="btn primary block big"
        disabled={!free}
        onClick={() => onScan(coach ? coach.uid : null)}
      >
        {free
          ? isLilD ? `Przyjmij gotówkę · +${money(fee)}?` : `Skanuj karnet · +${money(fee)}`
          : 'Brak wolnej maszyny'}
      </button>
    </div>
  )
}
