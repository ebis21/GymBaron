import { describe, expect, it } from 'vitest'
import { FakeMultiplayerApi, type FakeMultiplayerSeed } from './fakeMultiplayerApi'

const ALICE = { id: 'alice', username: 'Alice' }
const BOB = { id: 'bob', username: 'Bob' }
const CAROL = { id: 'carol', username: 'Carol' }
const NOW = () => new Date('2026-08-20T12:00:00.000Z')

function seed(overrides: Partial<FakeMultiplayerSeed> = {}): FakeMultiplayerSeed {
  return {
    currentUserId: ALICE.id,
    players: [
      { profile: ALICE, cash: 5_000, diamonds: 20, revision: 7, gameDay: 3 },
      {
        profile: BOB,
        cash: 800,
        diamonds: 2,
        revision: 4,
        gameDay: 6,
        gym: {
          level: 8,
          reputation: 72,
          satisfaction: 81,
          activeFloor: 0,
          floors: [{
            index: 0,
            expansion: 1,
            machines: [{
              uid: 'm1', type: 'bench', x: 1, y: 1, rotation: 0, durability: 91,
            }],
            decor: [{ uid: 'd1', type: 'plant', x: 2, y: 1, rotation: 0 }],
            walls: [{ uid: 'w1', x: 0, y: 0, side: 'n' }],
          }],
        },
      },
      { profile: CAROL, cash: 900, diamonds: 1, revision: 2, gameDay: 2 },
    ],
    now: NOW,
    ...overrides,
  }
}

describe('friendship and alliance rules', () => {
  it('rejects self requests and requires an accepted friendship for an alliance', async () => {
    const api = new FakeMultiplayerApi(seed())
    await expect(api.sendFriendRequest(ALICE.id)).rejects.toMatchObject({ code: 'MP_CANNOT_TARGET_SELF' })
    await expect(api.sendAllianceInvitation(BOB.id)).rejects.toMatchObject({
      code: 'MP_ALLIANCE_REQUIRES_FRIEND',
    })
  })

  it('accepts a friend request without implicitly creating an alliance', async () => {
    const api = new FakeMultiplayerApi(seed({
      friendRequests: [{ id: 'request-1', senderId: BOB.id, recipientId: ALICE.id }],
    }))
    await api.respondFriendRequest('request-1', true)

    const overview = await api.getOverview()
    expect(overview.friends).toHaveLength(1)
    expect(overview.friends[0]?.alliance).toBeNull()
    expect(await api.getNormalIncomeMultiplier()).toBe(1)
  })

  it('allows only friends to read a whitelisted gym snapshot', async () => {
    const api = new FakeMultiplayerApi(seed({ friendships: [[ALICE.id, BOB.id]] }))
    const gym = await api.getFriendGym(BOB.id)

    expect(gym).toMatchObject({ owner: BOB, level: 8, reputation: 72, satisfaction: 81 })
    expect(gym.floors[0]?.machines[0]?.type).toBe('bench')
    expect(gym).not.toHaveProperty('cash')
    expect(gym).not.toHaveProperty('diamonds')
    expect(gym).not.toHaveProperty('inventory')
    await expect(api.getFriendGym(CAROL.id)).rejects.toMatchObject({
      code: 'MP_FRIEND_GYM_FORBIDDEN',
    })
  })
})

describe('atomic transfers and idempotency', () => {
  it('moves the nominal amount, increments both revisions and executes a retry once', async () => {
    const api = new FakeMultiplayerApi(seed({
      friendships: [[ALICE.id, BOB.id]],
      alliances: [[ALICE.id, BOB.id]],
    }))
    const command = {
      recipientId: BOB.id,
      asset: 'cash' as const,
      amount: 1_000,
      idempotencyKey: 'transfer-001',
    }

    const first = await api.transfer(command)
    const retry = await api.transfer(command)

    expect(retry).toEqual(first)
    expect(api.balanceForTests(ALICE.id)).toMatchObject({ cash: 4_000, revision: 8 })
    expect(api.balanceForTests(BOB.id)).toMatchObject({ cash: 1_800, revision: 5 })
    expect(await api.getNormalIncomeMultiplier()).toBe(1.5)
  })

  it('rejects key reuse with different input without a second mutation', async () => {
    const api = new FakeMultiplayerApi(seed({
      friendships: [[ALICE.id, BOB.id]],
      alliances: [[ALICE.id, BOB.id]],
    }))
    await api.transfer({
      recipientId: BOB.id, asset: 'diamonds', amount: 2, idempotencyKey: 'shared-key-01',
    })
    await expect(api.transfer({
      recipientId: BOB.id, asset: 'diamonds', amount: 3, idempotencyKey: 'shared-key-01',
    })).rejects.toMatchObject({ code: 'MP_IDEMPOTENCY_CONFLICT' })
    expect(api.balanceForTests(ALICE.id).diamonds).toBe(18)
    expect(api.balanceForTests(BOB.id).diamonds).toBe(4)
  })

  it('rejects missing alliance, invalid integers and unavailable balance atomically', async () => {
    const friendsOnly = new FakeMultiplayerApi(seed({ friendships: [[ALICE.id, BOB.id]] }))
    await expect(friendsOnly.transfer({
      recipientId: BOB.id, asset: 'cash', amount: 10, idempotencyKey: 'transfer-no-ally',
    })).rejects.toMatchObject({ code: 'MP_TRANSFER_REQUIRES_ALLIANCE' })

    const allied = new FakeMultiplayerApi(seed({
      friendships: [[ALICE.id, BOB.id]],
      alliances: [[ALICE.id, BOB.id]],
    }))
    await expect(allied.transfer({
      recipientId: BOB.id, asset: 'cash', amount: 1.2, idempotencyKey: 'transfer-fraction',
    })).rejects.toMatchObject({ code: 'MP_INVALID_AMOUNT' })
    await expect(allied.transfer({
      recipientId: BOB.id, asset: 'cash', amount: 99_999, idempotencyKey: 'transfer-too-high',
    })).rejects.toMatchObject({ code: 'MP_INSUFFICIENT_BALANCE' })
    expect(allied.balanceForTests(ALICE.id)).toMatchObject({ cash: 5_000, revision: 7 })
    expect(allied.balanceForTests(BOB.id)).toMatchObject({ cash: 800, revision: 4 })
  })
})

describe('loan lifecycle', () => {
  it('accepts once, supports partial/full repayment and does not require the alliance to survive', async () => {
    const api = new FakeMultiplayerApi(seed({
      currentUserId: BOB.id,
      friendships: [[ALICE.id, BOB.id]],
      alliances: [[ALICE.id, BOB.id]],
      loans: [{
        id: 'loan-1', lenderId: ALICE.id, borrowerId: BOB.id, amount: 2_000,
      }],
    }))

    const accepted = await api.respondLoan({
      loanId: 'loan-1', accept: true, idempotencyKey: 'accept-loan-1',
    })
    const retry = await api.respondLoan({
      loanId: 'loan-1', accept: true, idempotencyKey: 'accept-loan-1',
    })
    expect(retry).toEqual(accepted)
    expect(api.balanceForTests(ALICE.id).cash).toBe(3_000)
    expect(api.balanceForTests(BOB.id).cash).toBe(2_800)

    await api.endAlliance(ALICE.id)
    const partial = await api.repayLoan({
      loanId: 'loan-1', amount: 500, idempotencyKey: 'repay-loan-1a',
    })
    expect(partial).toMatchObject({ status: 'active', repaidAmount: 500 })
    const complete = await api.repayLoan({
      loanId: 'loan-1', amount: 1_500, idempotencyKey: 'repay-loan-1b',
    })
    expect(complete).toMatchObject({ status: 'repaid', repaidAmount: 2_000 })
    expect(api.balanceForTests(ALICE.id).cash).toBe(5_000)
    expect(api.balanceForTests(BOB.id).cash).toBe(800)
  })

  it('does not partially pay a loan when the lender lacks funds', async () => {
    const api = new FakeMultiplayerApi(seed({
      currentUserId: BOB.id,
      players: [
        { profile: ALICE, cash: 100, diamonds: 0, revision: 1 },
        { profile: BOB, cash: 50, diamonds: 0, revision: 1 },
      ],
      friendships: [[ALICE.id, BOB.id]],
      alliances: [[ALICE.id, BOB.id]],
      loans: [{ id: 'loan-poor', lenderId: ALICE.id, borrowerId: BOB.id, amount: 200 }],
    }))
    await expect(api.respondLoan({
      loanId: 'loan-poor', accept: true, idempotencyKey: 'accept-poor-loan',
    })).rejects.toMatchObject({ code: 'MP_LENDER_INSUFFICIENT_BALANCE' })
    expect(api.balanceForTests(ALICE.id)).toMatchObject({ cash: 100, revision: 1 })
    expect(api.balanceForTests(BOB.id)).toMatchObject({ cash: 50, revision: 1 })
  })

  it('rejects repayment above the outstanding amount', async () => {
    const api = new FakeMultiplayerApi(seed({
      currentUserId: BOB.id,
      friendships: [[ALICE.id, BOB.id]],
      loans: [{
        id: 'loan-active', lenderId: ALICE.id, borrowerId: BOB.id,
        amount: 1_000, repaidAmount: 800, status: 'active',
      }],
    }))
    await expect(api.repayLoan({
      loanId: 'loan-active', amount: 201, idempotencyKey: 'repay-too-much',
    })).rejects.toMatchObject({ code: 'MP_REPAYMENT_TOO_HIGH' })
    expect(api.balanceForTests(BOB.id).cash).toBe(800)
  })
})

describe('LIL D. sabotage security rules', () => {
  it('charges exactly once and enforces one successful event per target game day', async () => {
    const api = new FakeMultiplayerApi(seed({ friendships: [[ALICE.id, BOB.id]] }))
    const command = { targetId: BOB.id, idempotencyKey: 'sabotage-bob-day-6' }
    const first = await api.sabotage(command)
    const retry = await api.sabotage(command)

    expect(retry).toEqual(first)
    expect(first.targetGameDay).toBe(6)
    expect(api.balanceForTests(ALICE.id)).toMatchObject({ cash: 4_000, revision: 8 })
    await expect(api.sabotage({
      targetId: BOB.id, idempotencyKey: 'sabotage-bob-again',
    })).rejects.toMatchObject({ code: 'MP_SABOTAGE_DAILY_LIMIT' })
    expect(api.balanceForTests(ALICE.id).cash).toBe(4_000)

    api.setGameDayForTests(BOB.id, 7)
    await api.sabotage({ targetId: BOB.id, idempotencyKey: 'sabotage-bob-day-7' })
    expect(api.balanceForTests(ALICE.id).cash).toBe(3_000)
  })

  it('rejects self, non-friend and active ally without charging', async () => {
    const api = new FakeMultiplayerApi(seed({
      friendships: [[ALICE.id, BOB.id]],
      alliances: [[ALICE.id, BOB.id]],
    }))
    await expect(api.sabotage({
      targetId: ALICE.id, idempotencyKey: 'sabotage-self',
    })).rejects.toMatchObject({ code: 'MP_CANNOT_TARGET_SELF' })
    await expect(api.sabotage({
      targetId: CAROL.id, idempotencyKey: 'sabotage-stranger',
    })).rejects.toMatchObject({ code: 'MP_SABOTAGE_REQUIRES_FRIEND' })
    await expect(api.sabotage({
      targetId: BOB.id, idempotencyKey: 'sabotage-ally',
    })).rejects.toMatchObject({ code: 'MP_CANNOT_SABOTAGE_ALLY' })
    expect(api.balanceForTests(ALICE.id)).toMatchObject({ cash: 5_000, revision: 7 })
  })

  it('applies the target/day limit globally and keeps offline events pending until ack', async () => {
    const attacker = new FakeMultiplayerApi(seed({
      friendships: [[ALICE.id, BOB.id]],
      sabotageEvents: [{
        id: 'carol-hit', attackerId: CAROL.id, targetId: BOB.id, targetGameDay: 6,
      }],
    }))
    await expect(attacker.sabotage({
      targetId: BOB.id, idempotencyKey: 'alice-hit-after-carol',
    })).rejects.toMatchObject({ code: 'MP_SABOTAGE_DAILY_LIMIT' })

    const target = new FakeMultiplayerApi(seed({
      currentUserId: BOB.id,
      sabotageEvents: [{
        id: 'pending-hit', attackerId: ALICE.id, targetId: BOB.id, targetGameDay: 6,
      }],
    }))
    expect(await target.getPendingSabotages()).toHaveLength(1)
    await target.acknowledgeSabotage('pending-hit')
    expect(await target.getPendingSabotages()).toEqual([])
  })
})
