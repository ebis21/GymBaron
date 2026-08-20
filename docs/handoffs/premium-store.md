# Baron Club, RevenueCat and premium store handoff

## Implemented

- A left-edge `BARON CLUB` launcher opens a full-screen, focus-trapped hub.
- Diamond upgrades, multiplayer and account/cloud live in the hub instead of
  the right-hand phone.
- The premium catalogue contains six deterministic products: credits,
  diamonds, three named Apex machines, permanent luck, permanent x2 normal
  income, and a fixed four-person legendary team. There are no paid random
  rewards.
- `@revenuecat/purchases-capacitor` is installed and synchronized into the
  native projects. The adapter identifies the player with their signed-in
  Supabase UUID, loads localized prices from the selected RevenueCat offering,
  opens native checkout, supports restore, and never runs checkout on web.
- A store-confirmed transaction is applied idempotently to save schema v11.
  Transaction IDs prevent duplicate consumables; permanent ownership and
  boosts survive both app restarts and an in-game gym restart.

Product identifiers live in `src/storefront/catalog.ts` and must be identical
in App Store Connect, Play Console and RevenueCat.

## Launch pricing

Configure these Polish storefront prices. Other storefronts should use the
nearest local price tier; the game displays the localized value returned by
the platform and never hard-codes PLN.

| Product ID | Type | Price (PLN) |
| --- | --- | ---: |
| `gymbaron.credits.10000` | consumable | 4.99 |
| `gymbaron.diamonds.25` | consumable | 9.99 |
| `gymbaron.machines.premium3` | consumable | 14.99 |
| `gymbaron.boost.luck.forever` | non-consumable | 19.99 |
| `gymbaron.boost.income2x.forever` | non-consumable | 29.99 |
| `gymbaron.staff.legendary.team` | non-consumable | 39.99 |

RevenueCat offering: `gymbaron_store`.

Lifetime entitlement identifiers:

- `luck_forever`
- `double_income_forever`
- `legendary_team`

## External setup still required

1. Create all six in-app products in App Store Connect and Play Console. Use
   the product types from the table above.
2. Import them into RevenueCat, create offering `gymbaron_store`, add all six
   packages and attach the three lifetime products to their entitlements.
3. Put the public platform SDK keys in `.env.local` using `.env.example`.
   Never place a RevenueCat secret key in a `VITE_*` variable.
4. Sandbox-test purchase, cancellation, pending payment, offline failure,
   reinstall, a second device and restore on both platforms.

Until those external products and public SDK keys exist, the catalogue stays
visibly disabled. The browser build also stays disabled by design because the
items are digital goods for the native game.

## Security boundary

The current GymBaron economy and cloud save are client-authoritative: a signed-
in user can write their own save through Supabase RLS. The implementation only
grants a reward after RevenueCat returns a store transaction, and prevents
accidental/retry duplication, but a modified client can still forge its own
game state. Before treating the economy as competitive or cash-equivalent,
move fulfillment to a server-authoritative RevenueCat webhook/receipt ledger
and handle refunds/revocations there.

Official references:

- RevenueCat Capacitor installation:
  https://www.revenuecat.com/docs/getting-started/installation/capacitor
- RevenueCat customer identity:
  https://www.revenuecat.com/docs/customers/identifying-customers
- RevenueCat entitlements:
  https://www.revenuecat.com/docs/getting-started/entitlements
- Apple App Review Guidelines 3.1.1:
  https://developer.apple.com/app-store/review/guidelines/
- Google Play payments policy:
  https://support.google.com/googleplay/android-developer/answer/9858738
