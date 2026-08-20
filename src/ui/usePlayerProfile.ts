import { useCallback, useEffect, useState } from 'react'
import {
  getMultiplayerApi,
  multiplayerErrorCode,
  type MultiplayerApi,
  type MultiplayerErrorCode,
  type PlayerProfile,
} from '../multiplayer'

interface PlayerProfileState {
  profile: PlayerProfile | null
  loading: boolean
  saving: boolean
  error: MultiplayerErrorCode | null
}

export interface UsePlayerProfile extends PlayerProfileState {
  chooseNickname: (nickname: string) => Promise<boolean>
  retry: () => void
}

/**
 * Loads the public profile only for an authenticated account. A null nickname
 * is intentional state: it means onboarding must finish before social play.
 */
export function usePlayerProfile(
  userId: string | null,
  api: MultiplayerApi = getMultiplayerApi(),
): UsePlayerProfile {
  const [state, setState] = useState<PlayerProfileState>({
    profile: null,
    loading: userId !== null,
    saving: false,
    error: null,
  })
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let current = true
    if (!userId) {
      setState({ profile: null, loading: false, saving: false, error: null })
      return () => { current = false }
    }

    setState(previous => ({ ...previous, profile: null, loading: true, error: null }))
    api.getPlayerProfile()
      .then(profile => {
        if (current) setState({ profile, loading: false, saving: false, error: null })
      })
      .catch(cause => {
        if (current) {
          setState({
            profile: null,
            loading: false,
            saving: false,
            error: multiplayerErrorCode(cause),
          })
        }
      })
    return () => { current = false }
  }, [api, generation, userId])

  const chooseNickname = useCallback(async (nickname: string): Promise<boolean> => {
    if (!userId || state.saving) return false
    setState(previous => ({ ...previous, saving: true, error: null }))
    try {
      const profile = await api.setPlayerNickname(nickname)
      setState({ profile, loading: false, saving: false, error: null })
      return true
    } catch (cause) {
      setState(previous => ({
        ...previous,
        saving: false,
        error: multiplayerErrorCode(cause),
      }))
      return false
    }
  }, [api, state.saving, userId])

  return {
    ...state,
    chooseNickname,
    retry: () => setGeneration(value => value + 1),
  }
}
