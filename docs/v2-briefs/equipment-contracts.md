# Brief: equipment supplier contracts

**Branch:** `feat/v2-equipment-contracts` · **Read first:** `docs/v2-coordination.md`

## What you are building

The player signs a contract with an equipment supplier. Signing opens that
supplier's catalogue: **five machines, each rung strictly better than the one
before it.** Nothing is taken away — kit already on the floor stays, and the
base six stay on sale. A contract only ever adds to what can be bought.

This is the game's missing late progression. `revenueMultiplier` is the only
lever that grows revenue, and today it stops at the cable crossover's 1.9. Once
a player has filled the floor with cables there is nothing left to buy, and the
economy flattens. Your ladder is what continues it.

## Design questions that are yours to answer

- How many suppliers, and are they alternatives or a sequence? Alternatives
  make the choice interesting; a sequence makes the ladder longer. Both work,
  but the answer decides whether the player can hold two contracts at once.
- What does a contract cost — a signing fee, a daily fee, a cut, a minimum
  purchase? `settleContracts` charges daily, which is the cheapest to express
  and the most interesting: a contract you are not buying from is a drain.
- What gates the first contract: level, cash, reputation, or a supplier who
  only talks to a gym of a certain size?
- Do the five rungs raise `revenueMultiplier` alone, or also `satisfaction`,
  `wearPerUse`, `powerPerDay`? Read `content/machines.ts` first — every field
  there is a dial, and a rung that is better at everything is less interesting
  than one that trades power draw for takings.

## Your seam

```
initialContracts()            state a new gym starts with
normalizeContracts(raw)       defaults every field; never throws
applyContracts(state, action) signing, cancelling, whatever else
advanceContracts(state, dt)   per-tick; contract terms run down here
settleContracts(state)        charges the day, writes today.contractFees
availableMachines(state)      what the shop may sell right now
machineUnlocked(state, type)  one machine's gate
suppliers()                   the content table
```

`ShopScreen` is yours: point it at `availableMachines` instead of
`MACHINE_TYPES`, so unsigned suppliers' kit is invisible rather than greyed out.

## The type widening, and why it is a gift

`MachineTypeId` is `BaseMachineTypeId | SupplierMachineTypeId`, and the second
half is `never` in `content/suppliers.ts` — yours to replace. The moment you do,
the compiler will demand the new ids in five places:

```
STANCES              src/three/models/stance.ts       how a client stands on it
MACHINE_FOOTPRINT    src/three/models/footprint.ts    how many tiles it takes
BUILDERS             src/three/models/machines.ts     the mesh
AssetId              src/assets/assetFor.tsx          the 2D icon
t.content.machines   src/i18n/en.ts + pl.ts           the name, both languages
```

All five are on your ownership list. Work the errors down to zero and you have
a machine that exists everywhere it needs to — rather than one that ships as an
invisible object with a blank label, which is exactly what this union shape is
here to prevent.

`src/i18n/en.ts` and `pl.ts` are the one shared file you may touch, and only
inside `content.machines`. Every other string you need goes in
`src/i18n/contracts.ts`, which is yours outright.

## Files you own

`src/game/contracts.ts`, `src/game/content/suppliers.ts`,
`src/game/content/machines.ts`, `src/i18n/contracts.ts`,
`src/ui/ContractsScreen.tsx`, `src/ui/ShopScreen.tsx`,
`src/three/models/{machines,stance,footprint}.ts`, `src/assets/assetFor.tsx`,
the `content.machines` block in `en.ts`/`pl.ts`, and the matching tests. Plus
one line: drop `soon: true` from the `contracts` entry in `Phone.tsx`.

This is the largest of the three briefs by file count. That is deliberate —
it is also the one whose files nobody else has any reason to open.

## Done means

- A contract can be signed, and five new machines appear in the shop that were
  not there before.
- Each rung measurably beats the one below it, and the top rung beats the cable
  crossover by enough to be worth the climb.
- Machines bought under a contract keep working if the contract ends. Kit the
  player owns is theirs.
- Every new machine has a mesh, a footprint, a stance, an icon and a name in
  both languages.
- `npm test` and `npm run typecheck` clean, `v2Seams.test.ts` green untouched.
