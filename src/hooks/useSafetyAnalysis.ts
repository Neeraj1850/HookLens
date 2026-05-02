import { useCallback } from 'react'
import { analyzeHook } from '../api/safetyAnalyzer'
import { fetchContractFromSourcify } from '../api/sourcify'
import { useHookStore } from '../store/hookStore'
import type { SafetyAnalysis } from '../types/hook'

export function useSafetyAnalysis() {
  const { currentInspection, setInspection } = useHookStore()

  const runAnalysis = useCallback(
    async (address: string, chainId: number): Promise<SafetyAnalysis | null> => {
      if (!currentInspection) return null

      try {
        const source = await fetchContractFromSourcify(address, chainId)
        const analysis = await analyzeHook(source, currentInspection.decoded.flags)

        setInspection({
          ...currentInspection,
          safety: analysis,
        })

        return analysis
      } catch {
        return null
      }
    },
    [currentInspection, setInspection],
  )

  return {
    safety: currentInspection?.safety ?? null,
    runAnalysis,
  }
}
