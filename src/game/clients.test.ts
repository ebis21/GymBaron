import { describe, it, expect } from 'vitest'
import {
  spawnWalkins, spawnMembers, advanceClients, scanClient, freeTrainers, isTrainerFree,
  queueLimit,
} from './clients'
import { initialState } from './economy'
import {
  DAY_MS, MAX_QUEUE, MEMBER_DISCOUNT, PATIENCE_MS, TRAINER_FEE_MULT,
} from './constants'
import type { Client, GameState, Machine, Member, Staff } from './types'
import { CLIENT_RARITIES } from './content/rarity'
import type { CampaignId } from './content/campaigns'

const machine = (over: Partial<Machine> = {}): Machine =>
  ({ uid: 'm1', type: 'dumbbells', x: 0, y: 0, rotation: 0, durability: 100, occupiedBy: null, brokenMs: 0, ...over })

const client = (over: Partial<Client> = {}): Client => ({
  uid: 'c1',
  kind: 'walkin',
  rarity: 'common',
  phase: 'queue',
  phaseMs: 0,
  machineUid: null,
  memberUid: null,
  trainerUid: null,
  x: 0,
  z: 0,
  path: [],
  goal: null,
  ...over,
})

const member = (uid: string, joinedDay = 1): Member => ({ uid, joinedDay })

const trainer = (uid: string, over: Partial<Staff> = {}): Staff => ({
  uid, name: 'Ola D.', role: 'trainer', rank: 'rare',
  x: 0, z: 0, path: [], goal: null,
  targetUid: null, workMs: 0, owed: 0, ...over,
})

const gym = (): GameState => ({ ...initialState(7, 0), machines: [machine()] })

describe('spawnWalkins', () => {
  it('never spawns into a gym with no machines', () => {
    let s = initialState(7, 0)
    for (let i = 0; i < 200; i++) s = spawnWalkins(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('never spawns when every machine is broken', () => {
    let s: GameState = { ...gym(), machines: [machine({ durability: 0 })] }
    for (let i = 0; i < 200; i++) s = spawnWalkins(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('eventually spawns when a free working machine exists', () => {
    let s = gym()
    for (let i = 0; i < 300 && s.clients.length === 0; i++) s = spawnWalkins(s, 1000)
    expect(s.clients.length).toBeGreaterThan(0)
  })

  it('spawns passers-by, never members', () => {
    let s = gym()
    for (let i = 0; i < 300; i++) s = spawnWalkins(s, 1000)
    expect(s.clients.every(c => c.kind === 'walkin')).toBe(true)
  })

  it('stops at the queue cap', () => {
    let s = gym()
    for (let i = 0; i < 2000; i++) s = spawnWalkins(s, 1000)
    expect(s.clients.filter(c => c.phase === 'queue').length).toBeLessThanOrEqual(MAX_QUEUE)
  })

  it('is deterministic for a given seed', () => {
    let a = gym(); let b = gym()
    for (let i = 0; i < 50; i++) { a = spawnWalkins(a, 1000); b = spawnWalkins(b, 1000) }
    expect(a).toEqual(b)
  })

  /**
   * The queue is emptied after every tick so the cap can never be the thing
   * under test — what is being measured is how often the door opens, not how
   * many people fit in the hall once it has.
   */
  const arrivalsOver = (state: GameState, ticks: number): number => {
    let s = state
    let arrivals = 0
    for (let i = 0; i < ticks; i += 1) {
      const next = spawnWalkins(s, 100)
      arrivals += next.clients.length - s.clients.length
      s = { ...next, clients: [] }
    }
    return arrivals
  }

  const floorOf = (type: Machine['type'], count: number): GameState => ({
    ...initialState(7, 0),
    machines: Array.from({ length: count }, (_, i) => machine({ uid: `m${i}`, type })),
  })

  it('brings more people in the more machines there are', () => {
    // Footfall used to be reputation alone, so a floor of thirty served the
    // same trickle as a floor of one and the extra kit only ever shortened
    // the queue. Same seed on both, so this is the same random stream.
    expect(arrivalsOver(floorOf('bench', 12), 600))
      .toBeGreaterThan(arrivalsOver(floorOf('bench', 1), 600))
  })

  it('brings more people in the better those machines are', () => {
    expect(arrivalsOver(floorOf('apex-rig', 8), 600))
      .toBeGreaterThan(arrivalsOver(floorOf('bench', 8), 600))
  })
})

describe('queueLimit', () => {
  it('is the base cap in the room the game opens with', () => {
    expect(queueLimit(gym())).toBe(MAX_QUEUE)
  })

  it('grows with the floor space, so a big gym is not throttled at ten', () => {
    expect(queueLimit({ ...gym(), expansion: 1 })).toBe(MAX_QUEUE + 2)
    expect(queueLimit({ ...gym(), expansion: 3 })).toBe(MAX_QUEUE + 6)
  })

  it('clamps a nonsense rung rather than growing without bound', () => {
    expect(queueLimit({ ...gym(), expansion: 99 })).toBe(MAX_QUEUE + 6)
    expect(queueLimit({ ...gym(), expansion: -4 })).toBe(MAX_QUEUE)
  })
})

describe('spawnMembers', () => {
  it('does nothing when there are no members', () => {
    let s = gym()
    for (let i = 0; i < 300; i++) s = spawnMembers(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('eventually brings a member in, tagged and traceable to the pass', () => {
    let s: GameState = { ...gym(), members: [member('p1')] }
    for (let i = 0; i < 2000 && s.clients.length === 0; i++) s = spawnMembers(s, 1000)
    expect(s.clients).toHaveLength(1)
    expect(s.clients[0]!.kind).toBe('member')
    expect(s.clients[0]!.memberUid).toBe('p1')
  })

  it('never has the same member queueing twice at once', () => {
    let s: GameState = { ...gym(), members: [member('p1')] }
    for (let i = 0; i < 2000; i++) s = spawnMembers(s, 1000)
    const uids = s.clients.map(c => c.memberUid)
    expect(new Set(uids).size).toBe(uids.length)
  })
})

describe('queue patience', () => {
  it('drops an unscanned client after PATIENCE_MS and hurts reputation', () => {
    const s0: GameState = { ...gym(), reputation: 50,
      clients: [client()] }
    const s = advanceClients(s0, PATIENCE_MS + 1)
    expect(s.clients).toHaveLength(0)
    expect(s.stats.clientsLost).toBe(1)
    expect(s.reputation).toBeLessThan(50)
  })

  it('keeps a client who still has patience', () => {
    const s0: GameState = { ...gym(),
      clients: [client()] }
    expect(advanceClients(s0, PATIENCE_MS - 1).clients).toHaveLength(1)
  })

  it('never drives reputation below zero', () => {
    let s: GameState = { ...gym(), reputation: 0,
      clients: [client()] }
    s = advanceClients(s, PATIENCE_MS + 1)
    expect(s.reputation).toBeGreaterThanOrEqual(0)
  })
})

describe('scanClient', () => {
  it('charges the fee and puts the client on a machine', () => {
    const s0: GameState = { ...gym(),
      clients: [client()] }
    const s = scanClient(s0, 'c1')
    expect(s.cash).toBeGreaterThan(s0.cash)
    expect(s.stats.totalEarned).toBeGreaterThan(0)
    expect(s.clients[0]!.phase).toBe('toMachine')
    expect(s.clients[0]!.machineUid).toBe('m1')
    expect(s.machines[0]!.occupiedBy).toBe('c1')
  })

  it('resets the phase timer when the client starts training', () => {
    const s0: GameState = { ...gym(),
      clients: [client({ phaseMs: 5000 })] }
    expect(scanClient(s0, 'c1').clients[0]!.phaseMs).toBe(0)
  })

  it('is a no-op when every machine is busy', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'other' })],
      clients: [client()] }
    const s = scanClient(s0, 'c1')
    expect(s.clients[0]!.phase).toBe('queue')
    expect(s.cash).toBe(s0.cash)
  })

  it('is a no-op when the only machine is broken', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ durability: 0 })],
      clients: [client()] }
    expect(scanClient(s0, 'c1').clients[0]!.phase).toBe('queue')
  })

  it('ignores an unknown client id', () => {
    const s0 = gym()
    expect(scanClient(s0, 'nope')).toEqual(s0)
  })

  it('ignores a client who is already training', () => {
    const s0: GameState = { ...gym(),
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(scanClient(s0, 'c1')).toEqual(s0)
  })

  it('charges a rarer client more at the same machine', () => {
    const common = scanClient({ ...gym(), clients: [client({ rarity: 'common' })] }, 'c1')
    const influencer = scanClient({ ...gym(), clients: [client({ rarity: 'influencer' })] }, 'c1')
    const paidCommon = common.cash - gym().cash
    const paidInfluencer = influencer.cash - gym().cash
    expect(paidInfluencer).toBeCloseTo(paidCommon * (3.2 / 1.2), 5)
  })
})

describe('workout completion', () => {
  it('frees the machine, wears it, and pays out satisfaction and xp', () => {
    const s0: GameState = { ...gym(), satisfaction: 50,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    const s = advanceClients(s0, 99_000)
    expect(s.clients[0]!.phase).toBe('leaving')
    expect(s.machines[0]!.occupiedBy).toBeNull()
    expect(s.machines[0]!.durability).toBeLessThan(100)
    expect(s.stats.clientsServed).toBe(1)
    expect(s.xp + (s.level - 1) * 100).toBeGreaterThan(0)
  })

  it('does not finish a workout early', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(advanceClients(s0, 1_000).clients).toHaveLength(1)
  })

  it('takes a machine out of service at zero durability without going negative', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'c1', durability: 0.1 })],
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(advanceClients(s0, 99_000).machines[0]!.durability).toBe(0)
  })

  it('never drives satisfaction above 100', () => {
    const s0: GameState = { ...gym(), satisfaction: 99,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1' })] }
    expect(advanceClients(s0, 99_000).satisfaction).toBeLessThanOrEqual(100)
  })
})

describe('member visits', () => {
  it('charges a member half of what a passer-by pays at the same machine', () => {
    const walkin = scanClient({ ...gym(), clients: [client()] }, 'c1')
    const holder: GameState = {
      ...gym(),
      members: [member('p1')],
      clients: [client({ kind: 'member', memberUid: 'p1' })],
    }
    const scanned = scanClient(holder, 'c1')

    const paidByWalkin = walkin.cash - gym().cash
    const paidByMember = scanned.cash - holder.cash
    expect(paidByMember).toBeCloseTo(paidByWalkin * MEMBER_DISCOUNT, 5)
  })

  it('still makes a member queue and wait to be scanned', () => {
    const s0: GameState = {
      ...gym(),
      members: [member('p1')],
      clients: [client({ kind: 'member', memberUid: 'p1' })],
    }
    const s = advanceClients(s0, PATIENCE_MS + 1)
    expect(s.clients).toHaveLength(0)
    expect(s.stats.clientsLost).toBe(1)
  })
})

describe('signing up', () => {
  it('turns satisfied passers-by into members and banks their first pass', () => {
    // A packed happy gym: run enough finished workouts that at least one
    // of the ~40% conversion rolls has to land.
    let s: GameState = { ...gym(), satisfaction: 100 }
    for (let i = 0; i < 40 && s.members.length === 0; i += 1) {
      s = {
        ...s,
        machines: [machine({ occupiedBy: 'c1' })],
        clients: [client({ phase: 'workout', machineUid: 'm1' })],
      }
      s = advanceClients(s, 99_000)
    }
    expect(s.members.length).toBeGreaterThan(0)
    expect(s.today.signups).toBeGreaterThan(0)
    expect(s.today.subscriptions).toBeGreaterThan(0)
    expect(s.cash).toBeGreaterThan(gym().cash)
  })

  it('never signs up a client who already holds a pass', () => {
    let s: GameState = {
      ...gym(),
      satisfaction: 100,
      members: [member('p1')],
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ kind: 'member', memberUid: 'p1', phase: 'workout', machineUid: 'm1' })],
    }
    s = advanceClients(s, 99_000)
    expect(s.members).toHaveLength(1)
    expect(s.today.signups).toBe(0)
  })
})

describe('closing time', () => {
  const atClosing = (over: Partial<GameState> = {}): GameState =>
    ({ ...gym(), dayMs: DAY_MS, ...over })

  it('turns nobody new away from a gym that is still open', () => {
    let s: GameState = { ...gym(), dayMs: DAY_MS - 1 }
    for (let i = 0; i < 200; i++) s = spawnWalkins(s, 1000)
    expect(s.clients.length).toBeGreaterThan(0)
  })

  it('admits no passers-by once the clock runs out', () => {
    let s = atClosing()
    for (let i = 0; i < 200; i++) s = spawnWalkins(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('admits no members once the clock runs out', () => {
    let s = atClosing({ members: [member('p1'), member('p2')] })
    for (let i = 0; i < 200; i++) s = spawnMembers(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('still lets the player serve whoever is already queueing', () => {
    const s = atClosing({ clients: [client()] })
    expect(scanClient(s, 'c1').clients[0]!.phase).toBe('toMachine')
  })
})

describe('personal trainers', () => {
  const withTrainer = (over: Partial<GameState> = {}): GameState =>
    ({ ...gym(), staff: [trainer('e1')], clients: [client()], ...over })

  it('counts an unbooked trainer as free', () => {
    const s = withTrainer()
    expect(isTrainerFree(s, 'e1')).toBe(true)
    expect(freeTrainers(s).map(t => t.uid)).toEqual(['e1'])
  })

  it('does not count somebody who is not a trainer', () => {
    const s = withTrainer({ staff: [trainer('e1', { role: 'cleaner' })] })
    expect(isTrainerFree(s, 'e1')).toBe(false)
  })

  it('does not count a trainer on strike over unpaid wages', () => {
    const s = withTrainer({ staff: [trainer('e1', { owed: 1500 })] })
    expect(isTrainerFree(s, 'e1')).toBe(false)
  })

  it('charges half again when a trainer is booked', () => {
    const s = withTrainer()
    const plain = scanClient(s, 'c1').cash - s.cash
    const coached = scanClient(s, 'c1', 'e1').cash - s.cash
    expect(coached).toBeCloseTo(plain * TRAINER_FEE_MULT, 5)
  })

  it('records the trainer as booked on the client', () => {
    const s = scanClient(withTrainer(), 'c1', 'e1')
    expect(s.clients[0]!.trainerUid).toBe('e1')
    expect(isTrainerFree(s, 'e1')).toBe(false)
    expect(freeTrainers(s)).toHaveLength(0)
  })

  it('books the trainer only for the visit they were sold to', () => {
    const s = withTrainer({
      clients: [client(), client({ uid: 'c2' })],
      machines: [machine(), machine({ uid: 'm2' })],
    })
    const after = scanClient(s, 'c1', 'e1')
    expect(after.clients.find(c => c.uid === 'c2')!.trainerUid).toBeNull()
  })

  it('books the trainer as a breakdown of the door fee, not income on top', () => {
    const s = withTrainer()
    const after = scanClient(s, 'c1', 'e1')
    const charged = after.cash - s.cash
    expect(after.today.entryFees).toBeCloseTo(charged, 5)
    expect(after.today.trainerFees).toBeGreaterThan(0)
    expect(after.today.trainerFees).toBeLessThan(after.today.entryFees)
  })

  // The button could be a frame stale, and a stale button must never mint money.
  it('quietly charges the plain fee for a trainer who is already busy', () => {
    const s = withTrainer({
      clients: [client(), client({ uid: 'c2', trainerUid: 'e1' })],
      machines: [machine(), machine({ uid: 'm2' })],
    })
    const plain = scanClient(s, 'c1').cash - s.cash
    const attempted = scanClient(s, 'c1', 'e1')
    expect(attempted.cash - s.cash).toBeCloseTo(plain, 5)
    expect(attempted.clients.find(c => c.uid === 'c1')!.trainerUid).toBeNull()
    expect(attempted.today.trainerFees).toBe(0)
  })

  it('quietly charges the plain fee for a trainer who does not exist', () => {
    const s = withTrainer({ staff: [] })
    const plain = scanClient(s, 'c1').cash - s.cash
    expect(scanClient(s, 'c1', 'e9').cash - s.cash).toBeCloseTo(plain, 5)
  })

  it('frees the trainer the moment the workout is over', () => {
    const s = scanClient(withTrainer(), 'c1', 'e1')
    const training: GameState = {
      ...s,
      clients: s.clients.map(c => ({ ...c, phase: 'workout' as const, phaseMs: 0 })),
    }
    const done = advanceClients(training, 60_000)
    expect(done.clients[0]!.phase).toBe('leaving')
    expect(done.clients[0]!.trainerUid).toBeNull()
    expect(isTrainerFree(done, 'e1')).toBe(true)
  })
})

describe('reputation from workouts', () => {
  const finished = (rep: number): GameState => ({
    ...gym(),
    reputation: rep,
    machines: [machine({ occupiedBy: 'c1' })],
    clients: [client({ phase: 'workout', machineUid: 'm1' })],
  })

  const gained = (rep: number) => advanceClients(finished(rep), 99_000).reputation - rep

  it('pays reputation for a finished workout', () => {
    expect(gained(0)).toBeGreaterThan(0)
  })

  // A working desk serves sixty people a day. At a flat rate the gym went from
  // unknown to famous in an afternoon, so the last points have to be earned.
  it('pays less the better known the gym already is', () => {
    expect(gained(90)).toBeLessThan(gained(50))
    expect(gained(50)).toBeLessThan(gained(0))
  })

  it('cannot be pushed past a perfect reputation', () => {
    expect(advanceClients(finished(100), 99_000).reputation).toBeLessThanOrEqual(100)
  })

  it('still costs more to lose somebody than to serve one', () => {
    const walkout = advanceClients(
      { ...gym(), reputation: 50, clients: [client()] },
      PATIENCE_MS + 1,
    )
    expect(50 - walkout.reputation).toBeGreaterThan(gained(50))
  })
})

describe('what a live campaign changes on the floor', () => {
  const running = (s: GameState, id: CampaignId): GameState => ({
    ...s,
    marketing: { running: [{ id, remainingMs: DAY_MS }], billable: [] },
  })

  /** Average rarity tier of everyone who walked in, as an index into the table. */
  const averageTier = (s: GameState): number => {
    const tiers = s.clients.map(c => CLIENT_RARITIES.indexOf(c.rarity))
    return tiers.reduce((sum, t) => sum + t, 0) / tiers.length
  }

  /** Spawns a crowd one at a time, clearing the queue so the cap never bites. */
  const crowd = (start: GameState): GameState => {
    let s = start
    const seen: GameState['clients'] = []
    for (let i = 0; i < 600; i += 1) {
      s = spawnWalkins({ ...s, clients: [] }, 1000)
      seen.push(...s.clients)
    }
    return { ...s, clients: seen }
  }

  /**
   * Thresholds rather than a bare comparison, because a campaign also changes
   * how *many* people arrive, and that alone walks the seed differently. The
   * untouched table averages tier 0.9 and doubling luck averages 1.8, so a gap
   * this wide over six hundred arrivals can only be the rarity roll.
   */
  it('pulls a better class of client while a premium campaign runs', () => {
    const plain = crowd(gym())
    const premium = crowd(running(gym(), 'premium'))

    expect(plain.clients.length).toBeGreaterThan(50)
    expect(premium.clients.length).toBeGreaterThan(50)
    expect(averageTier(plain)).toBeLessThan(1)
    expect(averageTier(premium)).toBeGreaterThan(1.3)
  })

  /** Finishes the same number of workouts and counts the passes sold. */
  const workouts = (start: GameState): number => {
    let s = start
    for (let i = 0; i < 500; i += 1) {
      s = advanceClients({
        ...s,
        machines: [machine({ occupiedBy: 'c1' })],
        clients: [client({ phase: 'workout', machineUid: 'm1' })],
      }, 99_000)
    }
    return s.today.signups
  }

  it('converts more of the same crowd while a referral campaign runs', () => {
    const plain = workouts({ ...gym(), satisfaction: 50 })
    const referral = workouts(running({ ...gym(), satisfaction: 50 }, 'referral'))

    expect(plain).toBeGreaterThan(0)
    expect(referral).toBeGreaterThan(plain)
  })

  it('leaves both alone once the campaign has expired', () => {
    const plain = crowd(gym())
    const expired = crowd({ ...gym(), marketing: { running: [], billable: ['premium'] } })

    expect(averageTier(expired)).toBe(averageTier(plain))
  })
})
