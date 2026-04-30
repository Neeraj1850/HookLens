import { useCallback } from 'react'
import { useHookStore } from '../store/hookStore'
import { decodeHook } from '../utils/flagDecoder'
import { validateHookAddress } from '../utils/address'
import type { FullHookInspection } from '../types/hook'

export function useHookDecoder() {
  const {
    currentAddress,
    currentChainId,
    currentInspection,
    isDecoding,
    decodeError,
    setDecoding,
    setDecodeError,
    setInspection,
    addToHistory,
  } = useHookStore()

  const decode = useCallback(
    async (address: string, chainId: number) => {
      setDecoding(true)
      setDecodeError(null)

      try {
        const validation = validateHookAddress(address)
        if (!validation.valid || !validation.checksummed) {
          throw new Error(validation.error ?? 'Invalid address')
        }

        const decoded = decodeHook(validation.checksummed, chainId)

        const inspection: FullHookInspection = {
          decoded,
          inspectedAt: Date.now(),
        }

        setInspection(inspection)
        addToHistory(validation.checksummed, chainId)

        return inspection
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to decode hook'
        setDecodeError(message)
        return null
      } finally {
        setDecoding(false)
      }
    },
    [setDecoding, setDecodeError, setInspection, addToHistory],
  )

  return {
    currentAddress,
    currentChainId,
    currentInspection,
    isDecoding,
    decodeError,
    decode,
  }
}
