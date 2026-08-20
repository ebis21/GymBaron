import { describe, expect, it } from 'vitest'
import { localWins, newestWins, remoteWins } from './resolve'

describe('choosing between two saves', () => {
  it('keeps the one played more recently', () => {
    expect(newestWins({ lastSeenAt: 200 }, { lastSeenAt: 100 })).toBe('local')
    expect(newestWins({ lastSeenAt: 100 }, { lastSeenAt: 200 })).toBe('remote')
  })

  it('leans on the cloud when the two are level', () => {
    // A server-side credit can change the stored state without moving
    // `lastSeenAt`, so a tie must not throw that change away.
    expect(newestWins({ lastSeenAt: 100 }, { lastSeenAt: 100 })).toBe('remote')
  })

  it('leans on the cloud when a save carries no usable timestamp', () => {
    expect(newestWins({}, { lastSeenAt: 100 })).toBe('remote')
    expect(newestWins(null, null)).toBe('remote')
    expect(newestWins({ lastSeenAt: Number.NaN }, { lastSeenAt: 5 })).toBe('remote')
  })

  it('offers unconditional resolvers for when the player has chosen', () => {
    expect(remoteWins({ lastSeenAt: 999 }, { lastSeenAt: 1 })).toBe('remote')
    expect(localWins({ lastSeenAt: 1 }, { lastSeenAt: 999 })).toBe('local')
  })
})
