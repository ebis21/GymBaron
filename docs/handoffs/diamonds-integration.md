# Diamonds and upgrades handoff

Branch: `feat/multiplayer-integration`

## Save contract (v10)

`GameState` contains:

- `diamonds: number` — a non-negative integer;
- `diamondUpgrades: Record<'queue_patience' | 'repair_discount' | 'xp_boost', number>` — levels 0–3;
- `lastDiamondRewardDay: number` — prevents evaluating a day reward twice;
- `allianceIncomeMultiplier: 1 | 1.5` and `appliedSabotageIds: string[]` for offline-safe social state.

The pre-existing cash upgrade tracks remain in `state.upgrades`. The v7 → v8
and v8 → v9 migrations from `main` run unchanged; v9 → v10 adds diamonds and
social state. `DayReport` contains `diamondReward`, defaulted to zero when an
older receipt is hydrated.

## Economy rules

- Each level crossed by `addXp` grants one diamond.
- Closing a day at satisfaction ≥75 with at least 10 served clients grants one diamond.
- Closing a day at satisfaction ≥90 with at least 20 served clients grants two diamonds instead.
- Diamonds can only be spent through `buyDiamondUpgrade`; no cash purchase path exists.
- An active alliance multiplies normal entry and membership income by ×1.5. It does not multiply transfers, loans, rewards, diamonds or sabotage effects.

Diamond rules live in `src/game/diamondUpgrades.ts`:

- `queue_patience`: +10% queue patience per level, stacked after the cash patience track; costs 5/8/12;
- `repair_discount`: −10% manual repair price per level; costs 5/8/12;
- `xp_boost`: +10% XP per level; costs 6/10/15.

## Integration

- `gameStore.ts` exposes `buyDiamondUpgrade`, persists locally and to the cloud,
  adopts remote revisions, polls social state and applies pending LIL D. events idempotently.
- The phone keeps the original cash `upgrades` app and adds a separate
  `diamond-upgrades` app, plus account and multiplayer apps.
- Repair prices shown by the shop and proximity action use the same rule as the store charge.
- The 3D patience bar and the client simulation use the same combined duration.
- Financial multiplayer commands pause the simulation, flush the cloud save,
  execute an idempotent RPC, pull the updated wallet, then resume.

## Verification

- `npm test`: 54 files, 833 tests passing after merge with current `main`.
- `npm run typecheck`: passing.
- `npm run build`: passing; the existing large-chunk warning remains.
- Browser screenshot QA was unavailable because no browser backend was connected.
- Migration `202608200002_multiplayer.sql` still has to be applied to the live Supabase project before multiplayer RPCs become available.
