import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseMultiplayerApi } from './supabaseMultiplayerApi'

interface RpcReply {
  data: unknown
  error: unknown
}

function clientWith(
  replies: Record<string, RpcReply>,
  calls: Array<{ name: string; args: Record<string, unknown> }> = [],
): SupabaseClient {
  return {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args })
      return replies[name] ?? { data: null, error: new Error(`No reply for ${name}`) }
    },
  } as unknown as SupabaseClient
}

const overview = {
  me: { id: 'me', username: 'Baron' },
  incomingFriendRequests: [],
  outgoingFriendRequests: [],
  incomingAllianceInvitations: [],
  friends: [{
    profile: { id: 'friend', username: 'Koks' },
    friendsSince: '2026-08-20T10:00:00Z',
    alliance: { id: 'alliance', createdAt: '2026-08-20T11:00:00Z' },
  }],
  loans: [{
    id: 'loan',
    lender: { id: 'me', username: 'Baron' },
    borrower: { id: 'friend', username: 'Koks' },
    amount: 500,
    repaidAmount: 100,
    status: 'active',
    createdAt: '2026-08-20T12:00:00Z',
  }],
}

describe('SupabaseMultiplayerApi', () => {
  it('loads an unfinished profile and sends the normalized nickname once chosen', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const api = new SupabaseMultiplayerApi(clientWith({
      get_player_profile: { data: { nickname: null }, error: null },
      set_player_nickname: { data: { nickname: 'Iron Baron' }, error: null },
    }, calls))

    await expect(api.getPlayerProfile()).resolves.toEqual({ nickname: null })
    await expect(api.setPlayerNickname('  Iron   Baron ')).resolves.toEqual({
      nickname: 'Iron Baron',
    })
    expect(calls).toEqual([
      { name: 'get_player_profile', args: {} },
      { name: 'set_player_nickname', args: { p_nickname: 'Iron Baron' } },
    ])
  })

  it('validates and maps the multiplayer overview', async () => {
    const api = new SupabaseMultiplayerApi(clientWith({
      get_multiplayer_overview: { data: overview, error: null },
    }))

    const result = await api.getOverview()

    expect(result.me.username).toBe('Baron')
    expect(result.friends[0]!.alliance?.id).toBe('alliance')
    expect(result.loans[0]!.repaidAmount).toBe(100)
  })

  it('rejects a malformed server payload instead of casting it', async () => {
    const api = new SupabaseMultiplayerApi(clientWith({
      get_multiplayer_overview: { data: { ...overview, friends: 'private-json' }, error: null },
    }))

    await expect(api.getOverview()).rejects.toMatchObject({ code: 'MP_UNKNOWN' })
  })

  it('maps the whitelisted friend gym snapshot', async () => {
    const api = new SupabaseMultiplayerApi(clientWith({
      get_friend_gym_snapshot: {
        data: {
          owner: { id: 'friend', username: 'Koks' },
          level: 8,
          reputation: 72.5,
          satisfaction: 91,
          activeFloor: 0,
          floors: [{
            index: 0,
            expansion: 1,
            machines: [{ uid: 'm1', type: 'bench', x: 2, y: 3, rotation: 1, durability: 80 }],
            decor: [{ uid: 'd1', type: 'plant', x: 0, y: 0, rotation: 0 }],
            walls: [{ uid: 'w1', x: 1, y: 1, side: 'n' }],
          }],
        },
        error: null,
      },
    }))

    const result = await api.getFriendGym('friend')

    expect(result.owner.username).toBe('Koks')
    expect(result.floors[0]!.machines[0]).toMatchObject({ type: 'bench', durability: 80 })
  })

  it('passes exact transfer parameters and pulls the wallet after success', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const afterWalletMutation = vi.fn(async () => undefined)
    const api = new SupabaseMultiplayerApi(clientWith({
      transfer_asset: {
        data: {
          transfer: {
            id: 'transfer-1',
            sender_id: 'me',
            recipient_id: 'friend',
            asset: 'diamonds',
            amount: 3,
            created_at: '2026-08-20T12:00:00Z',
          },
          balance: 7,
        },
        error: null,
      },
    }, calls), { afterWalletMutation })

    const result = await api.transfer({
      recipientId: 'friend',
      asset: 'diamonds',
      amount: 3,
      idempotencyKey: 'operation-123',
    })

    expect(result).toMatchObject({ recipientId: 'friend', asset: 'diamonds', amount: 3 })
    expect(calls).toEqual([{
      name: 'transfer_asset',
      args: {
        p_recipient_id: 'friend',
        p_asset: 'diamonds',
        p_amount: 3,
        p_idempotency_key: 'operation-123',
      },
    }])
    expect(afterWalletMutation).toHaveBeenCalledOnce()
  })

  it('refreshes the cached bonus after ending an alliance', async () => {
    const afterRelationshipMutation = vi.fn(async () => undefined)
    const api = new SupabaseMultiplayerApi(clientWith({
      end_alliance: { data: { id: 'alliance' }, error: null },
    }), { afterRelationshipMutation })

    await api.endAlliance('friend')

    expect(afterRelationshipMutation).toHaveBeenCalledOnce()
  })

  it('maps database error codes to stable Polish domain errors', async () => {
    const api = new SupabaseMultiplayerApi(clientWith({
      sabotage_friend: { data: null, error: { message: 'MP_CANNOT_SABOTAGE_ALLY' } },
    }))

    await expect(api.sabotage({
      targetId: 'friend',
      idempotencyKey: 'operation-456',
    })).rejects.toMatchObject({ code: 'MP_CANNOT_SABOTAGE_ALLY' })
  })

  it('parses pending sabotage inbox events', async () => {
    const api = new SupabaseMultiplayerApi(clientWith({
      get_pending_sabotages: {
        data: [{
          id: 'event-1',
          attacker: { id: 'enemy', username: 'Łobuz' },
          targetGameDay: 4,
          createdAt: '2026-08-20T13:00:00Z',
        }],
        error: null,
      },
    }))

    await expect(api.getPendingSabotages()).resolves.toEqual([{
      id: 'event-1',
      attacker: { id: 'enemy', username: 'Łobuz' },
      targetGameDay: 4,
      createdAt: '2026-08-20T13:00:00Z',
    }])
  })
})
