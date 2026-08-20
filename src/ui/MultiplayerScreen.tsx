import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  SABOTAGE_COST,
  multiplayerErrorMessage,
  newIdempotencyKey,
  type FriendGymSnapshot,
  type FriendSummary,
  type MultiplayerApi,
  type MultiplayerOverview,
  type PlayerSummary,
  type TransferAsset,
} from '../multiplayer'
import { money } from './format'
import FriendGymView from './FriendGymView'
import './multiplayer.css'

interface Props {
  api: MultiplayerApi
  onClose?: () => void
}

const wholeNumber = (value: string): number => Number(value)
const shortDate = (value: string): string => new Date(value).toLocaleDateString('pl-PL')

export default function MultiplayerScreen({ api, onClose }: Props) {
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

  const reload = useCallback(async () => {
    setOverview(await api.getOverview())
  }, [api])

  useEffect(() => {
    let active = true
    setBusy(true)
    api.getOverview()
      .then(value => { if (active) setOverview(value) })
      .catch(reason => { if (active) setError(multiplayerErrorMessage(reason)) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [api])

  const run = useCallback(async (action: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
      await reload()
      setMessage(success)
    } catch (reason) {
      setError(multiplayerErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }, [reload])

  const search = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setSearchResults(await api.searchPlayers(query))
    } catch (reason) {
      setError(multiplayerErrorMessage(reason))
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
      setError(multiplayerErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const confirmSabotage = (friend: FriendSummary) => {
    const confirmed = window.confirm(
      `Wysłać LIL D. do gracza ${friend.profile.username}? Koszt: ${money(SABOTAGE_COST)}.`,
    )
    if (!confirmed) return
    void run(
      () => api.sabotage({
        targetId: friend.profile.id,
        idempotencyKey: newIdempotencyKey(),
      }),
      'LIL D. ruszył w drogę. Zdarzenie zaczeka, jeśli gracz jest offline.',
    )
  }

  if (gym) return <FriendGymView snapshot={gym} onBack={() => setGym(null)} />

  return (
    <section className="multiplayer-screen" aria-label="Multiplayer">
      <header className="multiplayer-heading">
        <div>
          <p className="multiplayer-eyebrow">Gymbaron Social</p>
          <h2 className="section-title">Znajomi i sojusze</h2>
          {overview && <p className="hint">Zalogowano jako {overview.me.username}</p>}
        </div>
        {onClose && <button className="btn ghost tiny" type="button" onClick={onClose}>Zamknij</button>}
      </header>

      {(message || error) && (
        <p className={`multiplayer-notice ${error ? 'error' : 'success'}`} role="status">
          {error ?? message}
        </p>
      )}

      <section className="multiplayer-card">
        <h3>Znajdź gracza</h3>
        <form className="multiplayer-inline-form" onSubmit={search}>
          <label className="multiplayer-field grow">
            <span>Unikalna nazwa</span>
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Wpisz co najmniej 2 znaki"
              maxLength={24}
            />
          </label>
          <button className="btn" disabled={busy} type="submit">Szukaj</button>
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
                    `Zaproszenie do ${player.username} zostało wysłane.`,
                  )}
                >
                  Dodaj
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {overview?.incomingFriendRequests.length ? (
        <section className="multiplayer-card attention">
          <h3>Zaproszenia do znajomych</h3>
          <div className="multiplayer-list">
            {overview.incomingFriendRequests.map(request => (
              <div className="multiplayer-row" key={request.id}>
                <span><strong>{request.sender.username}</strong><small>{shortDate(request.createdAt)}</small></span>
                <span className="multiplayer-actions">
                  <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondFriendRequest(request.id, true),
                    'Zaproszenie zostało zaakceptowane.',
                  )}>Akceptuj</button>
                  <button className="btn ghost tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondFriendRequest(request.id, false),
                    'Zaproszenie zostało odrzucone.',
                  )}>Odrzuć</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {overview?.incomingAllianceInvitations.length ? (
        <section className="multiplayer-card alliance-card">
          <h3>Zaproszenia do sojuszu</h3>
          <p className="hint">Aktywny sojusz daje ×1,5 do normalnych przychodów z gry.</p>
          <div className="multiplayer-list">
            {overview.incomingAllianceInvitations.map(invitation => (
              <div className="multiplayer-row" key={invitation.id}>
                <strong>{invitation.sender.username}</strong>
                <span className="multiplayer-actions">
                  <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondAllianceInvitation(invitation.id, true),
                    'Sojusz jest aktywny. Normalne przychody mają mnożnik ×1,5.',
                  )}>Akceptuj</button>
                  <button className="btn ghost tiny" type="button" disabled={busy} onClick={() => void run(
                    () => api.respondAllianceInvitation(invitation.id, false),
                    'Zaproszenie do sojuszu zostało odrzucone.',
                  )}>Odrzuć</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="multiplayer-card">
        <h3>Znajomi</h3>
        {overview?.friends.length ? (
          <div className="multiplayer-list friend-list">
            {overview.friends.map(friend => {
              const expanded = expandedFriendId === friend.profile.id
              return (
                <article className={`friend-row${friend.alliance ? ' allied' : ''}`} key={friend.profile.id}>
                  <div className="friend-row-main">
                    <span>
                      <strong>{friend.profile.username}</strong>
                      <small>{friend.alliance ? 'Aktywny sojusz · przychody ×1,5' : 'Znajomy'}</small>
                    </span>
                    <span className="multiplayer-actions">
                      <button className="btn tiny" type="button" disabled={busy} onClick={() => void openGym(friend)}>
                        Obejrzyj bazę
                      </button>
                      <button
                        className="btn ghost tiny"
                        type="button"
                        onClick={() => setExpandedFriendId(expanded ? null : friend.profile.id)}
                      >
                        {expanded ? 'Mniej' : 'Operacje'}
                      </button>
                    </span>
                  </div>

                  {expanded && (
                    <div className="friend-operations">
                      {friend.alliance ? (
                        <>
                          <div className="operation-block">
                            <h4>Przelew do sojusznika</h4>
                            <div className="multiplayer-inline-form">
                              <select
                                aria-label="Rodzaj przelewu"
                                value={transferAsset}
                                onChange={event => setTransferAsset(event.target.value as TransferAsset)}
                              >
                                <option value="cash">Kredyty</option>
                                <option value="diamonds">Diamenty</option>
                              </select>
                              <input
                                aria-label="Kwota przelewu"
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={transferAmount}
                                onChange={event => setTransferAmount(event.target.value)}
                                placeholder="Kwota"
                              />
                              <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                                () => api.transfer({
                                  recipientId: friend.profile.id,
                                  asset: transferAsset,
                                  amount: wholeNumber(transferAmount),
                                  idempotencyKey: newIdempotencyKey(),
                                }),
                                'Przelew został wykonany.',
                              )}>Wyślij</button>
                            </div>
                          </div>
                          <div className="operation-block">
                            <h4>Pożyczka bez odsetek</h4>
                            <div className="multiplayer-inline-form">
                              <input
                                aria-label="Kwota pożyczki"
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={loanAmount}
                                onChange={event => setLoanAmount(event.target.value)}
                                placeholder="Kredyty"
                              />
                              <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                                () => api.proposeLoan({
                                  borrowerId: friend.profile.id,
                                  amount: wholeNumber(loanAmount),
                                  idempotencyKey: newIdempotencyKey(),
                                }),
                                'Propozycja pożyczki została wysłana.',
                              )}>Zaproponuj</button>
                            </div>
                          </div>
                          <button className="btn danger tiny" type="button" disabled={busy} onClick={() => void run(
                            () => api.endAlliance(friend.profile.id),
                            'Sojusz został zakończony.',
                          )}>Zerwij sojusz</button>
                        </>
                      ) : (
                        <>
                          <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                            () => api.sendAllianceInvitation(friend.profile.id),
                            'Zaproszenie do sojuszu zostało wysłane.',
                          )}>Zaproś do sojuszu</button>
                          <div className="sabotage-warning">
                            <strong>Sabotaż LIL D.</strong>
                            <span>Koszt {money(SABOTAGE_COST)} · maks. jeden skuteczny atak na cel na dzień gry.</span>
                            <button className="btn danger tiny" type="button" disabled={busy} onClick={() => confirmSabotage(friend)}>
                              Wyślij LIL D. za {money(SABOTAGE_COST)}
                            </button>
                          </div>
                        </>
                      )}
                      <button className="text-button" type="button" disabled={busy} onClick={() => void run(
                        () => api.removeFriend(friend.profile.id),
                        'Gracz został usunięty ze znajomych.',
                      )}>Usuń ze znajomych</button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="multiplayer-empty">Nie masz jeszcze znajomych. Wyszukaj gracza po nazwie.</p>
        )}
        {overview?.outgoingFriendRequests.length ? (
          <p className="hint pending-line">
            Oczekujące: {overview.outgoingFriendRequests.map(item => item.recipient.username).join(', ')}
          </p>
        ) : null}
      </section>

      {overview?.loans.length ? (
        <section className="multiplayer-card">
          <h3>Pożyczki</h3>
          <div className="multiplayer-list">
            {overview.loans.map(loan => {
              const isBorrower = loan.borrower.id === overview.me.id
              const remaining = loan.amount - loan.repaidAmount
              return (
                <div className="loan-row" key={loan.id}>
                  <div>
                    <strong>{money(loan.amount)}</strong>
                    <small>{loan.lender.username} → {loan.borrower.username}</small>
                    {loan.status === 'active' && <span>Pozostało: {money(remaining)}</span>}
                  </div>
                  {loan.status === 'proposed' && isBorrower && (
                    <span className="multiplayer-actions">
                      <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                        () => api.respondLoan({ loanId: loan.id, accept: true, idempotencyKey: newIdempotencyKey() }),
                        'Pożyczka została zaakceptowana i wypłacona.',
                      )}>Akceptuj</button>
                      <button className="btn ghost tiny" type="button" disabled={busy} onClick={() => void run(
                        () => api.respondLoan({ loanId: loan.id, accept: false, idempotencyKey: newIdempotencyKey() }),
                        'Pożyczka została odrzucona.',
                      )}>Odrzuć</button>
                    </span>
                  )}
                  {loan.status === 'active' && isBorrower && (
                    <div className="multiplayer-inline-form">
                      <input
                        aria-label="Kwota spłaty"
                        type="number"
                        min="1"
                        max={remaining}
                        step="1"
                        value={repayments[loan.id] ?? ''}
                        onChange={event => setRepayments(current => ({
                          ...current,
                          [loan.id]: event.target.value,
                        }))}
                        placeholder="Kwota spłaty"
                      />
                      <button className="btn tiny" type="button" disabled={busy} onClick={() => void run(
                        () => api.repayLoan({
                          loanId: loan.id,
                          amount: wholeNumber(repayments[loan.id] ?? ''),
                          idempotencyKey: newIdempotencyKey(),
                        }),
                        'Spłata została zaksięgowana.',
                      )}>Spłać</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {busy && !overview && <p className="multiplayer-empty">Ładowanie multiplayera…</p>}
    </section>
  )
}
