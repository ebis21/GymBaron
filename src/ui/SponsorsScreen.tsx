import type { GameState } from '../game/types'
import type { SponsorAction } from '../game/sponsors'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onSponsor: (action: SponsorAction) => void
}

/**
 * Sponsorship deals.
 *
 * OWNER: `feat/v2-sponsors`. Nobody else edits this file.
 *
 * A stub on purpose. It is already routed from `App.tsx` and already has its
 * tile on the phone, so the owner replaces this body and touches nothing
 * shared. Everything it needs is on `state.sponsors`, and everything it does goes
 * out through `onSponsor`.
 */
export default function SponsorsScreen({ state: _state, onSponsor: _onSponsor }: Props) {
  const { t } = useI18n()

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t.sponsors.title}</h2>
      </header>
      <p className="hint">{t.sponsors.empty}</p>
    </div>
  )
}
