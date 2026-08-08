# v2: three features, three branches, one trunk

The v1 design deferred four systems. Personnel shipped. These are the other
three, and they are being built in parallel by three agents in three worktrees.

This document is the contract between them. It exists because the obvious way
to build three economy features at once — everyone edits `types.ts`, `save.ts`,
`gameStore.ts`, `en.ts` — produces three branches that each work alone and none
of which merge. The seam commit on `chore/v2-seams` removes that failure mode by
pre-cutting every shared hook. What is left is a rule about who owns what.

## The split

| Branch | Feature | Owner |
|---|---|---|
| `feat/v2-marketing` | Advertising campaigns: pay to raise footfall | agent A |
| `feat/v2-equipment-contracts` | Supplier contracts: sign a deal, unlock five better machines | agent B |
| `feat/v2-sponsors` | Sponsorship: a brand pays while the gym clears a bar | agent C |

All three branch from `chore/v2-seams`.

### What each feature is

**Marketing.** The player buys campaigns. A running campaign multiplies walk-in
arrivals — `spawnRateMultiplier` is already wired into `spawnWalkins`, and it
multiplies rather than adds, so advertising is worth more to a gym people
already like. Campaigns cost money, charged at the day's close.

**Equipment contracts.** The player signs with a supplier. Signing unlocks that
supplier's catalogue: five machines, each rung better than the last. It never
takes anything away — kit on the floor stays, and the base six stay on sale. A
contract costs something to hold, charged at the day's close. This is the
long-term progression ladder the game currently lacks: `revenueMultiplier` is
the only lever that grows revenue, and it tops out at the cable crossover.

**Sponsors.** A brand pays the gym for as long as the gym is worth being seen
in. The payout is conditional — reputation, footfall, kit on the floor — and a
deal lapses when the bar stops being cleared. It is the only one of the three
that puts money into the till.

## The seam

Every hook the three features need already exists and is already called. The
shape is identical for all three, so a rule learned on one applies to the others.

| Hook | Called from | What it is for |
|---|---|---|
| `initialX()` | `economy.ts` | the sub-state a new gym starts with |
| `normalizeX(raw)` | `save.ts`, on every load | fills in fields a stored save lacks |
| `applyX(state, action)` | `gameStore.ts` | everything the player can do |
| `advanceX(state, dtMs)` | `tick.ts` | per-tick simulation |
| `settleX(state)` | `dayClose.ts` | money in or out, once a day |
| `spawnRateMultiplier(state)` | `clients.ts` | marketing only |

Three consequences worth stating outright:

**Your state lives in one sub-object.** `GameState` has `marketing`,
`contracts` and `sponsors`, each an opaque type owned by one module. Growing
your feature means growing your own interface. It never means a new top-level
field, which is the single change that would put all three branches in
`types.ts` at once.

**You will never write a save migration.** `SAVE_VERSION` went to 9 once, in the
seam commit, and `hydrateFeatures` re-seats all three sub-states over their
current defaults on *every* load — not only on migration. So a field you add
next week lands on a save written today with its default value. The price of
this is one rule: `normalizeX` must default every field and must never throw.
`src/game/v2Seams.test.ts` holds you to it.

**You get one store action.** `marketing(action)`, `contracts(action)`,
`sponsors(action)`, each carrying a union you own. A new campaign type is a new
member of `MarketingAction` and a new button on your screen. It is not a change
to `gameStore.ts`.

## File ownership

Ownership is exclusive. If a file is not on your list, you do not edit it —
even a one-line change, even an obviously correct one.

**`feat/v2-marketing`**
```
src/game/marketing.ts              src/game/marketing.test.ts
src/game/content/campaigns.ts      src/game/content/campaigns.test.ts
src/i18n/marketing.ts
src/ui/MarketingScreen.tsx
```

**`feat/v2-equipment-contracts`**
```
src/game/contracts.ts              src/game/contracts.test.ts
src/game/content/suppliers.ts      src/game/content/suppliers.test.ts
src/game/content/machines.ts       (merging the supplier catalogue in)
src/i18n/contracts.ts
src/ui/ContractsScreen.tsx
src/ui/ShopScreen.tsx
src/three/models/machines.ts       src/three/models/stance.ts
src/three/models/footprint.ts      src/assets/assetFor.tsx
```
Plus one carve-out: the `content.machines` block in `src/i18n/en.ts` and
`src/i18n/pl.ts`, and nothing else in those two files. Widening
`SupplierMachineTypeId` past `never` makes the compiler demand those keys along
with `STANCES`, `MACHINE_FOOTPRINT` and the model `BUILDERS`. That checklist is
the compiler doing you a favour — it is the difference between finding a
missing mesh now and finding it as an invisible machine in play.

**`feat/v2-sponsors`**
```
src/game/sponsors.ts               src/game/sponsors.test.ts
src/game/content/sponsors.ts       src/game/content/sponsors.test.ts
src/i18n/sponsors.ts
src/ui/SponsorsScreen.tsx
```

**Nobody's — the coordinator's.** `types.ts`, `save.ts`, `constants.ts`,
`economy.ts`, `tick.ts`, `dayClose.ts`, `clients.ts`, `gameStore.ts`,
`App.tsx`, `Phone.tsx`, `DayReportModal.tsx`, `v2Seams.test.ts`, everything
under `src/three/` not listed above, `src/ui/styles.css`, `package.json`.

One exception, and it is deliberately a single line: when your feature is ready
to be reachable, delete the `soon: true` from *your* entry in `APPS` in
`Phone.tsx`. Three people editing three different lines of one array is the
rare shared edit git merges without complaint.

## Rules

1. **Stay in your files.** A change you need in a shared file is a request to
   the coordinator, not a commit. Ask; the seam gets cut once, on
   `chore/v2-seams`, and all three branches rebase onto it. This is slower than
   editing it yourself exactly once and faster than editing it three times.
2. **Never bump `SAVE_VERSION`.** If you think you need to, you have put state
   somewhere other than your sub-object. Fix that instead.
3. **Never add a dependency.** The three worktrees share one `node_modules` by
   symlink, so `npm install` in one is `npm install` in all three. If you
   genuinely need a package, ask.
4. **Balance numbers live in your `content/` table, not in `constants.ts`.**
   What a flyer run costs is content. What a game day lasts is a rule of the
   world. Only the second belongs in the shared file.
5. **Green before every push.** `npm test` and `npm run typecheck`, both clean.
   The seam suite (`v2Seams.test.ts`) must stay green untouched — if it fails,
   your feature broke the contract, so fix the feature.
6. **Test the engine, not the screen.** Every reducer, settler and content
   table gets tests; `applyX`, `settleX` and `normalizeX` are pure functions of
   state and that is deliberate. The existing suites in `src/game/` are the
   house style — copy their shape.
7. **Follow the house voice in comments.** This codebase explains *why* a
   decision was made, not what a line does, and it does not narrate the obvious.
   Read `content/upgrades.ts` before writing your content table; it is the
   nearest thing to a template you have.
8. **Rebase, never merge, and only onto `main`.** Once the seam lands on `main`,
   `git fetch && git rebase origin/main`. Do not rebase onto another feature
   branch; the three are independent by construction and must stay that way.
9. **One PR per branch, in any order.** Because nobody shares a file, merge
   order does not matter. If a merge does conflict, that is a bug in this
   document — report it rather than resolving it by hand.

## Order of operations

1. `chore/v2-seams` merges to `main` first. Nothing else can merge before it.
2. The three branches rebase onto `main` and work in parallel.
3. Each merges when it is done, in whatever order they finish.
