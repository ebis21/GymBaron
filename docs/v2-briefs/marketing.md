# Brief: advertising campaigns

**Branch:** `feat/v2-marketing` · **Read first:** `docs/v2-coordination.md`

## What you are building

The player pays to bring more people through the door. Campaigns are bought
from a screen on the phone, run for a stretch of days, and cost money the whole
time they are running.

The one lever that already exists for footfall is reputation, which the player
earns and cannot buy. Advertising is the opposite: instant, purchasable, and
temporary. Those two facts are what make it a decision rather than a tax —
a campaign has to pay for itself before it lapses, or buying it was a mistake.

`spawnRateMultiplier` multiplies the reputation-derived rate rather than adding
to it, so a campaign is worth more to a gym people already like. Keep that
shape: it means advertising rewards a player who has done the slow work first,
instead of letting them skip it.

## Design questions that are yours to answer

- How many campaign tiers, and does the player run one at a time or several?
- Does a campaign cost up front, per day, or both? (The seam charges at the
  day's close via `settleMarketing`, so per-day is the cheapest to express.)
- Does advertising touch *who* walks in as well as how many? The rarity table
  in `content/rarity.ts` is the obvious hook, and a campaign that pulls a
  better class of client is a more interesting buy than one that pulls more of
  the same. Read `RARITY_MULTIPLIER` before deciding.
- What stops the player from simply always running the top campaign? Either it
  has to be unaffordable at low footfall, or it has to scale sub-linearly.

## Your seam

```
initialMarketing()            state a new gym starts with
normalizeMarketing(raw)       defaults every field; never throws
applyMarketing(state, action) everything the player can do
advanceMarketing(state, dt)   per-tick; campaign clocks run here
settleMarketing(state)        charges the day, writes today.marketingSpend
spawnRateMultiplier(state)    1 = no campaign; already wired into spawnWalkins
campaigns()                   the content table
```

`settleMarketing` must move `cash`, book the spend in `stats.totalSpent`, and
record the same figure in `today.marketingSpend` — the receipt prints that line
and the day's net already subtracts it.

## Files you own

`src/game/marketing.ts`, `src/game/content/campaigns.ts`, `src/i18n/marketing.ts`,
`src/ui/MarketingScreen.tsx`, and the matching `.test.ts` files. Plus one line:
drop `soon: true` from the `marketing` entry in `Phone.tsx` when the screen is
worth opening.

Nothing else. `constants.ts` is not yours — campaign prices are content.

## Done means

- Campaigns can be bought, run, expire, and cost what they say they cost.
- Footfall visibly changes while one is running, and returns to normal after.
- The receipt shows the advertising line on days money was spent, and hides it
  on days it was not.
- `npm test` and `npm run typecheck` clean, `v2Seams.test.ts` green untouched.
- Both languages complete — `Strings` is inferred from `en`, so a missing
  Polish key is a compile error, not a blank label.
