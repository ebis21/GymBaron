import { describe, it, expect } from 'vitest'
import {
  assignStaff, workStaff, fire, hire, payArrears, onDuty, restTileFor, targetTile,
  deskPost, freeTrainers, isTrainerFree, nextToServe, staffLimit, freeDesks, staffedDesks,
} from './staff'
import { initialState } from './economy'
import { isAtStaffDoor, staffDoorTile, tileToWorld } from './layout'
import { workMsFor } from './content/staff'
import { PATIENCE_MS, STAFF_UNLOCK_LEVEL, TRAINER_UNLOCK_LEVEL } from './constants'
import type { Candidate, Client, Decor, GameState, Machine, Staff, Stain } from './types'

const at = (x: number, y: number) => tileToWorld(x, y)

const staff = (over: Partial<Staff> = {}): Staff => ({
  uid: 'e1', name: 'Marta K.', role: 'cleaner', rank: 'rare',
  x: at(-1, 0).x, z: at(-1, 0).z, path: [], goal: null,
  targetUid: null, workMs: 0, owed: 0, ...over,
})

const machine = (over: Partial<Machine> = {}): Machine => ({
  uid: 'm1', type: 'dumbbells', x: 4, y: 2, rotation: 0,
  durability: 100, occupiedBy: null, brokenMs: 0, ...over,
})

const stain = (over: Partial<Stain> = {}): Stain => ({ uid: 's1', x: 2, y: 2, ageMs: 0, ...over })

const desk = (over: Partial<Decor> = {}): Decor => ({ uid: 'd1', type: 'reception', x: 1, y: 1, rotation: 0, ...over })

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  uid: 'k1', name: 'Marta K.', role: 'cleaner', rank: 'rare', price: 1200, ...over,
})

const client = (over: Partial<Client> = {}): Client => ({
  uid: 'c1', kind: 'walkin', rarity: 'common', phase: 'queue', phaseMs: 0,
  machineUid: null, memberUid: null, trainerUid: null,
  x: 0, z: 0, path: [], goal: null, ...over,
})

/** Standing at the counter of a desk at (1,1) facing north — the tile at (1,0). */
const atDesk = { x: at(1, 0).x, z: at(1, 0).z }

const gym = (over: Partial<GameState> = {}): GameState => ({
  ...initialState(7, 0),
  level: STAFF_UNLOCK_LEVEL,
  ...over,
})

describe('onDuty', () => {
  it('counts a paid employee as working', () => {
    expect(onDuty(staff())).toBe(true)
  })

  it('counts an unpaid employee as on strike', () => {
    expect(onDuty(staff({ owed: 1500 }))).toBe(false)
  })
})

describe('assignStaff', () => {
  it('sends a cleaner to the oldest stain, not the nearest', () => {
    const s = assignStaff(gym({
      staff: [staff()],
      stains: [stain({ uid: 'near', x: 0, y: 0, ageMs: 0 }), stain({ uid: 'old', x: 7, y: 5, ageMs: 9000 })],
    }))
    expect(s.staff[0]!.targetUid).toBe('old')
  })

  it('sends a repairer to a broken machine', () => {
    const s = assignStaff(gym({
      staff: [staff({ role: 'repair' })],
      machines: [machine({ durability: 0 })],
    }))
    expect(s.staff[0]!.targetUid).toBe('m1')
  })

  it('leaves a repairer idle when nothing is broken', () => {
    const s = assignStaff(gym({ staff: [staff({ role: 'repair' })], machines: [machine()] }))
    expect(s.staff[0]!.targetUid).toBeNull()
  })

  it('never assigns work to somebody on strike', () => {
    const s = assignStaff(gym({ staff: [staff({ owed: 1500 })], stains: [stain()] }))
    expect(s.staff[0]!.targetUid).toBeNull()
  })

  it('does not send two cleaners to the same stain', () => {
    const s = assignStaff(gym({
      staff: [staff({ uid: 'e1' }), staff({ uid: 'e2' })],
      stains: [stain()],
    }))
    expect(s.staff[1]!.targetUid).toBeNull()
  })

  it('sends a receptionist to the desk', () => {
    const s = assignStaff(gym({
      staff: [staff({ role: 'reception' })],
      decor: [desk()],
    }))
    expect(s.staff[0]!.targetUid).toBe('d1')
  })

  it('does not send two receptionists to the same desk', () => {
    const s = assignStaff(gym({
      staff: [staff({ uid: 'e1', role: 'reception' }), staff({ uid: 'e2', role: 'reception' })],
      decor: [desk()],
    }))
    expect(s.staff[0]!.targetUid).toBe('d1')
    expect(s.staff[1]!.targetUid).toBeNull()
  })

  /**
   * The shipped desk sat at (0,0) facing north, which puts the attendant's
   * tile at y = -1 — off the grid. The job could never be walked to, so it was
   * handed out and dropped again on every tick: nobody was ever served, and
   * the staff array was rebuilt sixty times a second for the trouble.
   */
  it('gives a receptionist a reachable post at a desk in the top row', () => {
    const s = assignStaff(gym({
      staff: [staff({ role: 'reception' })],
      decor: [desk({ x: 0, y: 0, rotation: 0 })],
    }))
    expect(s.staff[0]!.targetUid).toBe('d1')

    const post = targetTile(s, s.staff[0]!)
    expect(post).not.toBeNull()
    expect(post!.y).toBeGreaterThanOrEqual(0)
  })

  it('settles instead of re-assigning the same desk every tick', () => {
    const first = assignStaff(gym({
      staff: [staff({ role: 'reception' })],
      decor: [desk({ x: 0, y: 0, rotation: 0 })],
    }))
    expect(assignStaff(first)).toBe(first)
  })

  it('leaves a desk nobody can stand at unassigned', () => {
    // Boxed in on all four sides by machines, with the attendant's tile off
    // the grid: there is genuinely nowhere to work from.
    const s = assignStaff(gym({
      staff: [staff({ role: 'reception' })],
      decor: [desk({ x: 1, y: 0, rotation: 0 })],
      machines: [
        machine({ uid: 'mA', x: 0, y: 0 }),
        machine({ uid: 'mB', x: 2, y: 0 }),
        machine({ uid: 'mC', x: 1, y: 1 }),
      ],
    }))
    expect(s.staff[0]!.targetUid).toBeNull()
  })

  /**
   * Storing and re-placing a desk mints a new uid. `targetTile` read *any*
   * desk, so a receptionist holding the old uid kept working while a second
   * one was handed the new desk — both stood on the same tile, both scanning.
   */
  it('drops a claim on a desk that no longer exists', () => {
    const s = gym({
      staff: [staff({ role: 'reception', targetUid: 'd-old' })],
      decor: [desk({ uid: 'd-new', x: 3, y: 3 })],
    })
    expect(targetTile(s, s.staff[0]!)).toBeNull()
    expect(assignStaff(s).staff[0]!.targetUid).toBe('d-new')
  })
})

describe('deskPost', () => {
  it('prefers the attendant\'s side, opposite the queue', () => {
    const s = gym()
    expect(deskPost(s, desk({ x: 3, y: 3, rotation: 0 }))).toEqual({ x: 3, y: 2 })
  })

  it('falls back to another side when that tile is off the grid', () => {
    const s = gym()
    const post = deskPost(s, desk({ x: 0, y: 0, rotation: 0 }))
    expect(post).not.toBeNull()
    expect(Math.abs(post!.x - 0) + Math.abs(post!.y - 0)).toBe(1)
  })

  it('falls back again when that tile is built over', () => {
    const s = gym({ machines: [machine({ x: 3, y: 2 })] })
    expect(deskPost(s, desk({ x: 3, y: 3, rotation: 0 }))).not.toEqual({ x: 3, y: 2 })
  })

  it('gives up on a desk with nowhere at all to stand', () => {
    const s = gym({
      machines: [
        machine({ uid: 'mA', x: 0, y: 0 }),
        machine({ uid: 'mB', x: 2, y: 0 }),
        machine({ uid: 'mC', x: 1, y: 1 }),
      ],
    })
    expect(deskPost(s, desk({ x: 1, y: 0, rotation: 0 }))).toBeNull()
  })
})

describe('nextToServe', () => {
  it('takes whoever is closest to walking out, not whoever queued first', () => {
    const s = gym({
      clients: [
        client({ uid: 'fresh', phaseMs: 1000 }),
        client({ uid: 'desperate', phaseMs: PATIENCE_MS - 500 }),
      ],
    })
    expect(nextToServe(s)!.uid).toBe('desperate')
  })

  it('ignores everybody who is not queueing', () => {
    const s = gym({ clients: [client({ phase: 'workout', phaseMs: 99_999 })] })
    expect(nextToServe(s)).toBeNull()
  })
})

describe('workStaff', () => {
  it('wipes a stain after the rank work time', () => {
    // A rare cleaner standing on the stain needs 6000 ms.
    let s = gym({
      staff: [staff({ targetUid: 's1', x: at(2, 2).x, z: at(2, 2).z })],
      stains: [stain()],
    })
    s = workStaff(s, 6000)
    expect(s.stains).toHaveLength(0)
  })

  it('does not finish early', () => {
    let s = gym({
      staff: [staff({ targetUid: 's1', x: at(2, 2).x, z: at(2, 2).z })],
      stains: [stain()],
    })
    s = workStaff(s, 3000)
    expect(s.stains).toHaveLength(1)
  })

  it('does not work from across the room', () => {
    let s = gym({
      staff: [staff({ targetUid: 's1', x: at(7, 5).x, z: at(7, 5).z })],
      stains: [stain()],
    })
    s = workStaff(s, 60_000)
    expect(s.stains).toHaveLength(1)
  })

  it('restores a machine to full and charges nothing', () => {
    const before = gym({
      staff: [staff({ role: 'repair', targetUid: 'm1', x: at(4, 2).x, z: at(4, 2).z })],
      machines: [machine({ durability: 0 })],
      cash: 500,
    })
    const s = workStaff(before, 12_000)
    expect(s.machines[0]!.durability).toBe(100)
    expect(s.cash).toBe(500)
  })

  /**
   * A repaired machine still exists, so `targetTile` used to keep returning
   * its tile and `assignStaff` read the finished job as still live — the
   * repairer stayed pinned to the first machine they fixed and never took a
   * second one.
   */
  it('releases a repairer onto the next wreck once the first is fixed', () => {
    let s = gym({
      staff: [staff({ role: 'repair', targetUid: 'm1', x: at(4, 2).x, z: at(4, 2).z })],
      machines: [machine({ durability: 0 }), machine({ uid: 'm2', x: 5, y: 2, durability: 0 })],
    })

    s = workStaff(s, 12_000)
    expect(s.machines[0]!.durability).toBe(100)

    s = assignStaff(s)
    expect(s.staff[0]!.targetUid).toBe('m2')
  })

  it('keeps a repairer on a machine that is still broken', () => {
    const s = assignStaff(gym({
      staff: [staff({ role: 'repair', targetUid: 'm1', x: at(4, 2).x, z: at(4, 2).z })],
      machines: [machine({ durability: 0 }), machine({ uid: 'm2', x: 5, y: 2, durability: 0 })],
    }))
    expect(s.staff[0]!.targetUid).toBe('m1')
  })

  const receptionist = (over: Partial<Staff> = {}) =>
    staff({ role: 'reception', targetUid: 'd1', ...atDesk, ...over })

  const SCAN_MS = workMsFor('reception', 'rare')

  it('scans the queue once the scan time is up', () => {
    let s = gym({
      staff: [receptionist()],
      decor: [desk()],
      machines: [machine()],
      clients: [client()],
    })
    s = workStaff(s, SCAN_MS)
    expect(s.clients[0]!.phase).toBe('toMachine')
  })

  /**
   * The cycle used to be spent whether or not anybody was served, so somebody
   * walking in a frame after a scan completed waited a whole extra cycle for a
   * turn that had already come and gone.
   */
  it('holds a finished cycle when there is nobody to serve', () => {
    let s = gym({ staff: [receptionist()], decor: [desk()], machines: [machine()] })
    s = workStaff(s, SCAN_MS)
    expect(s.staff[0]!.workMs).toBe(SCAN_MS)

    s = { ...s, clients: [client()] }
    s = workStaff(s, 16)
    expect(s.clients[0]!.phase).toBe('toMachine')
    expect(s.staff[0]!.workMs).toBe(0)
  })

  it('holds the cycle rather than banking it while the queue stays empty', () => {
    let s = gym({ staff: [receptionist()], decor: [desk()], machines: [machine()] })
    for (let i = 0; i < 20; i++) s = workStaff(s, SCAN_MS)
    expect(s.staff[0]!.workMs).toBe(SCAN_MS)
    // And the waiting costs nothing: no new state sixty times a second.
    expect(workStaff(s, 100)).toBe(s)
  })

  it('holds the cycle when every machine is busy, too', () => {
    let s = gym({
      staff: [receptionist()],
      decor: [desk()],
      machines: [machine({ occupiedBy: 'c9' })],
      clients: [client()],
    })
    s = workStaff(s, SCAN_MS * 2)
    expect(s.clients[0]!.phase).toBe('queue')
    expect(s.staff[0]!.workMs).toBe(SCAN_MS)
  })

  // The receptionist runs the desk exactly as the player would, upsell and
  // all — otherwise hiring one quietly cost you every trainer booking.
  it('books a free trainer for whoever it admits', () => {
    let s = gym({
      staff: [receptionist(), staff({ uid: 'e2', role: 'trainer' })],
      decor: [desk()],
      machines: [machine()],
      clients: [client()],
    })
    s = workStaff(s, SCAN_MS)
    expect(s.clients[0]!.phase).toBe('toMachine')
    expect(s.clients[0]!.trainerUid).toBe('e2')
  })

  it('charges the trainer rate for a booking it made itself', () => {
    const base = gym({
      staff: [receptionist()],
      decor: [desk()],
      machines: [machine()],
      clients: [client()],
    })
    const withCoach = { ...base, staff: [...base.staff, staff({ uid: 'e2', role: 'trainer' })] }

    const plain = workStaff(base, SCAN_MS).cash - base.cash
    const coached = workStaff(withCoach, SCAN_MS).cash - withCoach.cash
    expect(coached).toBeCloseTo(plain * 1.5, 5)
  })

  it('admits people without a coach once every trainer is busy', () => {
    let s = gym({
      staff: [receptionist(), staff({ uid: 'e2', role: 'trainer' })],
      decor: [desk()],
      machines: [machine(), machine({ uid: 'm2' })],
      clients: [client({ uid: 'c1' }), client({ uid: 'c2' })],
    })
    s = workStaff(s, SCAN_MS)
    s = workStaff(s, SCAN_MS)

    const booked = s.clients.filter(c => c.trainerUid === 'e2')
    expect(booked).toHaveLength(1)
    expect(s.clients.every(c => c.phase === 'toMachine')).toBe(true)
  })

  it('serves whoever is closest to walking out', () => {
    let s = gym({
      staff: [receptionist()],
      decor: [desk()],
      machines: [machine()],
      clients: [
        client({ uid: 'fresh', phaseMs: 0 }),
        client({ uid: 'desperate', phaseMs: PATIENCE_MS - 500 }),
      ],
    })
    s = workStaff(s, SCAN_MS)
    expect(s.clients.find(c => c.uid === 'desperate')!.phase).toBe('toMachine')
    expect(s.clients.find(c => c.uid === 'fresh')!.phase).toBe('queue')
  })

  it('serves only the queue assigned to its own reception desk', () => {
    let s = gym({
      staff: [receptionist({ targetUid: 'd2', x: at(6, 0).x, z: at(6, 0).z })],
      decor: [desk(), desk({ uid: 'd2', x: 6 })],
      machines: [machine()],
      clients: [
        client({ uid: 'desperate', receptionUid: 'd1', phaseMs: PATIENCE_MS - 1 }),
        client({ uid: 'own-line', receptionUid: 'd2', phaseMs: 0 }),
      ],
    })

    s = workStaff(s, SCAN_MS)

    expect(s.clients.find(c => c.uid === 'desperate')!.phase).toBe('queue')
    expect(s.clients.find(c => c.uid === 'own-line')!.phase).toBe('toMachine')
  })

  it('lets two staffed desks scan their two queues in parallel', () => {
    let s = gym({
      staff: [
        receptionist({ uid: 'e1', targetUid: 'd1' }),
        receptionist({ uid: 'e2', targetUid: 'd2', x: at(6, 0).x, z: at(6, 0).z }),
      ],
      decor: [desk(), desk({ uid: 'd2', x: 6 })],
      machines: [machine(), machine({ uid: 'm2', x: 5 })],
      clients: [
        client({ uid: 'c1', receptionUid: 'd1' }),
        client({ uid: 'c2', receptionUid: 'd2' }),
      ],
    })

    s = workStaff(s, SCAN_MS)

    expect(s.clients.every(c => c.phase === 'toMachine')).toBe(true)
    expect(s.machines.every(m => m.occupiedBy !== null)).toBe(true)
  })

  it('never scans from a desk somebody else claimed', () => {
    const s = gym({
      staff: [receptionist({ targetUid: 'd-old' })],
      decor: [desk({ uid: 'd-new' })],
      machines: [machine()],
      clients: [client()],
    })
    expect(workStaff(s, SCAN_MS).clients[0]!.phase).toBe('queue')
  })

  /**
   * Coaching runs off the client's own visit, not off a work timer. Left to
   * fall through, a trainer standing by the kit would have started scanning
   * the queue from across the room.
   */
  it('never lets a trainer scan the queue', () => {
    const s = gym({
      staff: [staff({ role: 'trainer', targetUid: 'c1', ...atDesk })],
      decor: [desk()],
      machines: [machine()],
      clients: [client()],
    })
    expect(workStaff(s, 60_000).clients[0]!.phase).toBe('queue')
  })
})

describe('trainers', () => {
  const trainer = (over: Partial<Staff> = {}) => staff({ role: 'trainer', ...over })

  it('counts a trainer nobody has booked as free', () => {
    const s = gym({ staff: [trainer()], clients: [client()] })
    expect(freeTrainers(s).map(t => t.uid)).toEqual(['e1'])
    expect(isTrainerFree(s, 'e1')).toBe(true)
  })

  it('counts a trainer some client has named as busy', () => {
    const s = gym({ staff: [trainer()], clients: [client({ trainerUid: 'e1' })] })
    expect(freeTrainers(s)).toHaveLength(0)
    expect(isTrainerFree(s, 'e1')).toBe(false)
  })

  it('holds the booking from the moment it is made, before the client moves', () => {
    const s = gym({
      staff: [trainer()],
      clients: [client({ phase: 'queue', trainerUid: 'e1' })],
    })
    expect(isTrainerFree(s, 'e1')).toBe(false)
  })

  it('frees the trainer again once the client has gone', () => {
    const s = gym({ staff: [trainer()], clients: [] })
    expect(isTrainerFree(s, 'e1')).toBe(true)
  })

  it('never offers somebody on strike', () => {
    const s = gym({ staff: [trainer({ owed: 400 })] })
    expect(freeTrainers(s)).toHaveLength(0)
  })

  it('offers nobody but trainers', () => {
    const s = gym({ staff: [staff({ role: 'cleaner' }), staff({ uid: 'e2', role: 'repair' })] })
    expect(freeTrainers(s)).toHaveLength(0)
  })

  it('takes the client who booked them as the job', () => {
    const s = assignStaff(gym({
      staff: [trainer()],
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1', trainerUid: 'e1' })],
    }))
    expect(s.staff[0]!.targetUid).toBe('c1')
  })

  it('waits for the client to be sent to a machine before walking anywhere', () => {
    const s = assignStaff(gym({
      staff: [trainer()],
      clients: [client({ phase: 'queue', trainerUid: 'e1' })],
    }))
    expect(s.staff[0]!.targetUid).toBeNull()
  })

  it('takes no job from a client who booked somebody else', () => {
    const s = assignStaff(gym({
      staff: [trainer()],
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1', trainerUid: 'e9' })],
    }))
    expect(s.staff[0]!.targetUid).toBeNull()
  })

  it('is released the moment the booked client leaves', () => {
    const before = gym({
      staff: [trainer({ targetUid: 'c1' })],
      machines: [machine()],
      clients: [client({ phase: 'leaving', trainerUid: 'e1' })],
    })
    expect(targetTile(before, before.staff[0]!)).toBeNull()
    expect(assignStaff(before).staff[0]!.targetUid).toBeNull()
  })

  it('stands beside the client\'s machine rather than on top of them', () => {
    const s = gym({
      staff: [trainer({ targetUid: 'c1' })],
      machines: [machine({ x: 4, y: 2, occupiedBy: 'c1' })],
      clients: [client({ phase: 'workout', machineUid: 'm1', trainerUid: 'e1' })],
    })
    const tile = targetTile(s, s.staff[0]!)!
    expect(tile).not.toEqual({ x: 4, y: 2 })
    expect(Math.abs(tile.x - 4) + Math.abs(tile.y - 2)).toBe(1)
  })
})

describe('fire', () => {
  it('removes a paid employee', () => {
    const s = fire(gym({ staff: [staff()] }), 'e1')
    expect(s.staff).toHaveLength(0)
  })

  it('refuses to release somebody still owed wages', () => {
    const before = gym({ staff: [staff({ owed: 1500 })] })
    expect(fire(before, 'e1')).toBe(before)
  })
})

describe('payArrears', () => {
  it('clears the debt and puts them back to work', () => {
    const s = payArrears(gym({ staff: [staff({ owed: 1500 })], cash: 5000 }), 'e1')
    expect(s.staff[0]!.owed).toBe(0)
    expect(s.cash).toBe(3500)
    expect(onDuty(s.staff[0]!)).toBe(true)
  })

  it('does nothing when the player cannot cover it', () => {
    const before = gym({ staff: [staff({ owed: 1500 })], cash: 100 })
    expect(payArrears(before, 'e1')).toBe(before)
  })
})

describe('hire', () => {
  it('takes the price off cash and puts the candidate on the payroll', () => {
    const before = gym({ candidates: [candidate({ price: 900 })], cash: 2000 })
    const s = hire(before, 'k1')
    expect(s.cash).toBe(1100)
    expect(s.staff).toHaveLength(1)
    expect(s.staff[0]!.name).toBe('Marta K.')
    expect(s.candidates).toHaveLength(0)
    expect(s.stats.totalSpent).toBe(before.stats.totalSpent + 900)
  })

  it('refuses when the player cannot afford the hire', () => {
    const before = gym({ candidates: [candidate({ price: 900 })], cash: 100 })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('refuses below the staff unlock level', () => {
    const before = gym({ level: STAFF_UNLOCK_LEVEL - 1, candidates: [candidate()], cash: 100_000 })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('refuses an unknown candidate', () => {
    const before = gym({ candidates: [candidate()], cash: 100_000 })
    expect(hire(before, 'nope')).toBe(before)
  })

  it('refuses once the payroll is full', () => {
    const full = Array.from({ length: 5 }, (_, i) => ({
      uid: `e${i}`, name: 'X', role: 'cleaner' as const, rank: 'rare' as const,
      x: 0, z: 0, path: [], goal: null, targetUid: null, workMs: 0, owed: 0,
    }))
    const before = gym({ staff: full, candidates: [candidate()], cash: 100_000 })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('refuses a receptionist when there is no desk', () => {
    const before = gym({ candidates: [candidate({ role: 'reception' })], cash: 100_000, decor: [] })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('takes on a trainer at the trainer unlock, long before the rest', () => {
    const before = gym({
      level: TRAINER_UNLOCK_LEVEL,
      candidates: [candidate({ role: 'trainer' })],
      cash: 100_000,
    })
    expect(hire(before, 'k1').staff).toHaveLength(1)
  })

  it('still refuses everybody else at that level', () => {
    const before = gym({
      level: TRAINER_UNLOCK_LEVEL,
      candidates: [candidate({ role: 'cleaner' })],
      cash: 100_000,
    })
    expect(hire(before, 'k1')).toBe(before)
  })

  it('refuses a trainer below the trainer unlock', () => {
    const before = gym({
      level: TRAINER_UNLOCK_LEVEL - 1,
      candidates: [candidate({ role: 'trainer' })],
      cash: 100_000,
    })
    expect(hire(before, 'k1')).toBe(before)
  })
})

describe('restTileFor', () => {
  it('sends everybody to the same doorstep, out in the aisle', () => {
    expect(restTileFor()).toEqual(staffDoorTile())
    expect(restTileFor().x).toBeLessThan(0)
  })

  // Standing on the doorstep is the whole of being off shift: there is nothing
  // behind the door, and the renderer keys off exactly this.
  it('recognises the doorstep it sends them to', () => {
    const door = staffDoorTile()
    expect(isAtStaffDoor(at(door.x, door.y).x, at(door.x, door.y).z)).toBe(true)
  })

  it('counts anywhere on the gym floor as being out and visible', () => {
    expect(isAtStaffDoor(at(4, 2).x, at(4, 2).z)).toBe(false)
    expect(isAtStaffDoor(at(-1, 3).x, at(-1, 3).z)).toBe(false)
  })
})


describe('staffLimit', () => {
  const oneFloor = (expansion: number): GameState => ({
    ...initialState(1, 0),
    expansion,
    activeFloor: 0,
    floorPlans: [{ expansion, machines: [], decor: [], walls: [], stains: [], clients: [] }],
  })

  const twoFloors = (ground: number, upper: number): GameState => ({
    ...oneFloor(ground),
    floorPlans: [
      { expansion: ground, machines: [], decor: [], walls: [], stains: [], clients: [] },
      { expansion: upper, machines: [], decor: [], walls: [], stains: [], clients: [] },
    ],
  })

  it('allows the five the game always did in an unexpanded starting hall', () => {
    expect(staffLimit(oneFloor(0))).toBe(5)
  })

  it('adds two for every expansion rung bought', () => {
    expect(staffLimit(oneFloor(1))).toBe(7)
    expect(staffLimit(oneFloor(2))).toBe(9)
    expect(staffLimit(oneFloor(3))).toBe(11)
  })

  it('gives a second storey its own five, and its own room to expand', () => {
    expect(staffLimit(twoFloors(0, 0))).toBe(10)
    expect(staffLimit(twoFloors(3, 0))).toBe(16)
    expect(staffLimit(twoFloors(3, 3))).toBe(22)
  })

  /**
   * The engine mirrors the active storey at the top level and leaves the others
   * in their plans. Reading `state.expansion` alone would drop the cap the
   * moment the player stepped upstairs into a room they had not expanded — and
   * with it, silently, their ability to replace anybody they sacked.
   */
  it('does not change when the player merely walks up the stairs', () => {
    const downstairs = twoFloors(3, 1)
    const upstairs: GameState = { ...downstairs, activeFloor: 1, expansion: 1 }
    expect(staffLimit(upstairs)).toBe(staffLimit(downstairs))
  })

  it('clamps a hand-edited rung rather than handing out a wild cap', () => {
    expect(staffLimit(oneFloor(99))).toBe(11)
    expect(staffLimit(oneFloor(-3))).toBe(5)
  })

  it('reads a state built without any floor plans as the one floor it is', () => {
    const bare = { ...initialState(1, 0), expansion: 2, floorPlans: [] }
    expect(staffLimit(bare)).toBe(9)
  })

  it('is what hiring actually enforces', () => {
    const room = oneFloor(0)
    const full: GameState = {
      ...room,
      level: STAFF_UNLOCK_LEVEL,
      cash: 100_000,
      staff: Array.from({ length: staffLimit(room) }, (_, i) => staff({ uid: `e${i}` })),
      candidates: [candidate({ uid: 'k9' })],
    }
    expect(hire(full, 'k9')).toBe(full)

    // The same payroll on an expanded floor has room for more. Only the room
    // changes here — spreading a fresh `oneFloor` over this would also reset
    // the level and the cash that hiring checks first.
    const expanded: GameState = {
      ...full,
      expansion: 2,
      floorPlans: [{ expansion: 2, machines: [], decor: [], walls: [], stains: [], clients: [] }],
    }
    expect(hire(expanded, 'k9').staff).toHaveLength(full.staff.length + 1)
  })
})


describe('reception desks', () => {
  const withDesks = (n: number, receptionists = 0): GameState => ({
    ...initialState(1, 0),
    level: STAFF_UNLOCK_LEVEL,
    cash: 100_000,
    decor: Array.from({ length: n }, (_, i) => desk({ uid: `d${i}`, x: 1, y: 1 + i * 2 })),
    staff: Array.from({ length: receptionists }, (_, i) =>
      staff({ uid: `e${i}`, role: 'reception' })),
  })

  it('counts only counters somebody can actually stand at', () => {
    expect(staffedDesks(withDesks(3))).toHaveLength(3)
    expect(freeDesks(withDesks(3))).toBe(3)
  })

  it('treats a desk that already has somebody as taken', () => {
    expect(freeDesks(withDesks(3, 2))).toBe(1)
    expect(freeDesks(withDesks(3, 3))).toBe(0)
  })

  /**
   * `pickJob` hands one counter to one receptionist, so a fourth hire in a
   * three-desk gym scans nothing and just draws a wage every evening. Hiring
   * already refused with no desk at all; this is that rule counted properly.
   */
  it('refuses a receptionist there is no free desk for', () => {
    const staffed = {
      ...withDesks(2, 2),
      candidates: [candidate({ uid: 'k9', role: 'reception' })],
    }
    expect(hire(staffed, 'k9')).toBe(staffed)
  })

  it('allows the hire as soon as another desk is put in', () => {
    const roomy = {
      ...withDesks(3, 2),
      candidates: [candidate({ uid: 'k9', role: 'reception' })],
    }
    expect(hire(roomy, 'k9').staff).toHaveLength(3)
  })

  it('still lets other roles be hired with every desk staffed', () => {
    const staffed = {
      ...withDesks(1, 1),
      candidates: [candidate({ uid: 'k9', role: 'cleaner' })],
    }
    expect(hire(staffed, 'k9').staff).toHaveLength(2)
  })

  it('gives each receptionist their own desk rather than doubling up', () => {
    const assigned = assignStaff(withDesks(3, 3))
    const claimed = assigned.staff.map(s => s.targetUid)
    expect(new Set(claimed).size).toBe(3)
    expect(claimed).not.toContain(null)
  })
})
