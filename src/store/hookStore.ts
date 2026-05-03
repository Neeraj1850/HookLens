import { create } from 'zustand'
import type { FullHookInspection, HookPool, PoolDiscovery } from '../types/hook'
import type { TokenDef } from '../types/uniswap'
import { poolTokenToTokenDef } from '../utils/token'

interface HookStore {
  currentAddress: string
  currentChainId: number
  currentInspection: FullHookInspection | null
  isDecoding: boolean
  decodeError: string | null
  isAnalyzing: boolean
  analysisError: string | null
  history: { address: string; chainId: number; label?: string }[]
  simTokenIn: TokenDef | null
  simTokenOut: TokenDef | null
  simChainId: number
  poolDiscovery: PoolDiscovery | null
  isFetchingPools: boolean
  poolFetchError: string | null
  setAddress(address: string): void
  setChainId(chainId: number): void
  setDecoding(val: boolean): void
  setDecodeError(err: string | null): void
  setAnalyzing(val: boolean): void
  setAnalysisError(err: string | null): void
  setInspection(inspection: FullHookInspection): void
  clearInspection(): void
  addToHistory(address: string, chainId: number): void
  clearHistory(): void
  setSimTokenIn(token: TokenDef | null): void
  setSimTokenOut(token: TokenDef | null): void
  setSimTokensFromPool(token0: HookPool['token0'], token1: HookPool['token1'], chainId: number): void
  setSimChainId(chainId: number): void
  setPoolDiscovery(discovery: PoolDiscovery | null): void
  setFetchingPools(val: boolean): void
  setPoolFetchError(err: string | null): void
}

export const useHookStore = create<HookStore>((set, get) => ({
  currentAddress: '',
  currentChainId: 8453,
  currentInspection: null,
  isDecoding: false,
  decodeError: null,
  isAnalyzing: false,
  analysisError: null,
  history: [],
  simTokenIn: null,
  simTokenOut: null,
  simChainId: 8453,
  poolDiscovery: null,
  isFetchingPools: false,
  poolFetchError: null,

  setAddress: (address) => set({ currentAddress: address }),
  setChainId: (chainId) => set({ currentChainId: chainId }),
  setDecoding: (val) => set({ isDecoding: val }),
  setDecodeError: (err) => set({ decodeError: err }),
  setAnalyzing: (val) => set({ isAnalyzing: val }),
  setAnalysisError: (err) => set({ analysisError: err }),

  setInspection: (inspection) =>
    set((state) => {
      const isNewHook =
        state.currentInspection?.decoded.address.toLowerCase() !==
          inspection.decoded.address.toLowerCase() ||
        state.currentInspection?.decoded.chainId !== inspection.decoded.chainId

      return {
        currentInspection: inspection,
        isDecoding: false,
        decodeError: null,
        simTokenIn: isNewHook ? null : state.simTokenIn,
        simTokenOut: isNewHook ? null : state.simTokenOut,
        simChainId: inspection.decoded.chainId,
        poolDiscovery: isNewHook ? null : state.poolDiscovery,
        poolFetchError: isNewHook ? null : state.poolFetchError,
      }
    }),

  clearInspection: () =>
    set({
      currentInspection: null,
      decodeError: null,
      analysisError: null,
      poolDiscovery: null,
      poolFetchError: null,
    }),

  addToHistory: (address, chainId) => {
    const existing = get().history
    const filtered = existing.filter((h) => h.address !== address)
    set({ history: [{ address, chainId }, ...filtered].slice(0, 5) })
  },

  clearHistory: () => set({ history: [] }),

  setSimTokenIn: (token) => set({ simTokenIn: token }),
  setSimTokenOut: (token) => set({ simTokenOut: token }),
  setSimTokensFromPool: (token0, token1, chainId) =>
    set(() => ({
      simTokenIn: poolTokenToTokenDef(token0, chainId),
      simTokenOut: poolTokenToTokenDef(token1, chainId),
      simChainId: chainId,
    })),
  setSimChainId: (chainId) => set({ simChainId: chainId }),
  setPoolDiscovery: (discovery) => set({ poolDiscovery: discovery }),
  setFetchingPools: (val) => set({ isFetchingPools: val }),
  setPoolFetchError: (err) => set({ poolFetchError: err }),
}))
