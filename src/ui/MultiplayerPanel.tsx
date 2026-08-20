import { useAccount } from '../cloud'
import { getMultiplayerApi } from '../multiplayer/runtime'
import MultiplayerScreen from './MultiplayerScreen'

interface Props {
  onOpenAccount: () => void
}

export default function MultiplayerPanel({ onOpenAccount }: Props) {
  const { state } = useAccount()

  if (!state.configured) {
    return (
      <div className="screen multiplayer-gate">
        <h2 className="section-title">Multiplayer</h2>
        <p className="hint">
          Ta wersja aplikacji nie ma konfiguracji Supabase. Gra lokalna nadal działa,
          ale znajomi i zapis konta są niedostępne.
        </p>
      </div>
    )
  }

  if (!state.session) {
    return (
      <div className="screen multiplayer-gate">
        <div className="multiplayer-gate-icon">🤝</div>
        <h2 className="section-title">Zaloguj się do multiplayera</h2>
        <p className="hint">
          Konto jest potrzebne, żeby znaleźć znajomych, oglądać ich bazy, zawierać
          sojusze i wysyłać LIL D.
        </p>
        <button className="btn primary" type="button" onClick={onOpenAccount}>
          Otwórz konto
        </button>
      </div>
    )
  }

  return <MultiplayerScreen api={getMultiplayerApi()} />
}
