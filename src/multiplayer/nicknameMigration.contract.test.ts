import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260821090000_player_nickname_onboarding.sql?raw'

describe('player nickname migration contract', () => {
  it('marks explicit nicknames and keeps unfinished profiles out of search', () => {
    expect(migration).toMatch(/add column if not exists nickname_set_at timestamptz/i)
    expect(migration).toMatch(/where display_name is not null and nickname_set_at is not null/i)
    expect(migration).toMatch(/p\.nickname_set_at is not null/i)
    expect(migration).toMatch(/values \(new\.id, null, null\)/i)
  })

  it('makes nickname selection one-time, validated and race-safe', () => {
    expect(migration).toMatch(/create or replace function public\.set_player_nickname/i)
    expect(migration).toMatch(/for update/i)
    expect(migration).toMatch(/MP_NICKNAME_ALREADY_SET/i)
    expect(migration).toMatch(/char_length\(v_nickname\) not between 3 and 20/i)
    expect(migration).toMatch(/when unique_violation then[\s\S]*MP_NICKNAME_TAKEN/i)
  })

  it('prevents direct profile edits and exposes only authenticated RPC access', () => {
    expect(migration).toMatch(/revoke update on table public\.profiles from authenticated/i)
    expect(migration).toMatch(/revoke execute on function public\.handle_new_user\(\) from public, anon, authenticated/i)
    expect(migration).toMatch(/revoke all on function public\.set_player_nickname\(text\) from public, anon/i)
    expect(migration).toMatch(/grant execute on function public\.set_player_nickname\(text\) to authenticated/i)
  })
})
