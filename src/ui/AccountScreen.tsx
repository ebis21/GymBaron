import { useState, type FormEvent } from 'react'
import { useAccount } from '../cloud/useAccount'
import type { AccountService } from '../cloud/account'
import type { SyncStatus } from '../cloud/cloudSave'
import { useI18n } from '../i18n'
import type { ClubStrings } from '../i18n/club'

function timeAgo(at: number | null, copy: ClubStrings['account']): string | null {
  if (at === null) return null
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 60) return copy.justNow
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return copy.minutesAgo(minutes)
  return copy.hoursAgo(Math.round(minutes / 60))
}

function SyncBadge({ status, at }: { status: SyncStatus; at: number | null }) {
  const { t } = useI18n()
  const copy = t.club.account
  const ago = status === 'synced' ? timeAgo(at, copy) : null
  return (
    <div className={`account-sync is-${status}`}>
      <span className="account-sync-dot" />
      <span>
        {copy.sync[status]}
        {ago ? ` · ${ago}` : ''}
      </span>
    </div>
  )
}

/**
 * The account screen: sign up, sign in, sign out, and an honest read on
 * whether the gym is actually backed up.
 *
 * It is a leaf component on purpose — it owns no game state and is mounted
 * wherever the phone UI wants it. `service` exists so the screen can be driven
 * by a fake in a story or a test.
 */
export default function AccountScreen({ service }: { service?: AccountService } = {}) {
  const account = useAccount(service)
  const { state } = account
  const { t } = useI18n()
  const copy = t.club.account
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (state.busy) return
    const ok =
      mode === 'signUp'
        ? await account.signUp(email, password)
        : await account.signIn(email, password)
    if (ok) setPassword('')
  }

  if (!state.configured) {
    return (
      <div className="screen">
        <h2 className="section-title">{copy.title}</h2>
        <p className="hint">{copy.unavailable}</p>
      </div>
    )
  }

  if (state.session) {
    return (
      <div className="screen">
        <h2 className="section-title">{copy.title}</h2>
        <div className="account-card">
          <div className="account-email">{state.session.email ?? copy.signedIn}</div>
          <SyncBadge status={state.sync.status} at={state.sync.lastSyncedAt} />
          {state.sync.pending ? (
            <p className="hint" style={{ margin: '8px 0 0' }}>
              {copy.pending}
            </p>
          ) : null}
        </div>

        <p className="hint">{copy.cloudHint}</p>

        {state.notice ? <p className="account-notice">{state.notice}</p> : null}
        {state.sync.message && state.sync.status !== 'synced' ? (
          <p className="account-error">{state.sync.message}</p>
        ) : null}
        {state.error ? <p className="account-error">{state.error}</p> : null}

        <button
          type="button"
          className="btn block"
          disabled={state.busy}
          onClick={() => void account.signOut()}
        >
          {state.busy ? copy.busy : copy.signOut}
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <h2 className="section-title">{mode === 'signUp' ? copy.signUp : copy.signIn}</h2>
      <p className="hint">{copy.authHint}</p>

      <form className="account-form" onSubmit={submit}>
        <label className="account-field">
          <span>{copy.email}</span>
          <input
            className="account-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={event => setEmail(event.target.value)}
            disabled={state.busy}
          />
        </label>

        <label className="account-field">
          <span>{copy.password}</span>
          <input
            className="account-input"
            type="password"
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={state.busy}
          />
        </label>

        {state.error ? <p className="account-error">{state.error}</p> : null}
        {state.notice ? <p className="account-notice">{state.notice}</p> : null}

        <button type="submit" className="btn primary block" disabled={state.busy}>
          {state.busy ? copy.busy : mode === 'signUp' ? copy.signUp : copy.signIn}
        </button>
      </form>

      <button
        type="button"
        className="btn ghost block"
        disabled={state.busy}
        onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
      >
        {mode === 'signUp' ? copy.haveAccount : copy.needAccount}
      </button>
    </div>
  )
}
