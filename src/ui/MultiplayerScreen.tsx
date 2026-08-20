import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  SABOTAGE_COST,
  multiplayerErrorCode,
  newIdempotencyKey,
  type FriendGymSnapshot,
  type FriendSummary,
  type MultiplayerApi,
  type MultiplayerOverview,
  type PlayerSummary,
  type TransferAsset,
} from '../multiplayer'
import { useI18n } from '../i18n'
import FriendGymView from './FriendGymView'
import './multiplayer.css'

interface Props {
  api: MultiplayerApi
  onClose?: () => void
}

const wholeNumber = (value: string): number => Number(value)
const shortDate = (value: string, language: 'en' | 'pl'): string =>
  new Date(value).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB')

export default function MultiplayerScreen({ api, onClose }: Props) {
  const { language, money, t } = useI18n()
  const copy = t.club.multiplayer
  const errorMessage = useCallback(
    (reason: unknown) => copy.errors[multiplayerErrorCode(reason)],
    [copy.errors],
  )
  const [overview, setOverview] = useState<MultiplayerOverview | null>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlayerSummary[]>([])
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null)
  const [gym, setGym] = useState<FriendGymSnapshot | null>(null)
  const [transferAsset, setTransferAsset] = useState<TransferAsset>('cash')
  const [transferAmount, setTransferAmount] = useState('')
  const [loanAmount, setLoanAmount] = useState('')
  const [repayments, setRepayments] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Failed/retried financial commands keep their original exactly-once key. */
  const idempotencyKeys = useRef(new Map<string, string>())

  const reload = useCallback(async () => {
    setOverview(await api.getOverview())
  }, [api])

  useEffect(() => {
    let active = true
    setBusy(true)
    api.getOverview()
      .then(value => { if (active) setOverview(value) })
      .catch(reason => { if (active) setError(errorMessage(reason)) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [api, errorMessage])

  const run = useCallback(async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
      setMessage(success)
      try {
        await reload()
      } catch {
        setError(copy.refreshFailed)
      }
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }, [copy.refreshFailed, errorMessage, reload])

  const idempotent = useCallback(<T,>(
    fingerprint: string,
    action: (key: string) => Promise<T>,
  ): Promise<T> => {
    const key = idempotencyKeys.current.get(fingerprint) ?? newIdempotencyKey()
    idempotencyKeys.current.set(fingerprint, key)
    return action(key).then(result => {
      idempotencyKeys.current.delete(fingerprint)
      return result
    })
  }, [])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setSearchResults(await api.searchPlayers(query))
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const openGym = async (friend: FriendSummary) => {
    setBusy(true)
    setError(null)
    try {
      setGym(await api.getFriendGym(friend.profile.id))
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const confirmSabotage = (friend: FriendSummary) => {
    const confirmed = window.confirm(
      copy.sabotageConfirm(friend.profile.username, money(SABOTAGE_COST)),
    )
    if (!confirmed) return
    void run(
      () => idempotent(
        `sabotage:${friend.profile.id}`,
        idempotencyKey => api.sabotage({ targetId: friend.profile.id, idempotencyKey }),
      ),
      copy.sabotageSent,
    )
  }

  if (gym) return <FriendGymView snapshot={gym} onBack={() => setGym(null)} />

  return (
    <section className="multiplayer-screen" aria-label="Multiplayer">
      <header className="multiplayer-heading">
        <div>
          <p className="multiplayer-eyebrow">Gymbaron Social</p>
          <h2 className="section-title">{copy.title}</h2>
          {overview && <p className="hint">{copy.signedInAs(overview.me.username)}</p>}
        </div>
        {onClose && <button className="btn ghost tiny" type="button" onClick={onClose}>{copy.close}</button>}
      </header>

      {(message || error) && (
        <p className={`multiplayer-notice ${error ? 'error' : 'success'}`} role="status">
          {error ?? message}
        </p>
      )}

      <section className="multiplayer-card">
        <h3>{copy.findPlayer}</h3>
        <form className="multiplayer-inline-form" onSubmit={search}>
          <label className="multiplayer-field grow">
            <span>{copy.uniqueName}</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={copy.queryPlaceholder}
              maxLength={24}
            />
          </label>
          <button className="btn" disabled={busy} type="submit">{copy.search}</button>
        </form>
        {searchResults.length > 0 && (
          <div className="multiplayer-list compact">
            {searchResults.map(player => (
              <div className="multiplayer-row" key={player.id}>
                <strong>{player.username}</strong>
                <button
                  className="btn tiny"
                  type="button"
                  disabled={busy}
                  onClick={() => void run(
                    () => api.sendFriendRequest(player.id),
                    copy.friendRequestSent(player.username),
                  )}
                >
                  {copy.add}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {overview?.incomingFriendRequests.length ? (
        <section className="multiplayer-card attention">
          <h3>{copy.friendRequests}</h3>
          <div className="multiplayer-list">
            {overview.incomingFriendRequests.map(request => (
              <div className="multiplayer-row" key={request.id}>
                <span><strong>{request.sender.username}</strong><small>{shortDate(request.createdAt, language)}</small></span>
                <span className="multiplayer-actions">
                  <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondFriendRequest(request.id, true),
                    copy.accepted,
                  )}>{copy.accept}</button>
                  <button className="btn ghost tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondFriendRequest(request.id, false),
                    copy.rejected,
                  )}>{copy.reject}</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {overview?.incomingAllianceInvitations.length ? (
        <section className="multiplayer-card alliance-card">
          <h3>{copy.allianceInvitations}</h3>
          <p className="hint">{copy.allianceHint}</p>
          <div className="multiplayer-list">
            {overview.incomingAllianceInvitations.map(invitation => (
              <div className="multiplayer-row" key={invitation.id}>
                <strong>{invitation.sender.username}</strong>
                <span className="multiplayer-actions">
                  <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondAllianceInvitation(invitation.id, true),
                    copy.allianceAccepted,
                  )}>{copy.accept}</button>
                  <button className="btn ghost tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondAllianceInvitation(invitation.id, false),
                    copy.allianceRejected,
                  )}>{copy.reject}</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="multiplayer-card">
        <h3>{copy.friends}</h3>
        {overview?.friends.length ? (
          <div className="multiplayer-list friend-list">
            {overview.friends.map(friend => {
              const expanded = expandedFriendId === friend.profile.id
              return (
                <article className={`friend-row${friend.alliance ? ' allied' : ''}`} key={friend.profile.id}>
                  <div className="friend-row-main">
                    <span>
                      <strong>{friend.profile.username}</strong>
                      <small>{friend.alliance ? copy.activeAlliance : copy.friend}</small>
                    </span>
                    <span className="multiplayer-actions">
                      <button className="btn tiny" type="button" disabled={busy} onClick={() => void openGym(friend)}>
                        {copy.viewGym}
                      </button>
                      <button
                        className="btn ghost tiny"
                        type="button"
                        onClick={() => setExpandedFriendId(expanded ? null : friend.profile.id)}
                      >
                        {expanded ? copy.less : copy.operations}
                      </button>
                    </span>
                  </div>

                  {expanded && (
                    <div className="friend-operations">
                      {friend.alliance ? (
                        <>
                          <div className="operation-block">
                            <h4>{copy.transferToAlly}</h4>
                            <div className="multiplayer-inline-form">
                              <select
                                aria-label={copy.transferAsset}
                                value={transferAsset}
                                onChange={event => setTransferAsset(event.target.value as TransferAsset)}
                              >
                                <option value="cash">{copy.cash}</option>
                                <option value="diamonds">{copy.diamonds}</option>
                              </select>
                              <input
                                aria-label={copy.transferAmount}
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={transferAmount}
                                onChange={event => setTransferAmount(event.target.value)}
                                placeholder={copy.amount}
                              />
                              <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                                () => idempotent(
                                  `transfer:${friend.profile.id}:${transferAsset}:${transferAmount}`,
                                  idempotencyKey => api.transfer({
                                    recipientId: friend.profile.id,
                                    asset: transferAsset,
                                    amount: wholeNumber(transferAmount),
                                    idempotencyKey,
                                  }),
                                ),
                                copy.transferComplete,
                              )}>{copy.send}</button>
                            </div>
                          </div>
                          <div className="operation-block">
                            <h4>{copy.interestFreeLoan}</h4>
                            <div className="multiplayer-inline-form">
                              <input
                                aria-label={copy.loanAmount}
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={loanAmount}
                                onChange={event => setLoanAmount(event.target.value)}
                                placeholder={copy.cash}
                              />
                              <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                                () => idempotent(
                                  `propose-loan:${friend.profile.id}:${loanAmount}`,
                                  idempotencyKey => api.proposeLoan({
                                    borrowerId: friend.profile.id,
                                    amount: wholeNumber(loanAmount),
                                    idempotencyKey,
                                  }),
                                ),
                                copy.loanProposed,
                              )}>{copy.propose}</button>
                            </div>
                          </div>
                          <button className="btn danger tiny" type="button" disabled={busy} onClick={() => void run(
                            () => api.endAlliance(friend.profile.id),
                            copy.allianceEnded,
                          )}>{copy.endAlliance}</button>
                        </>
                      ) : (
                        <>
                          <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                            () => api.sendAllianceInvitation(friend.profile.id),
                            copy.allianceInvitationSent,
                          )}>{copy.inviteToAlliance}</button>
                          <div className="sabotage-warning">
                            <strong>{copy.sabotage}</strong>
                            <span>{copy.sabotageHint(money(SABOTAGE_COST))}</span>
                            <button className="btn danger tiny" type="button" disabled={busy} onClick={() => confirmSabotage(friend)}>
                              {copy.sendLilD(money(SABOTAGE_COST))}
                            </button>
                          </div>
                        </>
                      )}
                      <button className="text-button" type="button" disabled={busy} onClick={() => void run(
                        () => api.removeFriend(friend.profile.id),
                        copy.friendRemoved,
                      )}>{copy.removeFriend}</button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="multiplayer-empty">{copy.noFriends}</p>
        )}
        {overview?.outgoingFriendRequests.length ? (
          <p className="hint pending-line">
            {copy.pending(overview.outgoingFriendRequests.map(item => item.recipient.username).join(', '))}
          </p>
        ) : null}
      </section>

      {overview?.loans.length ? (
        <section className="multiplayer-card">
          <h3>{copy.loans}</h3>
          <div className="multiplayer-list">
            {overview.loans.map(loan => {
              const isBorrower = loan.borrower.id === overview.me.id
              const remaining = loan.amount - loan.repaidAmount
              return (
                <div className="loan-row" key={loan.id}>
                  <div>
                    <strong>{money(loan.amount)}</strong>
                    <small>{loan.lender.username} → {loan.borrower.username}</small>
                    {loan.status === 'active' && <span>{copy.remaining(money(remaining))}</span>}
                  </div>
                  {loan.status === 'proposed' && isBorrower && (
                    <span className="multiplayer-actions">
                      <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                        () => idempotent(
                          `respond-loan:${loan.id}:accept`,
                          idempotencyKey => api.respondLoan({ loanId: loan.id, accept: true, idempotencyKey }),
                        ),
                        copy.loanAccepted,
                      )}>{copy.accept}</button>
                      <button className="btn ghost tiny" type="button" disabled={busy} onClick={() => void run(
                        () => idempotent(
                          `respond-loan:${loan.id}:reject`,
                          idempotencyKey => api.respondLoan({ loanId: loan.id, accept: false, idempotencyKey }),
                        ),
                        copy.loanRejected,
                      )}>{copy.reject}</button>
                    </span>
                  )}
                  {loan.status === 'active' && isBorrower && (
                    <div className="multiplayer-inline-form">
                      <input
                        aria-label={copy.repaymentAmount}
                        type="number"
                        min="1"
                        max={remaining}
                        step="1"
                        value={repayments[loan.id] ?? ''}
                        onChange={event => setRepayments(current => ({
                          ...current,
                          [loan.id]: event.target.value,
                        }))}
                        placeholder={copy.repaymentAmount}
                      />
                      <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                        () => idempotent(
                          `repay-loan:${loan.id}:${repayments[loan.id] ?? ''}`,
                          idempotencyKey => api.repayLoan({
                            loanId: loan.id,
                            amount: wholeNumber(repayments[loan.id] ?? ''),
                            idempotencyKey,
                          }),
                        ),
                        copy.repaymentRecorded,
                      )}>{copy.repay}</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {busy && !overview && <p className="multiplayer-empty">{copy.loading}</p>}
    </section>
  )
}
