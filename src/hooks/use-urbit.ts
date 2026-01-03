/**
 * Urbit integration hook
 * Provides planet claiming and verification functionality
 */

import { useState, useEffect, useCallback } from 'react'
import { getUrbitService, PlanetInfo, PlanetInvite } from '../lib/urbit'
import { useAuth } from '../contexts/AuthContext'

interface UrbitState {
  isConfigured: boolean
  isLoading: boolean
  error: string | null
  availablePlanets: number
  userPlanets: PlanetInfo[]
  pendingInvite: PlanetInvite | null
}

interface UseUrbitReturn extends UrbitState {
  claimPlanet: () => Promise<PlanetInvite | null>
  refreshStats: () => Promise<void>
  verifyOwnership: (patp: string) => Promise<boolean>
}

export function useUrbit(): UseUrbitReturn {
  const { authState } = useAuth()
  const urbit = getUrbitService()

  const [state, setState] = useState<UrbitState>({
    isConfigured: false,
    isLoading: true,
    error: null,
    availablePlanets: 0,
    userPlanets: [],
    pendingInvite: null
  })

  // Load initial state
  useEffect(() => {
    let mounted = true

    async function loadState() {
      try {
        const isConfigured = urbit.isConfigured()
        const availablePlanets = await urbit.getAvailablePlanets()
        const userPlanets = authState.user?.id
          ? urbit.getPlanetsForUser(authState.user.id)
          : []

        if (mounted) {
          setState(prev => ({
            ...prev,
            isConfigured,
            isLoading: false,
            availablePlanets,
            userPlanets
          }))
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load Urbit state'
          }))
        }
      }
    }

    loadState()
    return () => { mounted = false }
  }, [authState.user?.id])

  /**
   * Request a planet invite for the current user
   */
  const claimPlanet = useCallback(async (): Promise<PlanetInvite | null> => {
    if (!authState.user?.id) {
      setState(prev => ({ ...prev, error: 'Must be logged in to claim a planet' }))
      return null
    }

    if (!urbit.isConfigured()) {
      setState(prev => ({ ...prev, error: 'Urbit star not configured yet' }))
      return null
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const invite = await urbit.generatePlanetInvite(authState.user.id)

      setState(prev => ({
        ...prev,
        isLoading: false,
        pendingInvite: invite,
        availablePlanets: prev.availablePlanets - 1
      }))

      return invite
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate planet invite'
      }))
      return null
    }
  }, [authState.user?.id])

  /**
   * Refresh stats from the Urbit service
   */
  const refreshStats = useCallback(async () => {
    try {
      const availablePlanets = await urbit.getAvailablePlanets()
      const userPlanets = authState.user?.id
        ? urbit.getPlanetsForUser(authState.user.id)
        : []

      setState(prev => ({
        ...prev,
        availablePlanets,
        userPlanets
      }))
    } catch (error) {
      console.error('Failed to refresh Urbit stats:', error)
    }
  }, [authState.user?.id])

  /**
   * Verify ownership of a planet
   */
  const verifyOwnership = useCallback(async (patp: string): Promise<boolean> => {
    return urbit.verifyPlanetOwnership(patp)
  }, [])

  return {
    ...state,
    claimPlanet,
    refreshStats,
    verifyOwnership
  }
}

export default useUrbit
