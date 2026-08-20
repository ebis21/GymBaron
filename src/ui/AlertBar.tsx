import type { AlertKind, GymAlert } from '../game/alerts'
import { countOf } from '../game/alerts'
import { useI18n } from '../i18n'

interface Props {
  alerts: GymAlert[]
  /** Which kind the arrow on the floor is currently leading to, if any. */
  guide: AlertKind | null
  /** Passing null puts the arrow away. */
  onGuide: (kind: AlertKind | null) => void
}

/** Left to right, so a broken machine always reads before a mess. */
const KINDS: { kind: AlertKind; glyph: string }[] = [
  { kind: 'broken', glyph: '🔧' },
  { kind: 'dirty', glyph: '🧽' },
]

/**
 * What the gym is quietly losing money on, as two chips under the topbar.
 *
 * A count is the whole notification: a toast that has to be dismissed would
 * arrive during a queue at the desk, and the trouble it announced does not go
 * away when it does. These stay up for exactly as long as the problem does,
 * and tapping one puts an arrow on the floor pointing at the nearest of them
 * — because knowing there are three stains somewhere is not knowing where.
 *
 * Tapping the lit chip again puts the arrow away. Nothing here reads the
 * viewport: the same two chips are the right size for a thumb and small enough
 * not to crowd a desktop topbar.
 */
export default function AlertBar({ alerts, guide, onGuide }: Props) {
  const { t } = useI18n()

  const chips = KINDS.map(({ kind, glyph }) => ({
    kind,
    glyph,
    count: countOf(alerts, kind),
    // One of them past the grace window is enough to redden the chip: the
    // player is already being charged, and which one is the arrow's business.
    costing: alerts.some(a => a.kind === kind && a.costing),
  })).filter(chip => chip.count > 0)

  if (chips.length === 0) return null

  return (
    <div className="alert-bar">
      {chips.map(chip => (
        <button
          key={chip.kind}
          className={`alert-chip${chip.costing ? ' costing' : ''}${guide === chip.kind ? ' leading' : ''}`}
          aria-pressed={guide === chip.kind}
          aria-label={t.alerts[chip.kind](chip.count)}
          onClick={() => onGuide(guide === chip.kind ? null : chip.kind)}
        >
          <span className="alert-glyph">{chip.glyph}</span>
          <span className="alert-count">{chip.count}</span>
          {/* Says what the tap does, and doubles as the "you are being led
              there" state once it is lit. */}
          <span className="alert-lead">➤</span>
        </button>
      ))}
    </div>
  )
}
