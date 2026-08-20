import { beforeEach, describe, expect, it } from 'vitest'
import { CloudSaveService, type CloudSaveEvent } from './cloudSave'
import { MemoryLocalStore, MemorySaveRepository } from './memorySaveRepository'

const USER = 'user-1'
const THROTTLE_MS = 20_000

/** A save the way the engine writes one: JSON with a `lastSeenAt` stamp. */
function save(fields: { cash: number; lastSeenAt: number }): string {
  return JSON.stringify({ version: 7, ...fields })
}

interface Harness {
  service: CloudSaveService
  repo: MemorySaveRepository
  local: MemoryLocalStore
  events: CloudSaveEvent[]
  /** Moves the injected clock and runs anything the throttle scheduled. */
  advance: (ms: number) => Promise<void>
}

function harness(localRaw: string | null = null): Harness {
  const repo = new MemorySaveRepository()
  const local = new MemoryLocalStore(localRaw)
  let clock = 1_000_000
  const timers = new Map<number, { at: number; fn: () => void }>()
  let nextHandle = 1

  const service = new CloudSaveService({
    repository: repo,
    local,
    saveVersion: 7,
    now: () => clock,
    minPushIntervalMs: THROTTLE_MS,
    schedule: (fn, ms) => {
      const handle = nextHandle++
      timers.set(handle, { at: clock + ms, fn })
      return handle
    },
    cancel: handle => {
      timers.delete(handle as number)
    },
  })

  const events: CloudSaveEvent[] = []
  service.subscribe(event => events.push(event))

  const advance = async (ms: number) => {
    clock += ms
    for (const [handle, timer] of [...timers]) {
      if (timer.at <= clock) {
        timers.delete(handle)
        timer.fn()
      }
    }
    // Let whatever the timer kicked off settle.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  return { service, repo, local, events, advance }
}

function adoptions(events: CloudSaveEvent[]) {
  return events.filter(event => event.type === 'adopt')
}

describe('first sign-in reconciliation', () => {
  it('uploads the local gym when the account has no save', async () => {
    const { service, repo, local } = harness(save({ cash: 500, lastSeenAt: 10 }))

    const result = await service.attach(USER)

    expect(result.outcome).toBe('uploaded')
    expect(result.revision).toBe(1)
    expect((await repo.fetch(USER))?.state).toMatchObject({ cash: 500 })
    // Uploading must not disturb what is on the device.
    expect(local.peek()).toBe(save({ cash: 500, lastSeenAt: 10 }))
  })

  it('downloads the cloud save onto a device that has none', async () => {
    const { service, repo, local, events } = harness(null)
    repo.seed(USER, { version: 7, cash: 900, lastSeenAt: 50 })

    const result = await service.attach(USER)

    expect(result.outcome).toBe('downloaded')
    expect(JSON.parse(local.peek() ?? 'null')).toMatchObject({ cash: 900 })
    expect(adoptions(events)).toMatchObject([{ reason: 'first-login', revision: 1 }])
  })

  it('does not immediately re-upload what reconciliation just sent', async () => {
    const h = harness(save({ cash: 500, lastSeenAt: 10 }))
    await h.service.attach(USER)
    const writesAfterAttach = h.repo.calls.create + h.repo.calls.update

    const result = await h.service.push(save({ cash: 505, lastSeenAt: 11 }))

    expect(result.outcome).toBe('queued')
    expect(h.repo.calls.create + h.repo.calls.update).toBe(writesAfterAttach)
  })

  it('reports an empty account with an empty device as empty', async () => {
    const { service } = harness(null)
    expect((await service.attach(USER)).outcome).toBe('empty')
  })

  it('keeps the more recently played save when both sides have one', async () => {
    const { service, repo } = harness(save({ cash: 500, lastSeenAt: 999 }))
    repo.seed(USER, { version: 7, cash: 100, lastSeenAt: 10 })

    const result = await service.attach(USER)

    expect(result.outcome).toBe('uploaded')
    expect((await repo.fetch(USER))?.state).toMatchObject({ cash: 500 })
    // The cloud row was replaced, not duplicated: revision moved 1 → 2.
    expect(result.revision).toBe(2)
  })

  it('takes the cloud save when it is the more recent one', async () => {
    const { service, repo, local, events } = harness(save({ cash: 500, lastSeenAt: 10 }))
    repo.seed(USER, { version: 7, cash: 100, lastSeenAt: 999 })

    const result = await service.attach(USER)

    expect(result.outcome).toBe('downloaded')
    expect(JSON.parse(local.peek() ?? 'null')).toMatchObject({ cash: 100 })
    expect(adoptions(events)).toHaveLength(1)
  })

  it('leaves the local save alone when the network is down', async () => {
    // Reconciliation must never be the thing that costs a player their gym.
    const raw = save({ cash: 500, lastSeenAt: 10 })
    const offline = harness(raw)
    offline.repo.offline = true

    const result = await offline.service.attach(USER)

    expect(result.outcome).toBe('failed')
    expect(result.message).toMatch(/Brak połączenia/)
    expect(offline.service.snapshot().status).toBe('offline')
    expect(offline.local.peek()).toBe(raw)
  })
})

describe('pushing saves', () => {
  let h: Harness

  beforeEach(async () => {
    h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    // Reconciliation just uploaded, which opens a throttle window of its own.
    // These cases are about pushes, so start them with the window clear.
    await h.advance(THROTTLE_MS)
  })

  it('does nothing without a session', async () => {
    const anonymous = harness(save({ cash: 1, lastSeenAt: 1 }))
    const result = await anonymous.service.push(save({ cash: 2, lastSeenAt: 2 }))

    expect(result.outcome).toBe('local-only')
    expect(anonymous.repo.calls.create).toBe(0)
  })

  it('sends the first push immediately', async () => {
    const result = await h.service.push(save({ cash: 200, lastSeenAt: 20 }))

    expect(result.outcome).toBe('saved')
    expect((await h.repo.fetch(USER))?.state).toMatchObject({ cash: 200 })
  })

  it('queues further pushes inside the throttle window', async () => {
    await h.service.push(save({ cash: 200, lastSeenAt: 20 }))
    const queued = await h.service.push(save({ cash: 300, lastSeenAt: 30 }))

    expect(queued.outcome).toBe('queued')
    expect(h.service.snapshot().pending).toBe(true)
    // Nothing left the device yet.
    expect((await h.repo.fetch(USER))?.state).toMatchObject({ cash: 200 })
  })

  it('sends only the newest queued save when the window closes', async () => {
    await h.service.push(save({ cash: 200, lastSeenAt: 20 }))
    const updatesBefore = h.repo.calls.update

    await h.service.push(save({ cash: 300, lastSeenAt: 30 }))
    await h.service.push(save({ cash: 400, lastSeenAt: 40 }))
    await h.advance(THROTTLE_MS)

    expect(h.repo.calls.update - updatesBefore).toBe(1)
    expect((await h.repo.fetch(USER))?.state).toMatchObject({ cash: 400 })
    expect(h.service.snapshot().pending).toBe(false)
  })

  it('flushes on demand, ignoring the throttle', async () => {
    await h.service.push(save({ cash: 200, lastSeenAt: 20 }))
    await h.service.push(save({ cash: 300, lastSeenAt: 30 }))

    const result = await h.service.flush()

    expect(result.outcome).toBe('saved')
    expect((await h.repo.fetch(USER))?.state).toMatchObject({ cash: 300 })
  })

  it('reports nothing to do when the queue is empty', async () => {
    await h.service.flush()
    expect((await h.service.flush()).outcome).toBe('idle')
  })
})

describe('version conflicts', () => {
  it('never lets a stale device overwrite a newer save', async () => {
    const repo = new MemorySaveRepository()
    const oldDevice = new CloudSaveService({
      repository: repo,
      local: new MemoryLocalStore(save({ cash: 100, lastSeenAt: 10 })),
      saveVersion: 7,
      minPushIntervalMs: 0,
    })
    const newDevice = new CloudSaveService({
      repository: repo,
      local: new MemoryLocalStore(null),
      saveVersion: 7,
      minPushIntervalMs: 0,
    })

    await oldDevice.attach(USER)
    await newDevice.attach(USER)

    // The second device plays on and saves; the first is still holding the
    // revision it read at sign-in.
    await newDevice.push(save({ cash: 5000, lastSeenAt: 900 }))
    const stale = await oldDevice.push(save({ cash: 120, lastSeenAt: 20 }))

    expect(stale.outcome).toBe('conflict')
    expect((await repo.fetch(USER))?.state).toMatchObject({ cash: 5000 })
  })

  it('adopts the newer save instead of forcing its own', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    await h.advance(THROTTLE_MS)
    h.events.length = 0

    // Stands in for a server-side RPC crediting a purchase.
    h.repo.mutateExternally(USER, state => ({ ...(state as object), cash: 9999 }))

    const result = await h.service.push(save({ cash: 150, lastSeenAt: 20 }))

    expect(result.outcome).toBe('conflict')
    expect(adoptions(h.events)).toMatchObject([{ reason: 'conflict' }])
    expect(JSON.parse(h.local.peek() ?? 'null')).toMatchObject({ cash: 9999 })
    expect(h.service.snapshot().revision).toBe(2)
  })

  it('can save again once it has adopted the newer revision', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    await h.advance(THROTTLE_MS)
    h.repo.mutateExternally(USER, state => ({ ...(state as object), cash: 9999 }))
    await h.service.push(save({ cash: 150, lastSeenAt: 20 }))

    await h.advance(THROTTLE_MS)
    const result = await h.service.push(save({ cash: 10_000, lastSeenAt: 30 }))

    expect(result.outcome).toBe('saved')
    expect((await h.repo.fetch(USER))?.state).toMatchObject({ cash: 10_000 })
  })
})

describe('watching for cloud-side changes', () => {
  it('costs one stamp read and no download when nothing moved', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    const fetchesBefore = h.repo.calls.fetch

    expect(await h.service.poll()).toBeNull()
    expect(h.repo.calls.stamp).toBe(1)
    expect(h.repo.calls.fetch).toBe(fetchesBefore)
  })

  it('pulls a save that another writer moved on', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    h.events.length = 0

    h.repo.mutateExternally(USER, state => ({ ...(state as object), diamonds: 12 }))
    const result = await h.service.poll()

    expect(result?.revision).toBe(2)
    expect(adoptions(h.events)).toMatchObject([{ reason: 'remote-changed', revision: 2 }])
    expect(JSON.parse(h.local.peek() ?? 'null')).toMatchObject({ diamonds: 12 })
  })

  it('does nothing when nobody is signed in', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    expect(await h.service.poll()).toBeNull()
    expect(h.repo.calls.stamp).toBe(0)
  })
})

describe('surviving a bad network', () => {
  it('keeps the queued save and reports the failure honestly', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    await h.advance(THROTTLE_MS)

    h.repo.offline = true
    const result = await h.service.push(save({ cash: 200, lastSeenAt: 20 }))

    expect(result.outcome).toBe('offline')
    expect(result.message).toMatch(/Brak połączenia/)
    expect(h.service.snapshot().status).toBe('offline')
    // The save is still owed to the cloud, not silently dropped.
    expect(h.service.snapshot().pending).toBe(true)
  })

  it('delivers the queued save once the network returns', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    await h.advance(THROTTLE_MS)

    h.repo.offline = true
    await h.service.push(save({ cash: 200, lastSeenAt: 20 }))
    await h.service.push(save({ cash: 300, lastSeenAt: 30 }))

    h.repo.offline = false
    const result = await h.service.flush()

    expect(result.outcome).toBe('saved')
    expect((await h.repo.fetch(USER))?.state).toMatchObject({ cash: 300 })
    expect(h.service.snapshot().status).toBe('synced')
  })

  it('reports offline rather than a false success', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)
    await h.advance(THROTTLE_MS)
    h.repo.offline = true

    const result = await h.service.push(save({ cash: 200, lastSeenAt: 20 }))

    expect(result.outcome).not.toBe('saved')
    expect(h.service.snapshot().status).not.toBe('synced')
  })

  it('rides out a failed poll without losing the session', async () => {
    const h = harness(save({ cash: 100, lastSeenAt: 10 }))
    await h.service.attach(USER)

    h.repo.offline = true
    expect(await h.service.poll()).toBeNull()
    expect(h.service.snapshot().status).toBe('offline')
    expect(h.service.snapshot().userId).toBe(USER)

    h.repo.offline = false
    expect(await h.service.poll()).toBeNull()
    expect(h.service.snapshot().status).toBe('synced')
  })

  it('goes back to local-only on sign-out without touching the device save', async () => {
    const raw = save({ cash: 100, lastSeenAt: 10 })
    const h = harness(raw)
    await h.service.attach(USER)

    h.service.detach()

    expect(h.service.snapshot().status).toBe('local')
    expect(h.service.snapshot().userId).toBeNull()
    expect(h.local.peek()).toBe(raw)
    expect((await h.service.push(save({ cash: 1, lastSeenAt: 1 }))).outcome).toBe('local-only')
  })
})
