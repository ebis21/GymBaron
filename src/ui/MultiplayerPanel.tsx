import { useAccount } from '../cloud'
import { useI18n } from '../i18n'
import { getMultiplayerApi } from '../multiplayer/runtime'
import MultiplayerScreen from './MultiplayerScreen'

interface Props {
  onOpenAccount: () => void
}

export default function MultiplayerPanel({ onOpenAccount }: Props) {
  const { state } = useAccount()
  const { t } = useI18n()
  const copy = t.club.multiplayer

  if (!state.configured) {
    return (
      <div className="screen multiplayer-gate">
        <h2 className="section-title">Multiplayer</h2>
        <p className="hint">{copy.notConfigured}</p>
      </div>
    )
  }

  if (!state.session) {
    return (
      <div className="screen multiplayer-gate">
        <div className="multiplayer-gate-icon">🤝</div>
        <h2 className="section-title">{copy.signInTitle}</h2>
        <p className="hint">{copy.signInHint}</p>
        <button className="btn primary" type="button" onClick={onOpenAccount}>
          {copy.openAccount}
        </button>
      </div>
    )
  }

  return <MultiplayerScreen api={getMultiplayerApi()} />
}
