import type { GameState } from '../game/types'
import type { ContractAction } from '../game/contracts'
import { useI18n } from '../i18n'

interface Props {
  state: GameState
  /** The feature's one dispatcher, wired straight through from the store. */
  onContract: (action: ContractAction) => void
}

/**
 * Equipment supplier contracts.
 *
 * OWNER: `feat/v2-equipment-contracts`. Nobody else edits this file.
 *
 * A stub on purpose. It is already routed from `App.tsx` and already has its
 * tile on the phone, so the owner replaces this body and touches nothing
 * shared. Everything it needs is on `state.contracts`, and everything it does goes
 * out through `onContract`.
 */
export default function ContractsScreen({ state: _state, onContract: _onContract }: Props) {
  const { t } = useI18n()

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>{t.contracts.title}</h2>
      </header>
      <p className="hint">{t.contracts.empty}</p>
    </div>
  )
}
