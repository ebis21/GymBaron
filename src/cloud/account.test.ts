import { describe, expect, it } from 'vitest'
import { AccountService } from './account'
import type { AccountSession, AuthService, SignUpResult } from './auth'
import type { CloudSaveEvent } from './cloudSave'
import { MemoryLocalStore, MemorySaveRepository } from './memorySaveRepository'
import { CloudError } from './types'

function save(fields: { cash: number; lastSeenAt: number }): string {
  return JSON.stringify({ version: 7, ...fields })
}

/**
 * Stands in for Supabase Auth, including the part that trips people up: a
 * successful `signIn` also fires the auth-state listener, so the service hears
 * about the same sign-in twice.
 */
class FakeAuth implements AuthService {
  offline = false
  attempts = 0
  private accounts = new Map<string, { password: string; userId: string }>()
  private currentSession: AccountSession | null = null
  private listeners = new Set<(session: AccountSession | null) => void>()

  constructor(private restored: AccountSession | null = null) {}

  register(email: string, password: string, userId: string): void {
    this.accounts.set(email, { password, userId })
  }

  session(): AccountSession | null {
    return this.currentSession
  }

  async restore(): Promise<AccountSession | null> {
    if (this.offline) throw new CloudError('offline', 'Brak połączenia z serwerem.')
    this.currentSession = this.restored
    if (this.currentSession) this.notify()
    return this.currentSession
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    if (this.offline) throw new CloudError('offline', 'Brak połączenia z serwerem.')
    if (this.accounts.has(email)) {
      throw new CloudError('auth', 'Konto z tym adresem e-mail już istnieje. Zaloguj się.')
    }
    const userId = `user-${this.accounts.size + 1}`
    this.accounts.set(email, { password, userId })
    this.currentSession = { userId, email, displayName: null }
    this.notify()
    return { session: this.currentSession, needsConfirmation: false }
  }

  async signIn(email: string, password: string): Promise<AccountSession> {
    this.attempts += 1
    if (this.offline) throw new CloudError('offline', 'Brak połączenia z serwerem.')
    const account = this.accounts.get(email)
    if (!account || account.password !== password) {
      throw new CloudError('auth', 'Nieprawidłowy e-mail lub hasło.')
    }
    this.currentSession = { userId: account.userId, email, displayName: null }
    // Supabase notifies its listeners before signInWithPassword resolves.
    this.notify()
    return this.currentSession
  }

  async signOut(): Promise<void> {
    this.currentSession = null
    this.notify()
  }

  subscribe(listener: (session: AccountSession | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener(this.currentSession)
  }
}

interface Harness {
  service: AccountService
  auth: FakeAuth
  repo: MemorySaveRepository
  local: MemoryLocalStore
  events: CloudSaveEvent[]
}

function harness(options: { localRaw?: string | null; restored?: AccountSession | null } = {}): Harness {
  const auth = new FakeAuth(options.restored ?? null)
  const repo = new MemorySaveRepository()
  const local = new MemoryLocalStore(options.localRaw ?? null)
  const service = new AccountService({
    auth,
    repository: repo,
    local,
    saveVersion: 7,
    pollIntervalMs: 0,
  })

  const events: CloudSaveEvent[] = []
  service.onCloudEvent(event => events.push(event))
  return { service, auth, repo, local, events }
}

describe('signing in', () => {
  it('starts local-only when nobody is signed in', async () => {
    const h = harness({ localRaw: save({ cash: 100, lastSeenAt: 10 }) })
    await h.service.start()

    const state = h.service.state()
    expect(state.configured).toBe(true)
    expect(state.session).toBeNull()
    expect(state.sync.status).toBe('local')
  })

  it('sends the local gym up the first time a player signs in', async () => {
    const h = harness({ localRaw: save({ cash: 100, lastSeenAt: 10 }) })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    await h.service.start()

    const ok = await h.service.signIn('gracz@example.com', 'sekret123')

    expect(ok).toBe(true)
    expect(h.service.state().notice).toBe('Twój postęp został wysłany do chmury.')
    expect((await h.repo.fetch('user-1'))?.state).toMatchObject({ cash: 100 })
  })

  it('reconciles once even though the auth listener fires too', async () => {
    const h = harness({ localRaw: save({ cash: 100, lastSeenAt: 10 }) })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    await h.service.start()

    await h.service.signIn('gracz@example.com', 'sekret123')

    // Two reconciliations would mean two writes for one sign-in.
    expect(h.repo.calls.create).toBe(1)
    expect(h.repo.calls.update).toBe(0)
  })

  it('brings the gym down onto a second device', async () => {
    const h = harness({ localRaw: null })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    h.repo.seed('user-1', { version: 7, cash: 4200, lastSeenAt: 500 })
    await h.service.start()

    await h.service.signIn('gracz@example.com', 'sekret123')

    expect(h.service.state().notice).toBe('Wczytano postęp zapisany w chmurze.')
    expect(JSON.parse(h.local.peek() ?? 'null')).toMatchObject({ cash: 4200 })
    expect(h.events.filter(event => event.type === 'adopt')).toHaveLength(1)
  })

  it('picks a stored session back up on the next app start', async () => {
    const restored = { userId: 'user-1', email: 'gracz@example.com', displayName: null }
    const h = harness({ localRaw: null, restored })
    h.repo.seed('user-1', { version: 7, cash: 77, lastSeenAt: 5 })

    await h.service.start()

    expect(h.service.state().session).toEqual(restored)
    expect(h.service.state().sync.status).toBe('synced')
    expect(JSON.parse(h.local.peek() ?? 'null')).toMatchObject({ cash: 77 })
  })

  it('only ever starts once', async () => {
    const h = harness({ localRaw: null, restored: { userId: 'user-1', email: null, displayName: null } })
    h.repo.seed('user-1', { version: 7, cash: 1, lastSeenAt: 1 })

    await Promise.all([h.service.start(), h.service.start()])
    await h.service.start()

    expect(h.repo.calls.fetch).toBe(1)
  })
})

describe('reporting failures to the player', () => {
  it('explains a wrong password in Polish and stays local', async () => {
    const raw = save({ cash: 100, lastSeenAt: 10 })
    const h = harness({ localRaw: raw })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    await h.service.start()

    const ok = await h.service.signIn('gracz@example.com', 'zle-haslo')

    expect(ok).toBe(false)
    expect(h.service.state().error).toBe('Nieprawidłowy e-mail lub hasło.')
    expect(h.service.state().session).toBeNull()
    expect(h.service.state().sync.status).toBe('local')
    expect(h.local.peek()).toBe(raw)
  })

  it('keeps the gym playable when the server is unreachable', async () => {
    const raw = save({ cash: 100, lastSeenAt: 10 })
    const h = harness({ localRaw: raw })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    h.auth.offline = true
    await h.service.start()

    const ok = await h.service.signIn('gracz@example.com', 'sekret123')

    expect(ok).toBe(false)
    expect(h.service.state().error).toMatch(/Brak połączenia/)
    expect(h.local.peek()).toBe(raw)
  })

  it('lets a failed reconciliation be retried', async () => {
    const h = harness({ localRaw: save({ cash: 100, lastSeenAt: 10 }) })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    await h.service.start()

    h.repo.offline = true
    await h.service.signIn('gracz@example.com', 'sekret123')
    expect(h.service.state().sync.status).toBe('offline')

    h.repo.offline = false
    await h.service.signIn('gracz@example.com', 'sekret123')

    expect(h.service.state().sync.status).toBe('synced')
    expect((await h.repo.fetch('user-1'))?.state).toMatchObject({ cash: 100 })
  })

  it('refuses account actions when the build has no Supabase', async () => {
    const service = new AccountService({
      auth: null,
      repository: null,
      local: new MemoryLocalStore(save({ cash: 1, lastSeenAt: 1 })),
      saveVersion: 7,
      pollIntervalMs: 0,
    })
    await service.start()

    expect(service.state().configured).toBe(false)
    expect(service.state().sync.status).toBe('disabled')
    expect(await service.signIn('a@b.pl', 'sekret123')).toBe(false)
    expect(service.state().error).toMatch(/zapisuje się lokalnie/)
  })
})

describe('signing out', () => {
  it('sends what is still queued before dropping the session', async () => {
    const h = harness({ localRaw: save({ cash: 100, lastSeenAt: 10 }) })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    await h.service.start()
    await h.service.signIn('gracz@example.com', 'sekret123')

    // Inside the throttle window, so this is only queued.
    await h.service.cloud.push(save({ cash: 999, lastSeenAt: 900 }))
    expect(h.service.state().sync.pending).toBe(true)

    await h.service.signOut()

    expect((await h.repo.fetch('user-1'))?.state).toMatchObject({ cash: 999 })
    expect(h.service.state().session).toBeNull()
    expect(h.service.state().sync.status).toBe('local')
  })

  it('leaves the device save in place so the player can keep going', async () => {
    const h = harness({ localRaw: save({ cash: 100, lastSeenAt: 10 }) })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    await h.service.start()
    await h.service.signIn('gracz@example.com', 'sekret123')

    await h.service.signOut()

    expect(JSON.parse(h.local.peek() ?? 'null')).toMatchObject({ cash: 100 })
    expect(h.service.state().notice).toMatch(/tylko na tym urządzeniu/)
  })

  it('can sign back in and reconcile again', async () => {
    const h = harness({ localRaw: save({ cash: 100, lastSeenAt: 10 }) })
    h.auth.register('gracz@example.com', 'sekret123', 'user-1')
    await h.service.start()
    await h.service.signIn('gracz@example.com', 'sekret123')
    await h.service.signOut()

    const ok = await h.service.signIn('gracz@example.com', 'sekret123')

    expect(ok).toBe(true)
    expect(h.service.state().sync.status).toBe('synced')
  })
})

describe('registration', () => {
  it('uploads the gym a new player already built before registering', async () => {
    const h = harness({ localRaw: save({ cash: 250, lastSeenAt: 42 }) })
    await h.service.start()

    const ok = await h.service.signUp('nowy@example.com', 'sekret123')

    expect(ok).toBe(true)
    expect(h.service.state().session?.email).toBe('nowy@example.com')
    expect((await h.repo.fetch('user-1'))?.state).toMatchObject({ cash: 250 })
  })

  it('says so when the address is already taken', async () => {
    const h = harness({ localRaw: null })
    h.auth.register('zajety@example.com', 'sekret123', 'user-9')
    await h.service.start()

    expect(await h.service.signUp('zajety@example.com', 'inne-haslo')).toBe(false)
    expect(h.service.state().error).toMatch(/już istnieje/)
  })
})
