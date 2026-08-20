import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260820210000_multiplayer.sql?raw'

describe('multiplayer migration security contract', () => {
  it('enables RLS on every user-facing multiplayer table and grants no direct writes', () => {
    const tables = [
      'friend_requests',
      'friendships',
      'alliance_invitations',
      'alliances',
      'transfers',
      'loans',
      'loan_repayments',
      'sabotage_events',
      'financial_idempotency_keys',
    ]
    for (const table of tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
    expect(migration).toContain('revoke all on table')
    expect(migration).not.toMatch(/create policy[\s\S]{0,100}for (insert|update|delete)/i)
  })

  it('locks saves, increments revisions and keeps retry results', () => {
    expect(migration).toContain('order by user_id for update')
    expect(migration).toContain('revision = revision + 1')
    expect(migration).toContain('primary key (actor_id, idempotency_key)')
    expect(migration).toContain('MP_IDEMPOTENCY_CONFLICT')
  })

  it('whitelists the friend snapshot instead of returning a full save', () => {
    const snapshotFunction = migration.slice(
      migration.indexOf('create or replace function public.get_friend_gym_snapshot'),
      migration.indexOf('create or replace function public.get_multiplayer_overview'),
    )
    expect(snapshotFunction).toContain("'machines'")
    expect(snapshotFunction).toContain("'decor'")
    expect(snapshotFunction).toContain("'walls'")
    expect(snapshotFunction).not.toMatch(/'cash'|'diamonds'|'inventory'|'staff'|'clients'/)
  })
})
