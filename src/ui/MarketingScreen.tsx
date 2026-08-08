import type { GameState } from '../game/types'
import type { MarketingAction } from '../game/marketing'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onMarketing: (action: MarketingAction) => void
}

/**
 * Advertising campaigns.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * A stub on purpose. It is already routed from `App.tsx` and already has its
 * tile on the phone, so the owner replaces this body and touches nothing
 * shared. Everything it needs is on `state.marketing`, and everything it does goes
 * out through `onMarketing`.
 */
export default function MarketingScreen({ state: _state, onMarketing: _onMarketing }: Props) {
  const { t } = useI18n()

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t.marketing.title}</h2>
      </header>
      <p className="hint">{t.marketing.empty}</p>
    </div>
  )
}
