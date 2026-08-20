/**
 * Public surface of the account + cloud save layer.
 *
 * Nothing here touches the game engine. The store layer wires it up: call
 * `getAccountService().start()` once, push serialized saves into
 * `service.cloud.push(raw)`, and listen with `onCloudEvent` for saves that
 * arrive from the cloud so they can be deserialized into the running game.
 */
export { AccountService, getAccountService } from './account'
export type { AccountState, AccountServiceOptions } from './account'
export { SupabaseAuthService } from './auth'
export type { AccountSession, AuthService, SignUpResult } from './auth'
export { CloudSaveService } from './cloudSave'
export type {
  AdoptReason,
  AttachOutcome,
  AttachResult,
  CloudSaveEvent,
  CloudSaveOptions,
  CloudSaveSnapshot,
  PushOutcome,
  PushResult,
  SyncStatus,
} from './cloudSave'
export { isCloudConfigured, readCloudConfig } from './config'
export type { CloudConfig } from './config'
export { localSaveStore } from './localSaveStore'
export { MemoryLocalStore, MemorySaveRepository } from './memorySaveRepository'
export { messageFor, toCloudError } from './messages'
export { localWins, newestWins, remoteWins } from './resolve'
export type { ConflictResolver, SaveWinner } from './resolve'
export { SupabaseSaveRepository } from './supabaseSaveRepository'
export { createSupabaseClient, getSupabaseClient } from './supabaseClient'
export { CloudError } from './types'
export type {
  CloudErrorCode,
  CloudSaveRecord,
  CloudSaveStamp,
  LocalSaveStore,
  SaveRepository,
  SaveState,
} from './types'
export { useAccount, useCloudSaveEvents } from './useAccount'
export type { UseAccount } from './useAccount'
