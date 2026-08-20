import { useState } from 'react'
import type { Client, GameState } from '../game/types'
import { entryFee, reputationBonus } from '../game/economy'
import { freeTrainers } from '../game/clients'
import { RARITY_LABEL, RARITY_MULTIPLIER } from '../game/content/rarity'
import { LIL_D_FAKE_PAYMENT, MEMBER_DISCOUNT, TRAINER_UNLOCK_LEVEL } from '../game/constants'
import { useI18n } from '../i18n'
import { displayName } from '../game/recruit'

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
  const { t, money, language } = useI18n()
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
  const appearance = isLilD
    ? t.client.man
    : numericId % 2 === 0 ? t.client.woman : t.client.man

  return (
    <div className="client-card">
      <button className="client-close" onClick={onClose} aria-label={t.client.close}>
        ✕
      </button>

      <span className={`client-rarity ${client.rarity}`}>{RARITY_LABEL[client.rarity]}</span>

      {isLilD && <h2 className="client-secret-name">LIL D.</h2>}

      <p className="client-kind">
        {isLilD
          ? t.client.secretKind
          : client.kind === 'member'
            ? t.client.memberKind(memberOff)
            : t.client.passerbyKind(appearance)}
      </p>

      <div className="client-rows">
        {isLilD ? (
          <div className="client-row secret-cash">
            <span>{t.client.noteValue}</span>
            <strong>{money(LIL_D_FAKE_PAYMENT)}</strong>
          </div>
        ) : (
          <>
            <div className="client-row">
              <span>{t.client.guestMultiplier}</span>
              <strong>×{RARITY_MULTIPLIER[client.rarity].toFixed(1)}</strong>
            </div>
            <div className="client-row">
              <span>{t.client.reputation}</span>
              <strong>{repBonus > 0 ? `+${repBonus}%` : '—'}</strong>
            </div>
          </>
        )}
        <div className="client-row">
          <span>{t.client.freeStation}</span>
          <strong>{free ? t.content.machines[free.type] : '—'}</strong>
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
                <strong>{t.client.trainer}</strong>
                <small>
                  {booked
                    ? `${displayName(available[0]!.name, language)} · +${money(fee - plainFee)}`
                    : t.client.trainerOffer(available.length)}
                </small>
              </span>
            </button>
          ) : (
            <p className="trainer-hint">
              {hasTrainers
                ? t.client.trainersBusy
                : state.level >= TRAINER_UNLOCK_LEVEL
                  ? t.client.trainersHire
                  : t.client.trainersLocked(TRAINER_UNLOCK_LEVEL)}
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
          ? isLilD ? t.client.takeCash(money(fee)) : t.client.scan(money(fee))
          : t.client.noMachine}
      </button>
    </div>
  )
}
