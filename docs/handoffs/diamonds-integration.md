# Diamonds and upgrades handoff

Branch: `feat/multiplayer-integration`

## Save contract (v8)

`GameState` now contains:

- `diamonds: number` — a non-negative integer;
- `upgrades: Record<'queue_patience' | 'repair_discount' | 'xp_boost', number>` — levels 0–3;
- `lastDiamondRewardDay: number` — prevents a day reward from being evaluated twice.

`DayReport` contains `diamondReward`. The v7 → v8 migration initializes the wallet and upgrades at zero and preserves the rest of the gym. Cloud saves and multiplayer RPCs must retain these fields. A diamond transfer should update `state.diamonds` and the cloud save revision atomically.

## Economy rules

- Each level crossed by `addXp` grants one diamond.
- Closing a day at satisfaction ≥75 with at least 10 served clients grants one diamond.
- Closing a day at satisfaction ≥90 with at least 20 served clients grants two diamonds instead.
- Diamonds can be spent through `buyUpgrade`; there is no production cash purchase path.

Upgrade rules live in `src/game/upgrades.ts`:

- `queue_patience`: +10% queue patience per level; costs 5/8/12.
- `repair_discount`: −10% manual repair price per level; costs 5/8/12.
- `xp_boost`: +10% XP per level; costs 6/10/15.

## Integration notes

- `src/store/gameStore.ts` exposes `buyUpgrade` and persists successful purchases.
- `UpgradeScreen` is wired as the `upgrades` phone app.
- Repair prices shown by the shop and action button use the same `repairPrice` rule as the store charge.
- The 3D patience bar uses the same upgraded duration as the client simulation.
- The day receipt displays any diamond reward.
- When cloud/social branches are merged, server-side financial RPCs must use save v8 and preserve `upgrades` and `lastDiamondRewardDay`.

## Verification

- `npm test`: 29 files, 444 tests passing at handoff time.
- `npm run typecheck`: passing.
- `npm run build`: passing; the existing large-chunk warning remains.
- Browser screenshot QA was unavailable because no browser backend was connected in the session.
