import { describe, expect, it } from 'vitest'
import { MemorySaveRepository } from './memorySaveRepository'
import { CloudError } from './types'

/**
 * The fake stands in for `public.game_saves` everywhere else in this suite, so
 * it has to reproduce the two guarantees the real table gives: the trigger
 * that bumps `revision` on every write, and the compare-and-swap that refuses
 * a write aimed at a revision that has moved on.
 */
describe('save repository contract', () => {
  const user = 'user-1'

  it('reports no save for a fresh account', async () => {
    const repo = new MemorySaveRepository()
    expect(await repo.fetch(user)).toBeNull()
    expect(await repo.stamp(user)).toBeNull()
  })

  it('creates the first save at revision 1', async () => {
    const repo = new MemorySaveRepository()
    const created = await repo.create(user, { cash: 500 }, 7)

    expect(created.revision).toBe(1)
    expect(created.saveVersion).toBe(7)
    expect(created.state).toEqual({ cash: 500 })
  })

  it('refuses a second create for the same account', async () => {
    const repo = new MemorySaveRepository()
    await repo.create(user, { cash: 1 }, 7)

    await expect(repo.create(user, { cash: 2 }, 7)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('bumps the revision on every accepted update', async () => {
    const repo = new MemorySaveRepository()
    await repo.create(user, { cash: 1 }, 7)

    const second = await repo.update(user, { cash: 2 }, 7, 1)
    const third = await repo.update(user, { cash: 3 }, 7, second.revision)

    expect(second.revision).toBe(2)
    expect(third.revision).toBe(3)
  })

  it('rejects a write aimed at a stale revision', async () => {
    const repo = new MemorySaveRepository()
    await repo.create(user, { cash: 1 }, 7)
    await repo.update(user, { cash: 2 }, 7, 1)

    await expect(repo.update(user, { cash: 99 }, 7, 1)).rejects.toBeInstanceOf(CloudError)
    // The stale write left no trace.
    expect((await repo.fetch(user))?.state).toEqual({ cash: 2 })
  })

  it('keeps accounts apart', async () => {
    const repo = new MemorySaveRepository()
    await repo.create('a', { cash: 1 }, 7)
    await repo.create('b', { cash: 2 }, 7)

    expect((await repo.fetch('a'))?.state).toEqual({ cash: 1 })
    expect((await repo.fetch('b'))?.state).toEqual({ cash: 2 })
  })

  it('reads back a stamp without the state payload', async () => {
    const repo = new MemorySaveRepository()
    await repo.create(user, { cash: 1 }, 7)

    const stamp = await repo.stamp(user)
    expect(stamp?.revision).toBe(1)
    expect(stamp).not.toHaveProperty('state')
  })

  it('fails every call while offline', async () => {
    const repo = new MemorySaveRepository()
    await repo.create(user, { cash: 1 }, 7)
    repo.offline = true

    await expect(repo.fetch(user)).rejects.toMatchObject({ code: 'offline' })
    await expect(repo.stamp(user)).rejects.toMatchObject({ code: 'offline' })
    await expect(repo.update(user, { cash: 2 }, 7, 1)).rejects.toMatchObject({ code: 'offline' })
  })

  it('hands out copies, so a caller cannot mutate the stored row', async () => {
    const repo = new MemorySaveRepository()
    await repo.create(user, { cash: 1 }, 7)

    const first = await repo.fetch(user)
    ;(first?.state as { cash: number }).cash = 999

    expect((await repo.fetch(user))?.state).toEqual({ cash: 1 })
  })
})
