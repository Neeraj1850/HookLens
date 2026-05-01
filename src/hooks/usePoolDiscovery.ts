import { useCallback } from 'react'
import { discoverPools } from '../api/poolDiscovery'
import { useHookStore } from '../store/hookStore'

export function usePoolDiscovery() {
  const {
    currentInspection,
    poolDiscovery,
    isFetchingPools,
    poolFetchError,
    setPoolDiscovery,
    setFetchingPools,
    setPoolFetchError,
    setSimTokensFromPool,
  } = useHookStore()

  const fetchPools = useCallback(async () => {
    if (!currentInspection) return

    setFetchingPools(true)
    setPoolFetchError(null)

    try {
      const result = await discoverPools(
        currentInspection.decoded.address,
        currentInspection.decoded.chainId,
      )
      setPoolDiscovery(result)
      if (result.pools[0]) {
        setSimTokensFromPool(
          result.pools[0].token0,
          result.pools[0].token1,
          result.pools[0].chainId,
        )
      }
      if (result.error) setPoolFetchError(result.error)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pool lookup failed'
      setPoolFetchError(msg)
      setPoolDiscovery(null)
    } finally {
      setFetchingPools(false)
    }
  }, [
    currentInspection,
    setFetchingPools,
    setPoolFetchError,
    setPoolDiscovery,
    setSimTokensFromPool,
  ])

  return {
    poolDiscovery,
    isFetchingPools,
    poolFetchError,
    fetchPools,
  }
}
