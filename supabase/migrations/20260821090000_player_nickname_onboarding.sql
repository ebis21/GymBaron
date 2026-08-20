-- One-time player nickname onboarding.
--
-- Accounts used to receive the local part of their email as display_name.
-- That was never a player choice and could leak part of an email through
-- social search. nickname_set_at distinguishes an explicit nickname from
-- that legacy placeholder without breaking existing relationship rows.

alter table public.profiles
  add column if not exists nickname_set_at timestamptz;

comment on column public.profiles.nickname_set_at is
  'Set once when the player explicitly chooses their public multiplayer nickname.';

-- Only explicitly chosen names reserve a public nickname. Legacy email-based
-- placeholders stay on their rows until onboarding replaces them, but cannot
-- block another player from choosing that name.
drop index if exists public.profiles_display_name_lower_unique;
create unique index profiles_display_name_lower_unique
  on public.profiles (lower(btrim(display_name)))
  where display_name is not null and nickname_set_at is not null;

-- New accounts start private and unsearchable. The client asks for a nickname
-- after account creation (and, later, after the tutorial).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, nickname_set_at)
  values (new.id, null, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.get_player_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where id = v_actor;

  if not found then
    raise exception using errcode = 'P0001', message = 'MP_PLAYER_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'nickname', case
      when v_profile.nickname_set_at is null then null
      else v_profile.display_name
    end
  );
end;
$$;

create or replace function public.set_player_nickname(p_nickname text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := multiplayer_private.current_actor();
  v_nickname text := regexp_replace(btrim(coalesce(p_nickname, '')), '[[:space:]]+', ' ', 'g');
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MP_PLAYER_NOT_FOUND';
  end if;
  if v_profile.nickname_set_at is not null then
    raise exception using errcode = 'P0001', message = 'MP_NICKNAME_ALREADY_SET';
  end if;
  if char_length(v_nickname) not between 3 and 20
     or v_nickname !~ '^[[:alnum:]][[:alnum:] _-]*[[:alnum:]]$' then
    raise exception using errcode = 'P0001', message = 'MP_INVALID_NICKNAME';
  end if;

  update public.profiles
  set display_name = v_nickname,
      nickname_set_at = now()
  where id = v_actor;

  return jsonb_build_object('nickname', v_nickname);
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'MP_NICKNAME_TAKEN';
end;
$$;

-- Only completed profiles are discoverable. Matching remains prefix-based so
-- typing the chosen nickname is enough to find and invite a friend.
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
    and p.nickname_set_at is not null
    and lower(btrim(p.display_name::text)) like replace(replace(v_query, '%', '\%'), '_', '\_') || '%' escape '\'
  order by (lower(btrim(p.display_name::text)) = v_query) desc, lower(btrim(p.display_name::text))
  limit 20;
end;
$$;

-- Public profile fields can no longer be bypassed with a direct table update;
-- the one-time RPC owns validation, uniqueness and the completion marker.
revoke update on table public.profiles from authenticated;
drop policy if exists profiles_update_own on public.profiles;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.get_player_profile() from public, anon;
grant execute on function public.get_player_profile() to authenticated;
revoke all on function public.set_player_nickname(text) from public, anon;
grant execute on function public.set_player_nickname(text) to authenticated;

comment on function public.set_player_nickname(text) is
  'Sets an authenticated player public nickname exactly once, after validating uniqueness and format.';
