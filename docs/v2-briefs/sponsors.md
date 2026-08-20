# Brief: sponsorship deals

**Branch:** `feat/v2-sponsors` · **Read first:** `docs/v2-coordination.md`

## What you are building

A brand pays the gym to be seen in it, for as long as the gym is worth being
seen in. Deals are accepted from a screen on the phone and pay out at the day's
close — conditionally.

The condition is the whole feature. An unconditional payout is a wage, and the
game already has enough of those running the other way. A sponsor should be an
ongoing standard the player has to keep meeting: reputation above a bar,
so many clients served a day, particular kit on the floor, a clean room. Miss
it and the day pays nothing; miss it enough and the deal lapses.

That makes sponsorship the one system that rewards *running the place well*
rather than spending on it — which is what separates it from the other two v2
features, both of which are things the player buys.

## Design questions that are yours to answer

- What are the conditions, and how many does one deal carry? One is legible;
  three is a juggling act. Legible is probably right for the first tier and a
  juggling act for the last.
- Does the player see they are about to miss the bar, or only find out on the
  receipt? A warning is kinder and probably better — the receipt is where
  consequences land, not where they should first become visible.
- Is a lapsed deal gone, or can it be re-signed at a cost? Losing a legendary
  sponsor permanently to one bad day is the kind of punishment that makes
  people stop playing.
- Do sponsors ask for anything on the floor — branded decor, a machine of a
  certain type? A deal that changes the room is more memorable than one that
  changes a number. `DecorTypeId` is not yours, so if you want this, ask the
  coordinator early rather than late.

## Your seam

```
initialSponsors()             state a new gym starts with
normalizeSponsors(raw)        defaults every field; never throws
applySponsors(state, action)  accepting, dropping, whatever else
advanceSponsors(state, dt)    per-tick; live tracking of the conditions
settleSponsors(state)         pays out, writes today.sponsorIncome
sponsors()                    the content table
```

`settleSponsors` is the only settler of the three that puts money *in*. It runs
before the bill and before payroll, so a sponsor's cheque can be what meets a
wage — that ordering is deliberate and worth designing around.

Book the income in `stats.totalEarned` as well as `today.sponsorIncome`; the
receipt prints the latter and the stats screen reads the former.

## Files you own

`src/game/sponsors.ts`, `src/game/content/sponsors.ts`, `src/i18n/sponsors.ts`,
`src/ui/SponsorsScreen.tsx`, and the matching `.test.ts` files. Plus one line:
drop `soon: true` from the `sponsors` entry in `Phone.tsx`.

Nothing else. In particular `DayReportModal.tsx` already prints your line — it
is wired and conditional on the figure being non-zero, so leave it alone.

## Done means

- Deals can be accepted, pay out on days the conditions hold, and pay nothing
  on days they do not.
- A deal lapses on the rule you designed, and the player can tell why.
- The receipt shows the sponsorship line on days a deal paid, and hides it on
  days it did not.
- `npm test` and `npm run typecheck` clean, `v2Seams.test.ts` green untouched.
- Both languages complete — `Strings` is inferred from `en`, so a missing
  Polish key is a compile error, not a blank label.
