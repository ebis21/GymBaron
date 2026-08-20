-- Accounts and cloud saves for Gymbaron.
--
-- Two tables, both keyed by the auth user and both readable only by that user:
--   profiles    — the account row, created automatically on sign-up
--   game_saves  — one full save per account, guarded by a revision counter
--
-- The save JSON never leaves the owner's session: `anon` is revoked outright
-- and every policy is scoped to `auth.uid()`, so an unauthenticated request
-- cannot see a single byte of anybody's gym.

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'One row per account. Created automatically by the auth.users trigger.';

-- --------------------------------------------------------------------------
-- game_saves
-- --------------------------------------------------------------------------

create table if not exists public.game_saves (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  state        jsonb  not null,
  revision     bigint not null default 1,
  save_version integer not null default 0,
  updated_at   timestamptz not null default now()
);

comment on table public.game_saves is
  'Full serialized game state, one row per account.';
comment on column public.game_saves.revision is
  'Monotonic counter bumped by trigger on every write. Clients pass the '
  'revision they last saw as an optimistic-concurrency guard, so a stale '
  'device cannot overwrite a newer save.';
comment on column public.game_saves.save_version is
  'Mirror of the engine SAVE_VERSION the state was written with, so a '
  'server-side migration can find rows to upgrade without parsing the JSON.';

-- Cheap change detection: clients poll (revision, updated_at) rather than
-- pulling the whole document to find out whether anything moved.
create index if not exists game_saves_updated_at_idx
  on public.game_saves (updated_at desc);

-- --------------------------------------------------------------------------
-- Triggers
-- --------------------------------------------------------------------------

/*
 * Owns the revision counter so no writer can forget it — including the RPCs
 * another service may add later to adjust cash or diamonds inside `state`.
 * Any successful UPDATE moves the revision forward exactly one step, which is
 * what makes `where revision = <expected>` a sound compare-and-swap.
 */
create or replace function public.game_saves_bump_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.revision   := old.revision + 1;
  new.updated_at := now();
  -- The owner is the primary key and the RLS anchor; moving a save between
  -- accounts is never a legitimate update.
  new.user_id    := old.user_id;
  return new;
end;
$$;

drop trigger if exists game_saves_bump_revision on public.game_saves;
create trigger game_saves_bump_revision
  before update on public.game_saves
  for each row execute function public.game_saves_bump_revision();

create or replace function public.profiles_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.profiles_touch_updated_at();

/*
 * Gives every new account its profile row in the same transaction as the
 * sign-up, so the client never has to handle a half-created account. Runs as
 * definer because the new user has no session yet and so cannot pass RLS.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anything in the `public` schema is also an RPC endpoint. These three exist
-- only to be fired by their triggers, and `handle_new_user` runs as definer —
-- leaving it callable would publish a privileged endpoint for no reason.
revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.game_saves_bump_revision() from public, anon, authenticated;
revoke execute on function public.profiles_touch_updated_at() from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Row level security
-- --------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.game_saves enable row level security;

-- No anonymous reach at all. Without this, a future blanket grant in the
-- public schema would be the only thing between a leaked save and the world.
revoke all on public.profiles   from anon;
revoke all on public.game_saves from anon;

grant select, update                 on public.profiles   to authenticated;
grant select, insert, update, delete on public.game_saves to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists game_saves_select_own on public.game_saves;
create policy game_saves_select_own on public.game_saves
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists game_saves_insert_own on public.game_saves;
create policy game_saves_insert_own on public.game_saves
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists game_saves_update_own on public.game_saves;
create policy game_saves_update_own on public.game_saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists game_saves_delete_own on public.game_saves;
create policy game_saves_delete_own on public.game_saves
  for delete to authenticated
  using ((select auth.uid()) = user_id);
