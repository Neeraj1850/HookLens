import { useCallback, useEffect, useState } from 'react'
import { discoverAllHookAddresses } from '../api/hookDiscovery'
import { UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN } from '../config/constants'
import type { HookAddressDiscovery } from '../types/hook'

/** Chain IDs that have a configured subgraph — used to drive the chain selector */
export const CONFIGURED_CHAIN_IDS = Object.keys(UNISWAP_V4_SUBGRAPH_IDS_BY_CHAIN).map(Number)

export function useHookAddressDiscovery(selectedChainIds?: number[]) {
  const [discovery, setDiscovery] = useState<HookAddressDiscovery | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHooks = useCallback(
    async (chainIds?: number[]) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await discoverAllHookAddresses(
          chainIds ?? selectedChainIds,
        )
        setDiscovery(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hook dashboard query failed')
        setDiscovery(null)
      } finally {
        setIsLoading(false)
      }
    },
    [selectedChainIds],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchHooks()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchHooks])

  return {
    discovery,
    isLoading,
    error,
    fetchHooks,
  }
}
