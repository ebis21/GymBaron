-- Gymbaron multiplayer/social MVP.
-- Depends on the account migration that creates public.profiles and
-- public.game_saves. profiles.id is the auth user id, profiles.display_name is
-- the public unique player name, and game_saves.user_id is the save owner.

create extension if not exists pgcrypto;

create schema if not exists multiplayer_private;
revoke all on schema multiplayer_private from public, anon, authenticated;

-- Player names are identifiers in the social UI, so case-only duplicates are
-- forbidden even if the account migration used a case-sensitive text column.
create unique index if not exists profiles_display_name_lower_unique
  on public.profiles (lower(btrim(display_name)))
  where display_name is not null;

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (sender_id <> recipient_id)
);

create unique index friend_requests_one_pending_pair
  on public.friend_requests (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id)
  ) where status = 'pending';

create index friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);

create table public.friendships (
  user_low_id uuid not null references public.profiles(id) on delete cascade,
  user_high_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low_id, user_high_id),
  check (user_low_id < user_high_id)
);

create index friendships_high_idx on public.friendships (user_high_id);

create table public.alliance_invitations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (sender_id <> recipient_id)
);

create unique index alliance_invitations_one_pending_pair
  on public.alliance_invitations (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id)
  ) where status = 'pending';

create index alliance_invitations_recipient_status_idx
  on public.alliance_invitations (recipient_id, status, created_at desc);

create table public.alliances (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.profiles(id) on delete cascade,
  user_high_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  check (user_low_id < user_high_id)
);

create unique index alliances_one_active_pair
  on public.alliances (user_low_id, user_high_id) where status = 'active';
create index alliances_high_status_idx
  on public.alliances (user_high_id, status);

create table public.financial_idempotency_keys (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  operation text not null,
  request_fingerprint jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, idempotency_key),
  check (char_length(idempotency_key) between 8 and 128)
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  asset text not null check (asset in ('cash', 'diamonds')),
  amount bigint not null check (amount > 0),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  unique (sender_id, idempotency_key)
);

create index transfers_recipient_created_idx
  on public.transfers (recipient_id, created_at desc);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references public.profiles(id) on delete restrict,
  borrower_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount > 0),
  repaid_amount bigint not null default 0
    check (repaid_amount >= 0 and repaid_amount <= amount),
  status text not null default 'proposed'
    check (status in ('proposed', 'active', 'repaid', 'rejected', 'cancelled')),
  proposal_idempotency_key text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  resolved_at timestamptz,
  check (lender_id <> borrower_id),
  unique (lender_id, proposal_idempotency_key)
);

create index loans_borrower_status_idx
  on public.loans (borrower_id, status, created_at desc);
create index loans_lender_status_idx
  on public.loans (lender_id, status, created_at desc);

create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete restrict,
  borrower_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount > 0),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (borrower_id, idempotency_key)
);

create index loan_repayments_loan_created_idx
  on public.loan_repayments (loan_id, created_at);

create table public.sabotage_events (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references public.profiles(id) on delete restrict,
  target_id uuid not null references public.profiles(id) on delete restrict,
  target_game_day bigint not null check (target_game_day > 0),
  cost bigint not null default 1000 check (cost = 1000),
  status text not null default 'pending' check (status in ('pending', 'applied')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  check (attacker_id <> target_id),
  unique (attacker_id, idempotency_key),
  -- One successful LIL D. delivery to a target per target game day, regardless
  -- of how many friends try concurrently.
  unique (target_id, target_game_day)
);

create index sabotage_events_target_pending_idx
  on public.sabotage_events (target_id, created_at) where status = 'pending';

-- -------------------------------------------------------------------------
-- Private helpers. All money-changing RPCs take row locks in UUID order and
-- share a pair advisory lock with relationship mutations, avoiding both
-- deadlocks and check/use races (for example alliance acceptance vs sabotage).

create or replace function multiplayer_private.current_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'MP_NOT_AUTHENTICATED';
  end if;
  return v_actor;
end;
$$;

create or replace function multiplayer_private.lock_pair(p_left uuid, p_right uuid)
returns void
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select pg_advisory_xact_lock(
    hashtextextended(least(p_left, p_right)::text || ':' || greatest(p_left, p_right)::text, 0)
  );
$$;

create or replace function multiplayer_private.save_json_column()
returns name
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_column name;
begin
  select a.attname
    into v_column
  from pg_attribute a
  where a.attrelid = 'public.game_saves'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.atttypid = 'jsonb'::regtype
    and a.attname = any (array['save_data', 'state', 'data']::name[])
  order by array_position(array['save_data', 'state', 'data']::name[], a.attname)
  limit 1;

  if v_column is null then
    raise exception using errcode = 'P0001', message = 'MP_GAME_SAVE_JSON_COLUMN_MISSING';
  end if;
  return v_column;
end;
$$;

create or replace function multiplayer_private.lock_saves(p_user_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
begin
  execute
    'select 1 from public.game_saves where user_id = any ($1) order by user_id for update'
    using p_user_ids;

  if (select count(*) from unnest(p_user_ids) ids(id)) <>
     (select count(distinct id) from unnest(p_user_ids) ids(id)) then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_PLAYER_SET';
  end if;

  if (select count(*) from public.game_saves where user_id = any (p_user_ids)) <>
     cardinality(p_user_ids) then
    raise exception using errcode = 'P0001', message = 'MP_SAVE_NOT_FOUND';
  end if;
end;
$$;

create or replace function multiplayer_private.read_save(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payload jsonb;
  v_column name := multiplayer_private.save_json_column();
begin
  execute format('select %I from public.game_saves where user_id = $1', v_column)
    into v_payload
    using p_user_id;
  if v_payload is null then
    raise exception using errcode = 'P0001', message = 'MP_SAVE_NOT_FOUND';
  end if;
  return v_payload;
end;
$$;

create or replace function multiplayer_private.write_save(p_user_id uuid, p_payload jsonb)
returns bigint
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_revision bigint;
  v_column name := multiplayer_private.save_json_column();
begin
  execute format(
    'update public.game_saves set %I = $2, revision = revision + 1, updated_at = now() where user_id = $1 returning revision',
    v_column
  ) into v_revision using p_user_id, p_payload;
  if v_revision is null then
    raise exception using errcode = 'P0001', message = 'MP_SAVE_NOT_FOUND';
  end if;
  return v_revision;
end;
$$;

create or replace function multiplayer_private.balance(p_payload jsonb, p_asset text)
returns numeric
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_balance numeric;
begin
  if p_asset not in ('cash', 'diamonds') then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_ASSET';
  end if;
  if jsonb_typeof(p_payload -> p_asset) <> 'number' then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_SAVE_BALANCE';
  end if;
  begin
    v_balance := (p_payload ->> p_asset)::numeric;
  exception when others then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_SAVE_BALANCE';
  end;
  if p_asset = 'diamonds' and v_balance <> trunc(v_balance) then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_SAVE_BALANCE';
  end if;
  return v_balance;
end;
$$;

create or replace function multiplayer_private.set_balance(
  p_payload jsonb,
  p_asset text,
  p_balance numeric
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_asset not in ('cash', 'diamonds') or p_balance is null then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_SAVE_BALANCE';
  end if;
  if p_asset = 'diamonds' and p_balance <> trunc(p_balance) then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_SAVE_BALANCE';
  end if;
  return jsonb_set(p_payload, array[p_asset], to_jsonb(p_balance), true);
end;
$$;

create or replace function multiplayer_private.are_friends(p_left uuid, p_right uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.friendships
    where user_low_id = least(p_left, p_right)
      and user_high_id = greatest(p_left, p_right)
  );
$$;

create or replace function multiplayer_private.have_active_alliance(p_left uuid, p_right uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.alliances
    where user_low_id = least(p_left, p_right)
      and user_high_id = greatest(p_left, p_right)
      and status = 'active'
  );
$$;

create or replace function multiplayer_private.validate_amount(p_amount bigint)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_AMOUNT';
  end if;
end;
$$;

create or replace function multiplayer_private.begin_operation(
  p_actor uuid,
  p_key text,
  p_operation text,
  p_fingerprint jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.financial_idempotency_keys%rowtype;
begin
  if p_key is null or char_length(p_key) not between 8 and 128 then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_IDEMPOTENCY_KEY';
  end if;

  insert into public.financial_idempotency_keys (
    actor_id, idempotency_key, operation, request_fingerprint
  ) values (p_actor, p_key, p_operation, p_fingerprint)
  on conflict do nothing;

  if found then
    return null;
  end if;

  select * into v_existing
  from public.financial_idempotency_keys
  where actor_id = p_actor and idempotency_key = p_key
  for update;

  if v_existing.operation <> p_operation
     or v_existing.request_fingerprint <> p_fingerprint then
    raise exception using errcode = 'P0001', message = 'MP_IDEMPOTENCY_CONFLICT';
  end if;
  if v_existing.result is null then
    raise exception using errcode = 'P0001', message = 'MP_OPERATION_IN_PROGRESS';
  end if;
  return v_existing.result;
end;
$$;

create or replace function multiplayer_private.finish_operation(
  p_actor uuid,
  p_key text,
  p_result jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.financial_idempotency_keys
  set result = p_result
  where actor_id = p_actor and idempotency_key = p_key and result is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'MP_IDEMPOTENCY_CONFLICT';
  end if;
  return p_result;
end;
$$;

create or replace function multiplayer_private.array_or_empty(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end;
$$;

-- -------------------------------------------------------------------------
-- Social RPCs.

create or replace function public.search_players(p_query text)
returns table (player_id uuid, username text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_query text := lower(btrim(coalesce(p_query, '')));
begin
  if char_length(v_query) not between 2 and 24 then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_USERNAME_QUERY';
  end if;
  return query
  select p.id, p.display_name::text
  from public.profiles p
  where p.id <> v_actor
    and lower(btrim(p.display_name::text)) like replace(replace(v_query, '%', '\%'), '_', '\_') || '%' escape '\'
  order by (lower(btrim(p.display_name::text)) = v_query) desc, lower(btrim(p.display_name::text))
  limit 20;
end;
$$;

create or replace function public.send_friend_request(p_recipient_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_request public.friend_requests%rowtype;
begin
  if p_recipient_id is null or p_recipient_id = v_actor then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_TARGET_SELF';
  end if;
  perform multiplayer_private.lock_pair(v_actor, p_recipient_id);
  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception using errcode = 'P0001', message = 'MP_PLAYER_NOT_FOUND';
  end if;
  if multiplayer_private.are_friends(v_actor, p_recipient_id) then
    raise exception using errcode = 'P0001', message = 'MP_ALREADY_FRIENDS';
  end if;
  if exists (
    select 1 from public.friend_requests
    where status = 'pending'
      and least(sender_id, recipient_id) = least(v_actor, p_recipient_id)
      and greatest(sender_id, recipient_id) = greatest(v_actor, p_recipient_id)
  ) then
    raise exception using errcode = 'P0001', message = 'MP_FRIEND_REQUEST_EXISTS';
  end if;

  insert into public.friend_requests (sender_id, recipient_id)
  values (v_actor, p_recipient_id)
  returning * into v_request;
  return to_jsonb(v_request);
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_request public.friend_requests%rowtype;
begin
  if p_accept is null then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_DECISION';
  end if;
  select * into v_request from public.friend_requests
  where id = p_request_id for update;
  if not found or v_request.recipient_id <> v_actor then
    raise exception using errcode = 'P0001', message = 'MP_FRIEND_REQUEST_NOT_FOUND';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'MP_REQUEST_ALREADY_RESOLVED';
  end if;
  perform multiplayer_private.lock_pair(v_request.sender_id, v_request.recipient_id);

  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      resolved_at = now()
  where id = p_request_id
  returning * into v_request;

  if p_accept then
    insert into public.friendships (user_low_id, user_high_id)
    values (
      least(v_request.sender_id, v_request.recipient_id),
      greatest(v_request.sender_id, v_request.recipient_id)
    ) on conflict do nothing;
  end if;
  return to_jsonb(v_request);
end;
$$;

create or replace function public.remove_friend(p_friend_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
begin
  if p_friend_id is null or p_friend_id = v_actor then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_TARGET_SELF';
  end if;
  perform multiplayer_private.lock_pair(v_actor, p_friend_id);
  delete from public.friendships
  where user_low_id = least(v_actor, p_friend_id)
    and user_high_id = greatest(v_actor, p_friend_id);
  if not found then
    raise exception using errcode = 'P0001', message = 'MP_NOT_FRIENDS';
  end if;

  update public.alliances set status = 'ended', ended_at = now(), ended_by = v_actor
  where user_low_id = least(v_actor, p_friend_id)
    and user_high_id = greatest(v_actor, p_friend_id)
    and status = 'active';
  update public.alliance_invitations set status = 'cancelled', resolved_at = now()
  where least(sender_id, recipient_id) = least(v_actor, p_friend_id)
    and greatest(sender_id, recipient_id) = greatest(v_actor, p_friend_id)
    and status = 'pending';
  return jsonb_build_object('friendId', p_friend_id, 'removed', true);
end;
$$;

create or replace function public.send_alliance_invitation(p_recipient_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_invitation public.alliance_invitations%rowtype;
begin
  if p_recipient_id is null or p_recipient_id = v_actor then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_TARGET_SELF';
  end if;
  perform multiplayer_private.lock_pair(v_actor, p_recipient_id);
  if not multiplayer_private.are_friends(v_actor, p_recipient_id) then
    raise exception using errcode = 'P0001', message = 'MP_ALLIANCE_REQUIRES_FRIEND';
  end if;
  if multiplayer_private.have_active_alliance(v_actor, p_recipient_id) then
    raise exception using errcode = 'P0001', message = 'MP_ALLIANCE_EXISTS';
  end if;
  if exists (
    select 1 from public.alliance_invitations
    where status = 'pending'
      and least(sender_id, recipient_id) = least(v_actor, p_recipient_id)
      and greatest(sender_id, recipient_id) = greatest(v_actor, p_recipient_id)
  ) then
    raise exception using errcode = 'P0001', message = 'MP_ALLIANCE_INVITATION_EXISTS';
  end if;
  insert into public.alliance_invitations (sender_id, recipient_id)
  values (v_actor, p_recipient_id)
  returning * into v_invitation;
  return to_jsonb(v_invitation);
end;
$$;

create or replace function public.respond_alliance_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_invitation public.alliance_invitations%rowtype;
  v_alliance public.alliances%rowtype;
begin
  if p_accept is null then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_DECISION';
  end if;
  select * into v_invitation from public.alliance_invitations
  where id = p_invitation_id for update;
  if not found or v_invitation.recipient_id <> v_actor then
    raise exception using errcode = 'P0001', message = 'MP_ALLIANCE_INVITATION_NOT_FOUND';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'MP_REQUEST_ALREADY_RESOLVED';
  end if;
  perform multiplayer_private.lock_pair(v_invitation.sender_id, v_invitation.recipient_id);

  if p_accept then
    if not multiplayer_private.are_friends(v_invitation.sender_id, v_invitation.recipient_id) then
      raise exception using errcode = 'P0001', message = 'MP_ALLIANCE_REQUIRES_FRIEND';
    end if;
    if multiplayer_private.have_active_alliance(v_invitation.sender_id, v_invitation.recipient_id) then
      raise exception using errcode = 'P0001', message = 'MP_ALLIANCE_EXISTS';
    end if;
    insert into public.alliances (user_low_id, user_high_id)
    values (
      least(v_invitation.sender_id, v_invitation.recipient_id),
      greatest(v_invitation.sender_id, v_invitation.recipient_id)
    ) returning * into v_alliance;
  end if;

  update public.alliance_invitations
  set status = case when p_accept then 'accepted' else 'declined' end,
      resolved_at = now()
  where id = p_invitation_id
  returning * into v_invitation;

  return jsonb_build_object(
    'invitation', to_jsonb(v_invitation),
    'alliance', case when p_accept then to_jsonb(v_alliance) else null end
  );
end;
$$;

create or replace function public.end_alliance(p_ally_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_alliance public.alliances%rowtype;
begin
  if p_ally_id is null or p_ally_id = v_actor then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_TARGET_SELF';
  end if;
  perform multiplayer_private.lock_pair(v_actor, p_ally_id);
  update public.alliances
  set status = 'ended', ended_at = now(), ended_by = v_actor
  where user_low_id = least(v_actor, p_ally_id)
    and user_high_id = greatest(v_actor, p_ally_id)
    and status = 'active'
  returning * into v_alliance;
  if not found then
    raise exception using errcode = 'P0001', message = 'MP_ALLIANCE_NOT_FOUND';
  end if;
  return to_jsonb(v_alliance);
end;
$$;

create or replace function public.get_normal_income_multiplier()
returns numeric
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
begin
  if exists (
    select 1 from public.alliances
    where status = 'active' and v_actor in (user_low_id, user_high_id)
  ) then
    return 1.5;
  end if;
  return 1.0;
end;
$$;

-- -------------------------------------------------------------------------
-- Atomic financial RPCs. The alliance multiplier is deliberately absent:
-- these functions move nominal transfer/loan amounts and never game income.

create or replace function public.transfer_asset(
  p_recipient_id uuid,
  p_asset text,
  p_amount bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_previous jsonb;
  v_sender jsonb;
  v_recipient jsonb;
  v_sender_balance numeric;
  v_recipient_balance numeric;
  v_transfer public.transfers%rowtype;
  v_result jsonb;
begin
  perform multiplayer_private.validate_amount(p_amount);
  if p_asset not in ('cash', 'diamonds') then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_ASSET';
  end if;
  if p_recipient_id is null or p_recipient_id = v_actor then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_TARGET_SELF';
  end if;
  v_previous := multiplayer_private.begin_operation(
    v_actor, p_idempotency_key, 'transfer',
    jsonb_build_object('recipientId', p_recipient_id, 'asset', p_asset, 'amount', p_amount)
  );
  if v_previous is not null then return v_previous; end if;

  perform multiplayer_private.lock_pair(v_actor, p_recipient_id);
  if not multiplayer_private.have_active_alliance(v_actor, p_recipient_id) then
    raise exception using errcode = 'P0001', message = 'MP_TRANSFER_REQUIRES_ALLIANCE';
  end if;
  perform multiplayer_private.lock_saves(array[least(v_actor, p_recipient_id), greatest(v_actor, p_recipient_id)]);
  v_sender := multiplayer_private.read_save(v_actor);
  v_recipient := multiplayer_private.read_save(p_recipient_id);
  v_sender_balance := multiplayer_private.balance(v_sender, p_asset);
  v_recipient_balance := multiplayer_private.balance(v_recipient, p_asset);
  if v_sender_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'MP_INSUFFICIENT_BALANCE';
  end if;

  v_sender := multiplayer_private.set_balance(v_sender, p_asset, v_sender_balance - p_amount);
  v_recipient := multiplayer_private.set_balance(v_recipient, p_asset, v_recipient_balance + p_amount);
  perform multiplayer_private.write_save(v_actor, v_sender);
  perform multiplayer_private.write_save(p_recipient_id, v_recipient);

  insert into public.transfers (sender_id, recipient_id, asset, amount, idempotency_key)
  values (v_actor, p_recipient_id, p_asset, p_amount, p_idempotency_key)
  returning * into v_transfer;
  v_result := jsonb_build_object(
    'transfer', to_jsonb(v_transfer),
    'balance', v_sender_balance - p_amount
  );
  return multiplayer_private.finish_operation(v_actor, p_idempotency_key, v_result);
end;
$$;

create or replace function public.propose_loan(
  p_borrower_id uuid,
  p_amount bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_previous jsonb;
  v_loan public.loans%rowtype;
  v_result jsonb;
begin
  perform multiplayer_private.validate_amount(p_amount);
  if p_borrower_id is null or p_borrower_id = v_actor then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_TARGET_SELF';
  end if;
  v_previous := multiplayer_private.begin_operation(
    v_actor, p_idempotency_key, 'propose_loan',
    jsonb_build_object('borrowerId', p_borrower_id, 'amount', p_amount)
  );
  if v_previous is not null then return v_previous; end if;
  perform multiplayer_private.lock_pair(v_actor, p_borrower_id);
  if not multiplayer_private.have_active_alliance(v_actor, p_borrower_id) then
    raise exception using errcode = 'P0001', message = 'MP_LOAN_REQUIRES_ALLIANCE';
  end if;

  insert into public.loans (lender_id, borrower_id, amount, proposal_idempotency_key)
  values (v_actor, p_borrower_id, p_amount, p_idempotency_key)
  returning * into v_loan;
  v_result := jsonb_build_object('loan', to_jsonb(v_loan));
  return multiplayer_private.finish_operation(v_actor, p_idempotency_key, v_result);
end;
$$;

create or replace function public.respond_loan(
  p_loan_id uuid,
  p_accept boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_previous jsonb;
  v_loan public.loans%rowtype;
  v_lender jsonb;
  v_borrower jsonb;
  v_lender_balance numeric;
  v_borrower_balance numeric;
  v_result jsonb;
begin
  if p_accept is null then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_DECISION';
  end if;
  v_previous := multiplayer_private.begin_operation(
    v_actor, p_idempotency_key, 'respond_loan',
    jsonb_build_object('loanId', p_loan_id, 'accept', p_accept)
  );
  if v_previous is not null then return v_previous; end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found or v_loan.borrower_id <> v_actor then
    raise exception using errcode = 'P0001', message = 'MP_LOAN_NOT_FOUND';
  end if;
  if v_loan.status <> 'proposed' then
    raise exception using errcode = 'P0001', message = 'MP_LOAN_NOT_PROPOSED';
  end if;
  perform multiplayer_private.lock_pair(v_loan.lender_id, v_loan.borrower_id);

  if not p_accept then
    update public.loans set status = 'rejected', resolved_at = now()
    where id = p_loan_id returning * into v_loan;
    v_result := jsonb_build_object('loan', to_jsonb(v_loan));
    return multiplayer_private.finish_operation(v_actor, p_idempotency_key, v_result);
  end if;

  if not multiplayer_private.have_active_alliance(v_loan.lender_id, v_loan.borrower_id) then
    raise exception using errcode = 'P0001', message = 'MP_LOAN_REQUIRES_ALLIANCE';
  end if;
  perform multiplayer_private.lock_saves(
    array[least(v_loan.lender_id, v_loan.borrower_id), greatest(v_loan.lender_id, v_loan.borrower_id)]
  );
  v_lender := multiplayer_private.read_save(v_loan.lender_id);
  v_borrower := multiplayer_private.read_save(v_loan.borrower_id);
  v_lender_balance := multiplayer_private.balance(v_lender, 'cash');
  v_borrower_balance := multiplayer_private.balance(v_borrower, 'cash');
  if v_lender_balance < v_loan.amount then
    raise exception using errcode = 'P0001', message = 'MP_LENDER_INSUFFICIENT_BALANCE';
  end if;

  v_lender := multiplayer_private.set_balance(v_lender, 'cash', v_lender_balance - v_loan.amount);
  v_borrower := multiplayer_private.set_balance(v_borrower, 'cash', v_borrower_balance + v_loan.amount);
  perform multiplayer_private.write_save(v_loan.lender_id, v_lender);
  perform multiplayer_private.write_save(v_loan.borrower_id, v_borrower);
  update public.loans set status = 'active', accepted_at = now()
  where id = p_loan_id returning * into v_loan;
  v_result := jsonb_build_object('loan', to_jsonb(v_loan));
  return multiplayer_private.finish_operation(v_actor, p_idempotency_key, v_result);
end;
$$;

create or replace function public.repay_loan(
  p_loan_id uuid,
  p_amount bigint,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_previous jsonb;
  v_loan public.loans%rowtype;
  v_borrower jsonb;
  v_lender jsonb;
  v_borrower_balance numeric;
  v_lender_balance numeric;
  v_repayment public.loan_repayments%rowtype;
  v_result jsonb;
begin
  perform multiplayer_private.validate_amount(p_amount);
  v_previous := multiplayer_private.begin_operation(
    v_actor, p_idempotency_key, 'repay_loan',
    jsonb_build_object('loanId', p_loan_id, 'amount', p_amount)
  );
  if v_previous is not null then return v_previous; end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found or v_loan.borrower_id <> v_actor then
    raise exception using errcode = 'P0001', message = 'MP_LOAN_NOT_FOUND';
  end if;
  if v_loan.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'MP_LOAN_NOT_ACTIVE';
  end if;
  if p_amount > v_loan.amount - v_loan.repaid_amount then
    raise exception using errcode = 'P0001', message = 'MP_REPAYMENT_TOO_HIGH';
  end if;
  perform multiplayer_private.lock_pair(v_loan.lender_id, v_loan.borrower_id);
  perform multiplayer_private.lock_saves(
    array[least(v_loan.lender_id, v_loan.borrower_id), greatest(v_loan.lender_id, v_loan.borrower_id)]
  );
  v_borrower := multiplayer_private.read_save(v_loan.borrower_id);
  v_lender := multiplayer_private.read_save(v_loan.lender_id);
  v_borrower_balance := multiplayer_private.balance(v_borrower, 'cash');
  v_lender_balance := multiplayer_private.balance(v_lender, 'cash');
  if v_borrower_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'MP_INSUFFICIENT_BALANCE';
  end if;

  v_borrower := multiplayer_private.set_balance(v_borrower, 'cash', v_borrower_balance - p_amount);
  v_lender := multiplayer_private.set_balance(v_lender, 'cash', v_lender_balance + p_amount);
  perform multiplayer_private.write_save(v_loan.borrower_id, v_borrower);
  perform multiplayer_private.write_save(v_loan.lender_id, v_lender);

  insert into public.loan_repayments (loan_id, borrower_id, amount, idempotency_key)
  values (p_loan_id, v_actor, p_amount, p_idempotency_key)
  returning * into v_repayment;
  update public.loans
  set repaid_amount = repaid_amount + p_amount,
      status = case when repaid_amount + p_amount = amount then 'repaid' else 'active' end,
      resolved_at = case when repaid_amount + p_amount = amount then now() else null end
  where id = p_loan_id returning * into v_loan;
  v_result := jsonb_build_object('loan', to_jsonb(v_loan), 'repayment', to_jsonb(v_repayment));
  return multiplayer_private.finish_operation(v_actor, p_idempotency_key, v_result);
end;
$$;

create or replace function public.sabotage_friend(
  p_target_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_previous jsonb;
  v_attacker jsonb;
  v_target jsonb;
  v_attacker_cash numeric;
  v_target_day bigint;
  v_event public.sabotage_events%rowtype;
  v_result jsonb;
begin
  if p_target_id is null or p_target_id = v_actor then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_TARGET_SELF';
  end if;
  v_previous := multiplayer_private.begin_operation(
    v_actor, p_idempotency_key, 'sabotage', jsonb_build_object('targetId', p_target_id)
  );
  if v_previous is not null then return v_previous; end if;
  perform multiplayer_private.lock_pair(v_actor, p_target_id);
  if not multiplayer_private.are_friends(v_actor, p_target_id) then
    raise exception using errcode = 'P0001', message = 'MP_SABOTAGE_REQUIRES_FRIEND';
  end if;
  if multiplayer_private.have_active_alliance(v_actor, p_target_id) then
    raise exception using errcode = 'P0001', message = 'MP_CANNOT_SABOTAGE_ALLY';
  end if;
  perform multiplayer_private.lock_saves(array[least(v_actor, p_target_id), greatest(v_actor, p_target_id)]);
  v_attacker := multiplayer_private.read_save(v_actor);
  v_target := multiplayer_private.read_save(p_target_id);
  v_attacker_cash := multiplayer_private.balance(v_attacker, 'cash');
  begin
    if jsonb_typeof(v_target -> 'day') <> 'number'
       or (v_target ->> 'day')::numeric <> trunc((v_target ->> 'day')::numeric) then
      raise exception 'bad day';
    end if;
    v_target_day := (v_target ->> 'day')::bigint;
  exception when others then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_TARGET_GAME_DAY';
  end;
  if v_target_day <= 0 then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_TARGET_GAME_DAY';
  end if;
  if exists (
    select 1 from public.sabotage_events
    where target_id = p_target_id and target_game_day = v_target_day
  ) then
    raise exception using errcode = 'P0001', message = 'MP_SABOTAGE_DAILY_LIMIT';
  end if;
  if v_attacker_cash < 1000 then
    raise exception using errcode = 'P0001', message = 'MP_INSUFFICIENT_BALANCE';
  end if;

  insert into public.sabotage_events (
    attacker_id, target_id, target_game_day, cost, idempotency_key
  ) values (v_actor, p_target_id, v_target_day, 1000, p_idempotency_key)
  returning * into v_event;
  v_attacker := multiplayer_private.set_balance(v_attacker, 'cash', v_attacker_cash - 1000);
  perform multiplayer_private.write_save(v_actor, v_attacker);
  v_result := jsonb_build_object('event', to_jsonb(v_event), 'balance', v_attacker_cash - 1000);
  return multiplayer_private.finish_operation(v_actor, p_idempotency_key, v_result);
end;
$$;

-- Pending events are read on startup. The client acknowledges only after it
-- has successfully handed the event to summonLilD, so a crash cannot lose it.
create or replace function public.get_pending_sabotages()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'attacker', jsonb_build_object('id', p.id, 'username', p.display_name),
    'targetGameDay', e.target_game_day,
    'createdAt', e.created_at
  ) order by e.created_at), '[]'::jsonb)
  into v_result
  from public.sabotage_events e
  join public.profiles p on p.id = e.attacker_id
  where e.target_id = v_actor and e.status = 'pending';
  return v_result;
end;
$$;

create or replace function public.acknowledge_sabotage(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_event public.sabotage_events%rowtype;
begin
  select * into v_event from public.sabotage_events
  where id = p_event_id and target_id = v_actor for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'MP_SABOTAGE_NOT_FOUND';
  end if;
  if v_event.status = 'pending' then
    update public.sabotage_events set status = 'applied', applied_at = now()
    where id = p_event_id returning * into v_event;
  end if;
  return to_jsonb(v_event);
end;
$$;

-- -------------------------------------------------------------------------
-- Safe read models. They expose relationship metadata and a whitelisted gym
-- projection, never another player's full save or wallet.

create or replace function public.get_friend_gym_snapshot(p_friend_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_save jsonb;
  v_floors jsonb;
  v_owner jsonb;
begin
  if p_friend_id is null or p_friend_id = v_actor
     or not multiplayer_private.are_friends(v_actor, p_friend_id) then
    raise exception using errcode = 'P0001', message = 'MP_FRIEND_GYM_FORBIDDEN';
  end if;
  select jsonb_build_object('id', id, 'username', display_name)
  into v_owner from public.profiles where id = p_friend_id;
  v_save := multiplayer_private.read_save(p_friend_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'index', floor_row.ordinality - 1,
    'expansion', coalesce(floor_row.floor -> 'expansion', '0'::jsonb),
    'machines', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'uid', machine -> 'uid',
        'type', machine -> 'type',
        'x', machine -> 'x',
        'y', machine -> 'y',
        'rotation', machine -> 'rotation',
        'durability', machine -> 'durability'
      )), '[]'::jsonb)
      from jsonb_array_elements(multiplayer_private.array_or_empty(floor_row.floor -> 'machines')) machine
    ),
    'decor', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'uid', decoration -> 'uid',
        'type', decoration -> 'type',
        'x', decoration -> 'x',
        'y', decoration -> 'y',
        'rotation', decoration -> 'rotation'
      )), '[]'::jsonb)
      from jsonb_array_elements(multiplayer_private.array_or_empty(floor_row.floor -> 'decor')) decoration
    ),
    'walls', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'uid', wall -> 'uid',
        'x', wall -> 'x',
        'y', wall -> 'y',
        'side', wall -> 'side'
      )), '[]'::jsonb)
      from jsonb_array_elements(multiplayer_private.array_or_empty(floor_row.floor -> 'walls')) wall
    )
  ) order by floor_row.ordinality), '[]'::jsonb)
  into v_floors
  from jsonb_array_elements(multiplayer_private.array_or_empty(v_save -> 'floorPlans'))
    with ordinality as floor_row(floor, ordinality);

  return jsonb_build_object(
    'owner', v_owner,
    'level', coalesce(v_save -> 'level', '0'::jsonb),
    'reputation', coalesce(v_save -> 'reputation', '0'::jsonb),
    'satisfaction', coalesce(v_save -> 'satisfaction', '0'::jsonb),
    'activeFloor', coalesce(v_save -> 'activeFloor', '0'::jsonb),
    'floors', v_floors
  );
end;
$$;

create or replace function public.get_multiplayer_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_result jsonb;
begin
  select jsonb_build_object(
    'me', (select jsonb_build_object('id', p.id, 'username', p.display_name)
           from public.profiles p where p.id = v_actor),
    'incomingFriendRequests', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'sender', jsonb_build_object('id', p.id, 'username', p.display_name),
        'createdAt', r.created_at
      ) order by r.created_at desc), '[]'::jsonb)
      from public.friend_requests r join public.profiles p on p.id = r.sender_id
      where r.recipient_id = v_actor and r.status = 'pending'
    ),
    'outgoingFriendRequests', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'recipient', jsonb_build_object('id', p.id, 'username', p.display_name),
        'createdAt', r.created_at
      ) order by r.created_at desc), '[]'::jsonb)
      from public.friend_requests r join public.profiles p on p.id = r.recipient_id
      where r.sender_id = v_actor and r.status = 'pending'
    ),
    'incomingAllianceInvitations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'sender', jsonb_build_object('id', p.id, 'username', p.display_name),
        'createdAt', i.created_at
      ) order by i.created_at desc), '[]'::jsonb)
      from public.alliance_invitations i join public.profiles p on p.id = i.sender_id
      where i.recipient_id = v_actor and i.status = 'pending'
    ),
    'friends', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profile', jsonb_build_object('id', p.id, 'username', p.display_name),
        'friendsSince', f.created_at,
        'alliance', case when a.id is null then null else jsonb_build_object(
          'id', a.id, 'createdAt', a.created_at
        ) end
      ) order by lower(p.display_name::text)), '[]'::jsonb)
      from public.friendships f
      join public.profiles p on p.id = case when f.user_low_id = v_actor then f.user_high_id else f.user_low_id end
      left join public.alliances a on a.user_low_id = f.user_low_id
        and a.user_high_id = f.user_high_id and a.status = 'active'
      where v_actor in (f.user_low_id, f.user_high_id)
    ),
    'loans', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id,
        'lender', jsonb_build_object('id', lender.id, 'username', lender.display_name),
        'borrower', jsonb_build_object('id', borrower.id, 'username', borrower.display_name),
        'amount', l.amount,
        'repaidAmount', l.repaid_amount,
        'status', l.status,
        'createdAt', l.created_at
      ) order by l.created_at desc), '[]'::jsonb)
      from public.loans l
      join public.profiles lender on lender.id = l.lender_id
      join public.profiles borrower on borrower.id = l.borrower_id
      where v_actor in (l.lender_id, l.borrower_id)
        and l.status in ('proposed', 'active')
    )
  ) into v_result;
  return v_result;
end;
$$;

-- -------------------------------------------------------------------------
-- RLS: authenticated players can read only rows in which they participate.
-- Direct writes are intentionally not granted; every mutation goes through a
-- validating SECURITY DEFINER RPC above.

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.alliance_invitations enable row level security;
alter table public.alliances enable row level security;
alter table public.transfers enable row level security;
alter table public.loans enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.sabotage_events enable row level security;
alter table public.financial_idempotency_keys enable row level security;

drop policy if exists friend_requests_participant_read on public.friend_requests;
create policy friend_requests_participant_read on public.friend_requests for select
  to authenticated using (auth.uid() in (sender_id, recipient_id));

drop policy if exists friendships_participant_read on public.friendships;
create policy friendships_participant_read on public.friendships for select
  to authenticated using (auth.uid() in (user_low_id, user_high_id));

drop policy if exists alliance_invitations_participant_read on public.alliance_invitations;
create policy alliance_invitations_participant_read on public.alliance_invitations for select
  to authenticated using (auth.uid() in (sender_id, recipient_id));

drop policy if exists alliances_participant_read on public.alliances;
create policy alliances_participant_read on public.alliances for select
  to authenticated using (auth.uid() in (user_low_id, user_high_id));

drop policy if exists transfers_participant_read on public.transfers;
create policy transfers_participant_read on public.transfers for select
  to authenticated using (auth.uid() in (sender_id, recipient_id));

drop policy if exists loans_participant_read on public.loans;
create policy loans_participant_read on public.loans for select
  to authenticated using (auth.uid() in (lender_id, borrower_id));

drop policy if exists loan_repayments_participant_read on public.loan_repayments;
create policy loan_repayments_participant_read on public.loan_repayments for select
  to authenticated using (exists (
    select 1 from public.loans l
    where l.id = loan_id and auth.uid() in (l.lender_id, l.borrower_id)
  ));

drop policy if exists sabotage_events_participant_read on public.sabotage_events;
create policy sabotage_events_participant_read on public.sabotage_events for select
  to authenticated using (auth.uid() in (attacker_id, target_id));

drop policy if exists financial_idempotency_owner_read on public.financial_idempotency_keys;
create policy financial_idempotency_owner_read on public.financial_idempotency_keys for select
  to authenticated using (auth.uid() = actor_id);

revoke all on table
  public.friend_requests,
  public.friendships,
  public.alliance_invitations,
  public.alliances,
  public.transfers,
  public.loans,
  public.loan_repayments,
  public.sabotage_events,
  public.financial_idempotency_keys
from anon, authenticated;

grant select on table
  public.friend_requests,
  public.friendships,
  public.alliance_invitations,
  public.alliances,
  public.transfers,
  public.loans,
  public.loan_repayments,
  public.sabotage_events,
  public.financial_idempotency_keys
to authenticated;

-- Functions are executable by PUBLIC by default in PostgreSQL. Close that
-- default and grant only the public API to authenticated users.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'multiplayer_private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function);
  end loop;

  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'search_players',
        'send_friend_request',
        'respond_friend_request',
        'remove_friend',
        'send_alliance_invitation',
        'respond_alliance_invitation',
        'end_alliance',
        'get_normal_income_multiplier',
        'transfer_asset',
        'propose_loan',
        'respond_loan',
        'repay_loan',
        'sabotage_friend',
        'get_pending_sabotages',
        'acknowledge_sabotage',
        'get_friend_gym_snapshot',
        'get_multiplayer_overview'
      ])
  loop
    execute format('revoke all on function %s from public, anon', v_function);
    execute format('grant execute on function %s to authenticated', v_function);
  end loop;
end;
$$;

comment on function public.get_friend_gym_snapshot(uuid) is
  'Whitelisted read-only gym snapshot for an accepted friend; never returns wallet or full save data.';
comment on function public.get_normal_income_multiplier() is
  'Returns 1.5 with any active alliance, otherwise 1.0. Apply only to ordinary gameplay income.';
comment on table public.financial_idempotency_keys is
  'Exactly-once ledger for retryable transfer, loan, repayment and sabotage RPCs.';
