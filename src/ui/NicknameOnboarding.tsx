import { useState, type FormEvent } from 'react'
import type { MultiplayerErrorCode } from '../multiplayer'
import { useI18n } from '../i18n'

interface Props {
  ready: boolean
  loading: boolean
  saving: boolean
  error: MultiplayerErrorCode | null
  onChoose: (nickname: string) => Promise<boolean>
  onRetry: () => void
}

export default function NicknameOnboarding({
  ready,
  loading,
  saving,
  error,
  onChoose,
  onRetry,
}: Props) {
  const { t } = useI18n()
  const copy = t.club.nickname
  const [nickname, setNickname] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    await onChoose(nickname)
  }

  if (loading || (!ready && !error)) {
    return (
      <div className="nickname-onboarding is-loading" role="status">
        <div className="nickname-crown" aria-hidden="true">♛</div>
        <p>{copy.loading}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="nickname-onboarding is-loading">
        <div className="nickname-crown" aria-hidden="true">♛</div>
        <p className="account-error">
          {error ? t.club.multiplayer.errors[error] : copy.loadFailed}
        </p>
        <button className="btn primary" type="button" onClick={onRetry}>
          {copy.retry}
        </button>
      </div>
    )
  }

  return (
    <div className="nickname-onboarding">
      <div className="nickname-crown" aria-hidden="true">♛</div>
      <p className="club-eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="nickname-subtitle">{copy.subtitle}</p>

      <form className="nickname-form" onSubmit={submit}>
        <label className="account-field">
          <span>{copy.label}</span>
          <input
            className="account-input nickname-input"
            value={nickname}
            onChange={event => setNickname(event.target.value)}
            placeholder={copy.placeholder}
            minLength={3}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="words"
            autoFocus
            disabled={saving}
          />
        </label>
        <small className="nickname-rules">{copy.rules}</small>
        {error && <p className="account-error">{t.club.multiplayer.errors[error]}</p>}
        <button
          className="btn primary block nickname-confirm"
          type="submit"
          disabled={saving || nickname.trim().length < 3}
        >
          {saving ? copy.saving : copy.confirm}
        </button>
      </form>

      <p className="nickname-once">{copy.oneTime}</p>
    </div>
  )
}
