# IRON EMPIRE v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable gym-tycoon web game — empty room, $500, buy machines, serve clients by hand, survive debt — packaged so it can ship to the App Store and Google Play.

**Architecture:** A pure-TypeScript engine under `src/game/` holds all rules and knows nothing about React, the DOM, or the wall clock; time enters only as a `dtMs` parameter and randomness only through a seed stored in state, which makes the whole simulation deterministic and unit-testable. A thin Zustand store drives that engine from a `requestAnimationFrame` loop and is the only place that touches real time. React components read state and render — they contain no game rules.

**Tech Stack:** Vite 7, React 19, TypeScript 5, Zustand 5, Vitest 3, Capacitor 7, `@capacitor/preferences`.

## Global Constraints

- Grid is 8 wide × 6 tall. One game day = 180 000 ms real time.
- Starting cash is 500. Debt floor is −20 000; crossing it ends the run with the message "Komornik wbił".
- Offline settlement: income and costs both at 100%, capped at 8 hours.
- Client patience in the queue is 8000 ms.
- All player-facing copy is Polish.
- Engine files under `src/game/` must not import React, or reference `window`, `Date`, or `Math.random`.
- Touch targets at least 44 px. Portrait only. `safe-area-inset` respected. No hover-only interactions.
- Every task ends green: `npm test` and `npx tsc --noEmit` both pass before committing.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/game/constants.ts`
- Test: `src/game/constants.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm run dev`, `npm run build`, `npm test`, and the shared constants every later task imports.

- [ ] **Step 1: Scaffold and install**

```bash
cd ~/iron-empire
npm create vite@latest . -- --template react-ts
npm install
npm install zustand @capacitor/core @capacitor/preferences
npm install -D vitest @capacitor/cli
```

- [ ] **Step 2: Add the test script and Vitest config**

In `package.json` scripts add `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`.
In `vite.config.ts` add `test: { environment: 'node', include: ['src/**/*.test.ts'] }` plus the `/// <reference types="vitest" />` directive.

- [ ] **Step 3: Write a failing test**

```ts
import { describe, it, expect } from 'vitest'
import { GRID_W, GRID_H, DEBT_LIMIT, START_CASH } from './constants'

describe('constants', () => {
  it('defines an 8x6 grid', () => {
    expect(GRID_W).toBe(8)
    expect(GRID_H).toBe(6)
  })
  it('starts the player with 500', () => {
    expect(START_CASH).toBe(500)
  })
  it('puts the debt floor at -20000', () => {
    expect(DEBT_LIMIT).toBe(-20_000)
  })
})
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./constants`.

- [ ] **Step 5: Create `src/game/constants.ts`**

```ts
export const GRID_W = 8
export const GRID_H = 6
export const DAY_MS = 180_000
export const START_CASH = 500
export const DEBT_LIMIT = -20_000
export const PATIENCE_MS = 8_000
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
export const DAILY_RENT = 60
export const SAVE_VERSION = 1
export const SAVE_KEY = 'iron-empire-save'
export const XP_PER_LEVEL = 100
export const MAX_STEP_MS = 1_000
export const AUTOSAVE_MS = 5_000
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/game/rng.ts`
- Test: `src/game/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `nextRandom(seed: number): [value: number, nextSeed: number]` with `value` in `[0, 1)`. Every caller threads the returned seed back into state — there is no hidden mutable RNG anywhere in the engine.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { nextRandom } from './rng'

describe('nextRandom', () => {
  it('returns a value in [0,1)', () => {
    const [v] = nextRandom(1)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(1)
  })

  it('is deterministic for the same seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42))
  })

  it('advances the seed so successive draws differ', () => {
    const [v1, s1] = nextRandom(42)
    const [v2] = nextRandom(s1)
    expect(v2).not.toBe(v1)
  })

  it('spreads values across the range', () => {
    let seed = 1
    let below = 0
    for (let i = 0; i < 500; i++) {
      const [v, s] = nextRandom(seed)
      seed = s
      if (v < 0.5) below++
    }
    expect(below).toBeGreaterThan(150)
    expect(below).toBeLessThan(350)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test src/game/rng.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement mulberry32**

```ts
export function nextRandom(seed: number): [number, number] {
  const t = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t]
}
```

- [ ] **Step 4: Run tests**

Run: `npm test src/game/rng.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: seeded deterministic RNG"
```

---

### Task 3: Types and equipment catalogue

**Files:**
- Create: `src/game/types.ts`, `src/game/content/machines.ts`
- Test: `src/game/content/machines.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the shared type vocabulary used by every later task.

```ts
export type MachineTypeId =
  | 'dumbbells' | 'bench' | 'treadmill' | 'latpulldown' | 'bike' | 'cable'

export interface MachineType {
  id: MachineTypeId
  name: string          // Polish, shown in the shop
  price: number
  powerPerDay: number   // dollars per game day while owned
  workoutMs: number     // game ms a client spends on it
  satisfaction: number  // 0-100 contribution per completed workout
  wearPerUse: number    // durability lost per completed workout
  repairCost: number
  minLevel: number
  xpPerUse: number
}

export interface Machine {
  uid: string
  type: MachineTypeId
  x: number
  y: number
  durability: number        // 0-100; 0 means out of service
  occupiedBy: string | null // client uid
}

export type ClientPhase = 'queue' | 'workout'

export interface Client {
  uid: string
  phase: ClientPhase
  phaseMs: number        // ms elapsed in the current phase
  machineUid: string | null
}

export interface GameStats {
  totalEarned: number
  totalSpent: number
  clientsServed: number
  clientsLost: number
  daysPassed: number
}

export interface GameState {
  version: number
  cash: number
  reputation: number    // 0-100
  satisfaction: number  // 0-100
  level: number
  xp: number
  machines: Machine[]
  clients: Client[]
  seed: number
  elapsedMs: number
  lastSeenAt: number    // epoch ms, written by the store, never by the engine
  gameOver: boolean
  stats: GameStats
  nextUid: number
}
```

- [ ] **Step 1: Write the failing catalogue test**

```ts
import { describe, it, expect } from 'vitest'
import { MACHINE_TYPES, machineType } from './machines'
import { START_CASH } from '../constants'

describe('machine catalogue', () => {
  it('has a machine affordable with the starting cash', () => {
    const cheapest = Math.min(...MACHINE_TYPES.map(m => m.price))
    expect(cheapest).toBeLessThanOrEqual(START_CASH)
  })

  it('unlocks at least one machine at level 1', () => {
    expect(MACHINE_TYPES.filter(m => m.minLevel === 1).length).toBeGreaterThan(0)
  })

  it('looks a machine up by id', () => {
    expect(machineType('dumbbells').name).toBe('Hantle')
  })

  it('throws on an unknown id', () => {
    // @ts-expect-error deliberately invalid id
    expect(() => machineType('nope')).toThrow()
  })

  it('gives every machine sane economics', () => {
    for (const m of MACHINE_TYPES) {
      expect(m.price).toBeGreaterThan(0)
      expect(m.workoutMs).toBeGreaterThan(0)
      expect(m.wearPerUse).toBeGreaterThan(0)
      expect(m.repairCost).toBeGreaterThan(0)
      expect(m.minLevel).toBeGreaterThanOrEqual(1)
    }
  })

  it('has unique ids', () => {
    expect(new Set(MACHINE_TYPES.map(m => m.id)).size).toBe(MACHINE_TYPES.length)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test src/game/content/machines.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the catalogue**

```ts
import type { MachineType, MachineTypeId } from '../types'

export const MACHINE_TYPES: MachineType[] = [
  { id: 'dumbbells',   name: 'Hantle',              price: 350,  powerPerDay: 2,  workoutMs: 12_000, satisfaction: 6,  wearPerUse: 0.6, repairCost: 90,  minLevel: 1, xpPerUse: 4 },
  { id: 'bench',       name: 'Ławka płaska',        price: 420,  powerPerDay: 3,  workoutMs: 15_000, satisfaction: 8,  wearPerUse: 0.8, repairCost: 110, minLevel: 1, xpPerUse: 5 },
  { id: 'treadmill',   name: 'Bieżnia',             price: 600,  powerPerDay: 12, workoutMs: 20_000, satisfaction: 11, wearPerUse: 1.4, repairCost: 180, minLevel: 2, xpPerUse: 7 },
  { id: 'latpulldown', name: 'Wyciąg górny',        price: 780,  powerPerDay: 6,  workoutMs: 18_000, satisfaction: 13, wearPerUse: 1.0, repairCost: 200, minLevel: 3, xpPerUse: 9 },
  { id: 'bike',        name: 'Rower spinningowy',   price: 540,  powerPerDay: 9,  workoutMs: 17_000, satisfaction: 10, wearPerUse: 1.2, repairCost: 150, minLevel: 4, xpPerUse: 7 },
  { id: 'cable',       name: 'Brama wielofunkcyjna', price: 1200, powerPerDay: 14, workoutMs: 22_000, satisfaction: 18, wearPerUse: 1.1, repairCost: 320, minLevel: 5, xpPerUse: 13 },
]

const BY_ID = new Map<MachineTypeId, MachineType>(MACHINE_TYPES.map(m => [m.id, m]))

export function machineType(id: MachineTypeId): MachineType {
  const t = BY_ID.get(id)
  if (!t) throw new Error(`Unknown machine type: ${id}`)
  return t
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: game types and equipment catalogue"
```

---

### Task 4: Economy

**Files:**
- Create: `src/game/economy.ts`
- Test: `src/game/economy.test.ts`

**Interfaces:**
- Consumes: `GameState` and `machineType` (Task 3); `DAILY_RENT`, `DEBT_LIMIT`, `XP_PER_LEVEL`, `SAVE_VERSION` (Task 1).
- Produces:
  - `initialState(seed: number, now: number): GameState`
  - `entryFee(reputation: number): number`
  - `dailyCosts(state: GameState): number`
  - `chargeCosts(state: GameState, dtMs: number): GameState`
  - `addXp(state: GameState, amount: number): GameState`

Costs accrue continuously, pro-rated by `dtMs / DAY_MS`, so a partial tick charges a partial day. `chargeCosts` sets `gameOver` when cash falls strictly below `DEBT_LIMIT`, and never mutates its input.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { entryFee, dailyCosts, chargeCosts, addXp, initialState } from './economy'
import { DAY_MS, DAILY_RENT, DEBT_LIMIT, START_CASH } from './constants'
import type { Machine } from './types'

const base = () => initialState(1, 0)
const treadmill: Machine = { uid: 'm1', type: 'treadmill', x: 0, y: 0, durability: 100, occupiedBy: null }

describe('entryFee', () => {
  it('is cheapest at zero reputation and dearest at full', () => {
    expect(entryFee(0)).toBeLessThan(entryFee(100))
  })
  it('is always positive', () => {
    expect(entryFee(0)).toBeGreaterThan(0)
  })
  it('clamps out-of-range reputation', () => {
    expect(entryFee(-50)).toBe(entryFee(0))
    expect(entryFee(500)).toBe(entryFee(100))
  })
})

describe('dailyCosts', () => {
  it('is just rent for an empty gym', () => {
    expect(dailyCosts(base())).toBe(DAILY_RENT)
  })
  it('grows when a machine is added', () => {
    expect(dailyCosts({ ...base(), machines: [treadmill] })).toBeGreaterThan(DAILY_RENT)
  })
})

describe('chargeCosts', () => {
  it('charges a full day over DAY_MS', () => {
    expect(chargeCosts(base(), DAY_MS).cash).toBeCloseTo(START_CASH - DAILY_RENT, 5)
  })

  it('pro-rates a partial day', () => {
    expect(chargeCosts(base(), DAY_MS / 2).cash).toBeCloseTo(START_CASH - DAILY_RENT / 2, 5)
  })

  it('does not mutate its input', () => {
    const s = base()
    chargeCosts(s, DAY_MS)
    expect(s.cash).toBe(START_CASH)
  })

  it('lets cash go negative without ending the game', () => {
    const s = chargeCosts({ ...base(), cash: 10 }, DAY_MS)
    expect(s.cash).toBeLessThan(0)
    expect(s.gameOver).toBe(false)
  })

  it('ends the game below the debt limit', () => {
    expect(chargeCosts({ ...base(), cash: DEBT_LIMIT + 1 }, DAY_MS).gameOver).toBe(true)
  })

  it('does not end the game exactly at the debt limit', () => {
    const s = chargeCosts({ ...base(), cash: DEBT_LIMIT + DAILY_RENT }, DAY_MS)
    expect(s.cash).toBeCloseTo(DEBT_LIMIT, 5)
    expect(s.gameOver).toBe(false)
  })

  it('records what was spent', () => {
    expect(chargeCosts(base(), DAY_MS).stats.totalSpent).toBeCloseTo(DAILY_RENT, 5)
  })
})

describe('addXp', () => {
  it('levels up once the threshold is crossed', () => {
    expect(addXp(base(), 100).level).toBe(2)
  })
  it('carries the remainder into the new level', () => {
    const s = addXp(base(), 130)
    expect(s.level).toBe(2)
    expect(s.xp).toBe(30)
  })
  it('handles several levels in one award', () => {
    expect(addXp(base(), 250).level).toBe(3)
  })
  it('does not level up below the threshold', () => {
    expect(addXp(base(), 99).level).toBe(1)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test src/game/economy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { GameState } from './types'
import { machineType } from './content/machines'
import { DAY_MS, DAILY_RENT, DEBT_LIMIT, START_CASH, XP_PER_LEVEL, SAVE_VERSION } from './constants'

export function initialState(seed: number, now: number): GameState {
  return {
    version: SAVE_VERSION,
    cash: START_CASH,
    reputation: 0,
    satisfaction: 50,
    level: 1,
    xp: 0,
    machines: [],
    clients: [],
    seed,
    elapsedMs: 0,
    lastSeenAt: now,
    gameOver: false,
    stats: { totalEarned: 0, totalSpent: 0, clientsServed: 0, clientsLost: 0, daysPassed: 0 },
    nextUid: 1,
  }
}

export function entryFee(reputation: number): number {
  return 8 + Math.max(0, Math.min(100, reputation)) * 0.12
}

export function dailyCosts(state: GameState): number {
  const power = state.machines.reduce((sum, m) => sum + machineType(m.type).powerPerDay, 0)
  return DAILY_RENT + power
}

export function chargeCosts(state: GameState, dtMs: number): GameState {
  const cost = dailyCosts(state) * (dtMs / DAY_MS)
  const cash = state.cash - cost
  return {
    ...state,
    cash,
    gameOver: state.gameOver || cash < DEBT_LIMIT,
    stats: { ...state.stats, totalSpent: state.stats.totalSpent + cost },
  }
}

export function addXp(state: GameState, amount: number): GameState {
  let xp = state.xp + amount
  let level = state.level
  while (xp >= XP_PER_LEVEL) {
    xp -= XP_PER_LEVEL
    level += 1
  }
  return { ...state, xp, level }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: economy — fees, costs, debt limit, levelling"
```

---

### Task 5: Clients

**Files:**
- Create: `src/game/clients.ts`
- Test: `src/game/clients.test.ts`

**Interfaces:**
- Consumes: `nextRandom` (Task 2); types and `machineType` (Task 3); `entryFee`, `addXp`, `initialState` (Task 4); `PATIENCE_MS` (Task 1).
- Produces:
  - `spawnClients(state: GameState, dtMs: number): GameState`
  - `advanceClients(state: GameState, dtMs: number): GameState`
  - `scanClient(state: GameState, clientUid: string): GameState`

Rules. Clients only appear when a working, unoccupied machine exists — an empty gym attracts nobody, which is what makes the opening purchase meaningful. Spawn probability per tick rises with reputation. A queued client whose `phaseMs` exceeds `PATIENCE_MS` leaves: `clientsLost` rises, reputation and satisfaction fall. `scanClient` is the player's tap — it charges the entry fee, awards XP, and moves the client onto a free working machine; with no free machine it is a no-op. Finishing a workout raises satisfaction and reputation, wears the machine, awards XP, frees the machine, and removes the client. A machine hitting zero durability goes out of service. Reputation, satisfaction, and durability are clamped on every write.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { spawnClients, advanceClients, scanClient } from './clients'
import { initialState } from './economy'
import { PATIENCE_MS } from './constants'
import type { GameState, Machine } from './types'

const machine = (over: Partial<Machine> = {}): Machine =>
  ({ uid: 'm1', type: 'dumbbells', x: 0, y: 0, durability: 100, occupiedBy: null, ...over })

const gym = (): GameState => ({ ...initialState(7, 0), machines: [machine()] })

describe('spawnClients', () => {
  it('never spawns into a gym with no machines', () => {
    let s = initialState(7, 0)
    for (let i = 0; i < 200; i++) s = spawnClients(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('never spawns when every machine is broken', () => {
    let s: GameState = { ...gym(), machines: [machine({ durability: 0 })] }
    for (let i = 0; i < 200; i++) s = spawnClients(s, 1000)
    expect(s.clients).toHaveLength(0)
  })

  it('eventually spawns when a free working machine exists', () => {
    let s = gym()
    for (let i = 0; i < 300 && s.clients.length === 0; i++) s = spawnClients(s, 1000)
    expect(s.clients.length).toBeGreaterThan(0)
  })

  it('is deterministic for a given seed', () => {
    let a = gym(); let b = gym()
    for (let i = 0; i < 50; i++) { a = spawnClients(a, 1000); b = spawnClients(b, 1000) }
    expect(a).toEqual(b)
  })
})

describe('queue patience', () => {
  it('drops an unscanned client after PATIENCE_MS and hurts reputation', () => {
    const s0: GameState = { ...gym(), reputation: 50,
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    const s = advanceClients(s0, PATIENCE_MS + 1)
    expect(s.clients).toHaveLength(0)
    expect(s.stats.clientsLost).toBe(1)
    expect(s.reputation).toBeLessThan(50)
  })

  it('keeps a client who still has patience', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    expect(advanceClients(s0, PATIENCE_MS - 1).clients).toHaveLength(1)
  })

  it('never drives reputation below zero', () => {
    let s: GameState = { ...gym(), reputation: 0,
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    s = advanceClients(s, PATIENCE_MS + 1)
    expect(s.reputation).toBeGreaterThanOrEqual(0)
  })
})

describe('scanClient', () => {
  it('charges the fee and puts the client on a machine', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    const s = scanClient(s0, 'c1')
    expect(s.cash).toBeGreaterThan(s0.cash)
    expect(s.stats.totalEarned).toBeGreaterThan(0)
    expect(s.clients[0].phase).toBe('workout')
    expect(s.clients[0].machineUid).toBe('m1')
    expect(s.machines[0].occupiedBy).toBe('c1')
  })

  it('resets the phase timer when the client starts training', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 5000, machineUid: null }] }
    expect(scanClient(s0, 'c1').clients[0].phaseMs).toBe(0)
  })

  it('is a no-op when every machine is busy', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'other' })],
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    const s = scanClient(s0, 'c1')
    expect(s.clients[0].phase).toBe('queue')
    expect(s.cash).toBe(s0.cash)
  })

  it('is a no-op when the only machine is broken', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ durability: 0 })],
      clients: [{ uid: 'c1', phase: 'queue', phaseMs: 0, machineUid: null }] }
    expect(scanClient(s0, 'c1').clients[0].phase).toBe('queue')
  })

  it('ignores an unknown client id', () => {
    const s0 = gym()
    expect(scanClient(s0, 'nope')).toEqual(s0)
  })

  it('ignores a client who is already training', () => {
    const s0: GameState = { ...gym(),
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(scanClient(s0, 'c1')).toEqual(s0)
  })
})

describe('workout completion', () => {
  it('frees the machine, wears it, and pays out satisfaction and xp', () => {
    const s0: GameState = { ...gym(), satisfaction: 50,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    const s = advanceClients(s0, 99_000)
    expect(s.clients).toHaveLength(0)
    expect(s.machines[0].occupiedBy).toBeNull()
    expect(s.machines[0].durability).toBeLessThan(100)
    expect(s.stats.clientsServed).toBe(1)
    expect(s.xp + (s.level - 1) * 100).toBeGreaterThan(0)
  })

  it('does not finish a workout early', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(advanceClients(s0, 1_000).clients).toHaveLength(1)
  })

  it('takes a machine out of service at zero durability without going negative', () => {
    const s0: GameState = { ...gym(),
      machines: [machine({ occupiedBy: 'c1', durability: 0.1 })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(advanceClients(s0, 99_000).machines[0].durability).toBe(0)
  })

  it('never drives satisfaction above 100', () => {
    const s0: GameState = { ...gym(), satisfaction: 99,
      machines: [machine({ occupiedBy: 'c1' })],
      clients: [{ uid: 'c1', phase: 'workout', phaseMs: 0, machineUid: 'm1' }] }
    expect(advanceClients(s0, 99_000).satisfaction).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test src/game/clients.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/game/clients.ts`**

Write the three functions to satisfy the rules and tests above. Keep them pure: take state, return new state, thread `seed` through `nextRandom`, and allocate client uids from `state.nextUid`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: client spawning, queue patience, scanning, workouts"
```

---

### Task 6: Tick pipeline

**Files:**
- Create: `src/game/tick.ts`
- Test: `src/game/tick.test.ts`

**Interfaces:**
- Consumes: `spawnClients`, `advanceClients` (Task 5); `chargeCosts` (Task 4); `MAX_STEP_MS`, `DAY_MS` (Task 1).
- Produces: `advance(state: GameState, dtMs: number): GameState`.

`advance` runs the pipeline `[spawnClients, advanceClients, chargeCosts]`, adds `dtMs` to `elapsedMs`, and derives `stats.daysPassed` from `elapsedMs`. It splits any `dtMs` larger than `MAX_STEP_MS` into whole steps so a long pause cannot skip an entire client visit in one jump. It returns state untouched once `gameOver` is set. Adding a v2 system means appending one function to the pipeline array.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { advance } from './tick'
import { initialState } from './economy'
import { DAY_MS } from './constants'

describe('advance', () => {
  it('is deterministic', () => {
    expect(advance(initialState(9, 0), 5_000)).toEqual(advance(initialState(9, 0), 5_000))
  })

  it('accumulates elapsed time', () => {
    expect(advance(initialState(9, 0), 5_000).elapsedMs).toBe(5_000)
  })

  it('counts whole days only', () => {
    expect(advance(initialState(9, 0), DAY_MS).stats.daysPassed).toBe(1)
    expect(advance(initialState(9, 0), DAY_MS - 1).stats.daysPassed).toBe(0)
  })

  it('splits a long step so results match many small steps', () => {
    let stepwise = initialState(9, 0)
    for (let i = 0; i < 10; i++) stepwise = advance(stepwise, 1_000)
    expect(advance(initialState(9, 0), 10_000).cash).toBeCloseTo(stepwise.cash, 5)
  })

  it('freezes once the game is over', () => {
    const dead = { ...initialState(9, 0), gameOver: true }
    expect(advance(dead, 10_000)).toEqual(dead)
  })

  it('handles a zero-length step', () => {
    const s = initialState(9, 0)
    expect(advance(s, 0)).toEqual(s)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test src/game/tick.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement, then run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: deterministic tick pipeline"
```

---

### Task 7: Save, migration, and offline settlement

**Files:**
- Create: `src/game/save.ts`, `src/game/offline.ts`
- Test: `src/game/save.test.ts`, `src/game/offline.test.ts`

**Interfaces:**
- Consumes: `advance` (Task 6); `initialState` (Task 4); `SAVE_VERSION`, `OFFLINE_CAP_MS` (Task 1).
- Produces:
  - `serialize(state: GameState): string`
  - `deserialize(raw: string, now: number): GameState` — returns a fresh state on unparseable, malformed, or unknown-version input rather than throwing, so a corrupt save can never brick the app.
  - `settleOffline(state: GameState, now: number): { state: GameState; earned: number; awayMs: number }`

`settleOffline` advances the engine by `min(now - lastSeenAt, OFFLINE_CAP_MS)` at full income and full costs, stamps `lastSeenAt` to `now`, and reports cash earned so the UI can show a welcome-back summary. If settlement breaches the debt limit, the returned state has `gameOver` set.

- [ ] **Step 1: Write the failing tests**

```ts
// src/game/save.test.ts
import { describe, it, expect } from 'vitest'
import { serialize, deserialize } from './save'
import { initialState } from './economy'
import { SAVE_VERSION } from './constants'

describe('save round-trip', () => {
  it('restores an identical state', () => {
    const s = initialState(3, 1000)
    expect(deserialize(serialize(s), 1000)).toEqual(s)
  })
  it('falls back to a fresh state on garbage', () => {
    expect(deserialize('not json', 0).version).toBe(SAVE_VERSION)
  })
  it('falls back to a fresh state on a future version', () => {
    expect(deserialize(JSON.stringify({ ...initialState(3, 0), version: 999 }), 0).version).toBe(SAVE_VERSION)
  })
  it('falls back to a fresh state when required fields are missing', () => {
    expect(deserialize(JSON.stringify({ version: SAVE_VERSION }), 0).cash).toBe(initialState(0, 0).cash)
  })
})
```

```ts
// src/game/offline.test.ts
import { describe, it, expect } from 'vitest'
import { settleOffline } from './offline'
import { initialState } from './economy'
import { OFFLINE_CAP_MS, DEBT_LIMIT, DAY_MS, DAILY_RENT } from './constants'

describe('settleOffline', () => {
  it('reports no time away when the player just left', () => {
    expect(settleOffline(initialState(5, 1000), 1000).awayMs).toBe(0)
  })

  it('never reports negative time for a clock that moved backwards', () => {
    expect(settleOffline(initialState(5, 5000), 1000).awayMs).toBe(0)
  })

  it('caps time away at 8 hours', () => {
    expect(settleOffline(initialState(5, 0), OFFLINE_CAP_MS * 3).awayMs).toBe(OFFLINE_CAP_MS)
  })

  it('charges rent for the time away', () => {
    const s0 = initialState(5, 0)
    expect(settleOffline(s0, DAY_MS).state.cash).toBeCloseTo(s0.cash - DAILY_RENT, 5)
  })

  it('ends the game when settlement breaches the debt limit', () => {
    const s0 = { ...initialState(5, 0), cash: DEBT_LIMIT + 1 }
    expect(settleOffline(s0, OFFLINE_CAP_MS).state.gameOver).toBe(true)
  })

  it('stamps lastSeenAt to now', () => {
    expect(settleOffline(initialState(5, 0), 50_000).state.lastSeenAt).toBe(50_000)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test src/game/save.test.ts src/game/offline.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement, then run tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: save serialization, corrupt-save fallback, offline settlement"
```

---

### Task 8: Store and persistence

**Files:**
- Create: `src/store/storage.ts`, `src/store/gameStore.ts`

**Interfaces:**
- Consumes: everything under `src/game/`.
- Produces: a Zustand store exposing `state: GameState`, `welcomeBack: { earned: number; awayMs: number } | null`, and actions:
  - `buyMachine(type: MachineTypeId, x: number, y: number): void`
  - `scan(clientUid: string): void`
  - `repair(machineUid: string): void`
  - `dismissWelcome(): void`
  - `restart(): void`
  - `start(): void` / `stop(): void`

`storage.ts` wraps `@capacitor/preferences` so one call path works in the browser and natively. `gameStore.ts` owns the only `requestAnimationFrame` loop and the only `Date.now()` calls, autosaves every `AUTOSAVE_MS`, settles offline time on load, and pauses on `visibilitychange` so a backgrounded tab does not drain battery. `buyMachine` refuses when the tile is taken, the level is too low, or cash is short. `repair` refuses when cash is short.

- [ ] **Step 1: Implement both files**
- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: zustand store, RAF loop, autosave, offline settle on load"
```

---

### Task 9: Asset layer

**Files:**
- Create: `src/assets/assetFor.tsx`

**Interfaces:**
- Consumes: `MachineTypeId` (Task 3).
- Produces: `assetFor(id: AssetId): React.FC<{ className?: string }>` where
  `type AssetId = MachineTypeId | 'client' | 'floor' | 'logo'`.

No component outside this folder may reference an image file directly. Swapping in generated artwork later means editing only this folder.

- [ ] **Step 1: Implement SVG placeholders and the lookup**
- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit && git add -A && git commit -m "feat: pluggable asset layer with SVG placeholders"
```

---

### Task 10: User interface

**Files:**
- Create: `src/ui/TopBar.tsx`, `src/ui/GymScreen.tsx`, `src/ui/ShopScreen.tsx`, `src/ui/StatsScreen.tsx`, `src/ui/GameOverScreen.tsx`, `src/ui/WelcomeBack.tsx`, `src/ui/styles.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: the store (Task 8) and `assetFor` (Task 9).
- Produces: the playable app.

Requirements. `TopBar` shows cash, reputation, level, and day; cash turns amber below zero and red past −10 000. `GymScreen` renders the 8×6 grid, queued clients as tappable cards with a draining patience bar, and out-of-service machines with a repair button. `ShopScreen` lists the catalogue, disabling anything above the player's level or beyond their cash and stating the reason. `GameOverScreen` shows "Komornik wbił" with final statistics and a restart button. `WelcomeBack` appears only when `awayMs > 0`. All copy is Polish; every tap target is at least 44 px; layout respects `safe-area-inset`.

- [ ] **Step 1: Build the screens**
- [ ] **Step 2: Verify in the browser — buy a machine, scan a client, watch cash rise**
- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: game UI — gym, shop, stats, game over"
```

---

### Task 11: Generated artwork

**Files:**
- Create: `public/assets/*.png`
- Modify: `src/assets/assetFor.tsx`

**Interfaces:**
- Consumes: the asset ids from Task 9.
- Produces: real artwork behind the unchanged `assetFor` interface.

Budget: 10 Higgsfield credits at 1.25 per `recraft_v4_1` image. Generate sprite sheets rather than single icons — one image holding a grid of icons in a single style costs 1.25 instead of 7.5 and guarantees they match.

- [ ] **Step 1: Generate the machine sprite sheet**

```bash
higgsfield generate create recraft_v4_1 \
  --prompt "flat vector icon sheet, 3x2 grid on white, six gym machines: dumbbells, flat bench, treadmill, lat pulldown, spin bike, cable crossover; bold clean shapes, limited palette of charcoal orange and steel grey, no text, even spacing" \
  --param model_type=vector --param resolution=2k --aspect-ratio 1:1 --wait
```

- [ ] **Step 2: Generate client characters, gym floor, and logo the same way**
- [ ] **Step 3: Wire the artwork into `assetFor` and confirm the game still renders**
- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: generated artwork behind the asset layer"
```

---

### Task 12: Mobile packaging

**Files:**
- Create: `capacitor.config.ts`, `public/manifest.webmanifest`
- Modify: `index.html`

**Interfaces:**
- Consumes: the production build in `dist/`.
- Produces: native iOS and Android projects.

- [ ] **Step 1: Configure Capacitor**

```bash
npx cap init "IRON EMPIRE" com.ironempire.gym --web-dir=dist
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

- [ ] **Step 2: Lock portrait orientation and set the viewport**

`index.html` needs `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`. Set `orientation: "portrait"` in the web manifest and in both native configurations.

- [ ] **Step 3: Verify both native projects exist**

Run: `ls ios/App && ls android/app`
Expected: both directories exist.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Capacitor iOS and Android packaging"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full green build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 2: Play the acceptance path in the browser**

Start empty with 500. Buy dumbbells, place them, scan an arriving client, watch cash rise. Reload and confirm progress survived. Confirm the debt warning appears once cash goes negative.

- [ ] **Step 3: Write `README.md`**

Cover what the game is, `npm run dev`, `npm test`, and the exact commands to open the project in Xcode and Android Studio.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README with build and native packaging instructions"
```
