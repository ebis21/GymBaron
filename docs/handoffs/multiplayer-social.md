# Multiplayer / social — handoff

Branch: `feat/multiplayer-social`
Migration: `supabase/migrations/202608200002_multiplayer.sql`

This branch deliberately does not edit `App.tsx`, `Phone.tsx`, `gameStore.ts`,
`game/types.ts` or `game/save.ts`. The UI and domain port are ready to be wired
by the integration branch.

## Database assumptions

Migration `202608200001_accounts_and_cloud_saves.sql` must run first. This
migration uses its existing schema:

- `profiles.id` — auth user id,
- `profiles.display_name` — public player name; the multiplayer migration adds
  a case-insensitive, trimmed unique index,
- `game_saves.user_id` — save owner,
- `game_saves.state` — full JSON save,
- `game_saves.revision` and `game_saves.updated_at` — concurrency metadata.

The private helper also accepts a JSONB save column named `save_data` or `data`
for forward compatibility, but the remaining account-schema columns above are
required. The state must contain numeric `cash`, integer `diamonds`, integer
`day`, and the floor data used by the friend snapshot. Until the diamonds
state migration has populated `diamonds`, diamond transfers fail closed with
`MP_INVALID_SAVE_BALANCE`.

### Nickname onboarding

Migration `20260821090000_player_nickname_onboarding.sql` adds the explicit
one-time nickname step. New profiles start with no public name, and legacy
email-derived placeholders remain private until the player completes the same
step. `get_player_profile()` reports whether onboarding is complete and
`set_player_nickname(text)` atomically validates and reserves a 3–20 character
case-insensitive name. Direct profile updates are revoked, and `search_players`
only includes profiles with `nickname_set_at` populated.

The existing `game_saves_bump_revision` trigger wins over the explicit
`revision = revision + 1` assignment, so each changed save advances exactly
one revision. A financial RPC changes both participants' revisions when both
wallets change; sabotage changes the attacker's revision only.

## Tables

All user-facing tables have RLS enabled. Authenticated participants receive
read-only grants; there are no direct insert/update/delete policies. Mutations
are available only through validating `SECURITY DEFINER` RPCs.

- `friend_requests` — directional pending/resolved invitations; one pending
  request per unordered pair.
- `friendships` — accepted, canonical `(user_low_id, user_high_id)` pairs.
- `alliance_invitations` — separate directional alliance invitations.
- `alliances` — active/ended pairwise alliances; at most one active row per
  pair. Multiple allied friends still produce one non-stacking ×1.5 modifier.
- `transfers` — immutable cash/diamond transfer ledger.
- `loans` — credit-only, interest-free proposal and outstanding amount.
- `loan_repayments` — immutable partial/full repayment ledger.
- `sabotage_events` — queued/applied LIL D. deliveries; unique target and
  target game day, with a fixed 1,000-credit cost.
- `financial_idempotency_keys` — actor-scoped request fingerprint and cached
  result for exactly-once transfer, loan, repayment and sabotage retries.

`multiplayer_private` contains helper functions for ordered save locks, pair
advisory locks, wallet updates, relation checks and idempotency. The schema has
no usage grant for client roles.

## Public RPCs

### Read models

- `search_players(p_query text)` → `table(player_id uuid, username text)`
- `get_multiplayer_overview()` → camel-cased JSON used by
  `MultiplayerOverview`
- `get_friend_gym_snapshot(p_friend_id uuid)` → whitelisted JSON used by
  `FriendGymSnapshot`
- `get_normal_income_multiplier()` → `1.0` or `1.5`
- `get_pending_sabotages()` → queued events for the current player

The gym snapshot contains only owner id/name, level, reputation, satisfaction,
active floor and sanitized floors. Each floor contains expansion, machines
(`uid`, `type`, coordinates, rotation, durability), decorations and walls. It
does not contain cash, diamonds, inventory, clients, staff, stains, statistics
or the raw save.

### Relationships

- `send_friend_request(p_recipient_id uuid)`
- `respond_friend_request(p_request_id uuid, p_accept boolean)`
- `remove_friend(p_friend_id uuid)` — also ends this pair's alliance and
  cancels its pending alliance invitation; existing debt remains repayable
- `send_alliance_invitation(p_recipient_id uuid)`
- `respond_alliance_invitation(p_invitation_id uuid, p_accept boolean)`
- `end_alliance(p_ally_id uuid)`

### Atomic financial/gameplay operations

- `transfer_asset(p_recipient_id uuid, p_asset text, p_amount bigint,
  p_idempotency_key text)`
- `propose_loan(p_borrower_id uuid, p_amount bigint,
  p_idempotency_key text)`
- `respond_loan(p_loan_id uuid, p_accept boolean,
  p_idempotency_key text)`
- `repay_loan(p_loan_id uuid, p_amount bigint,
  p_idempotency_key text)`
- `sabotage_friend(p_target_id uuid, p_idempotency_key text)`
- `acknowledge_sabotage(p_event_id uuid)`

Every monetary amount is a positive PostgreSQL `bigint`. Transfer/loan RPCs do
not invoke the alliance multiplier. They take an ordered lock on both saves,
validate the relation and current balance, update the JSON wallets and let the
save revision advance in the same transaction. Pair advisory locks serialize
relationship changes against financial operations and sabotage.

Idempotency keys must have 8–128 characters. Repeating the same operation and
payload returns the cached result. Reusing a key with different input returns
`MP_IDEMPOTENCY_CONFLICT`. Failed transactions do not consume the key.

## TypeScript domain

Entry point: `src/multiplayer/index.ts`.

- `MultiplayerApi` — framework/transport-independent async port.
- `PlayerSummary`, `FriendSummary`, `MultiplayerOverview` — social read model.
- `FriendGymSnapshot`, `FriendFloorSnapshot`, `FriendMachine`, `FriendDecor`,
  `FriendWall` — deliberately restricted gym read model.
- `TransferAsset`, `TransferCommand`, `TransferReceipt` — cash/diamond transfer.
- `Loan`, `LoanStatus`, `ProposeLoanCommand`, `RespondLoanCommand`,
  `RepayLoanCommand` — interest-free loan lifecycle.
- `SabotageCommand`, `SabotageEvent` — queued LIL D. operation.
- `MultiplayerError`, `MultiplayerErrorCode`, `multiplayerErrorMessage` — maps
  RPC/transport errors to stable Polish UI text.
- validation helpers — positive safe integers, assets, search queries and
  idempotency keys.
- `FakeMultiplayerApi` plus seed types — deterministic in-memory adapter with
  successful-result idempotency and inspection seams for balance/revision
  tests.

## UI integration

> Status po scaleniu: konkretny adapter Supabase, ekran telefonu, mnożnik
> sojuszu oraz odbiór LIL D. są zaimplementowane na
> `feat/multiplayer-integration`. Poniższa lista opisuje spełniony kontrakt.

Render `src/ui/MultiplayerScreen.tsx` with a concrete API adapter:

```tsx
<MultiplayerScreen api={multiplayerApi} onClose={closePhoneScreen} />
```

`MultiplayerScreen` imports its own `multiplayer.css` and opens
`FriendGymView` for the read-only floor plan. It covers search/invites,
friends, base preview, alliance invitation/termination, cash or diamond
transfer, loan proposal/accept/reject/repay and confirmed LIL D. sabotage.

The Supabase adapter should:

1. map `search_players.player_id` to `PlayerSummary.id`;
2. parse the JSON from `get_multiplayer_overview` and
   `get_friend_gym_snapshot` into the corresponding domain types (reject
   malformed payloads rather than casting blindly);
3. map snake-case ledger rows returned by mutation RPCs to the camel-case
   receipt types;
4. pass every retry with the original idempotency key, not a new one;
5. after a successful wallet-changing RPC, refetch the local player's save and
   revision before the next cloud autosave. Otherwise the correct stale-save
   compare-and-swap rejection will fire;
6. call `get_normal_income_multiplier` after login/relation changes and apply
   it only to ordinary game-income deltas. Do not multiply transfers, loan
   payouts/repayments, diamond rewards, other rewards or future bank/loan
   credits. Offline settlement must use the same income rule as live play;
7. on startup, fetch `get_pending_sabotages`. For each event, call the existing
   `summonLilD`; call `acknowledge_sabotage` only after the summon was accepted
   locally. Leaving it pending makes startup/crash retries safe.

## Tests and remaining integration limits

`fakeMultiplayerApi.test.ts` covers forbidden self/stranger/ally actions,
friend/alliance separation, wallet insufficiency, invalid integers,
idempotent retry and conflicts, loan acceptance/partial/full repayment,
revision changes, global target/day sabotage limits and pending-event ack.
`migration.contract.test.ts` guards RLS/direct-write structure, save locking,
revision updates, idempotency and the snapshot whitelist.

The original social branch had no concrete Supabase adapter by design. The
integration branch now supplies it and applies the ×1.5 multiplier in the game
engine. A live SQL integration run is still required: migration
`202608200002_multiplayer.sql` has not been applied to production, while its
static contract test and compatibility review against migration
`202608200001` pass.
