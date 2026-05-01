import { create } from 'zustand'
import type { FullHookInspection, HookPool, PoolDiscovery } from '../types/hook'
import type { HookQuoteComparison, TokenDef } from '../types/uniswap'
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
  simTokensSource: string | null
  simAmount: string
  simChainId: number
  quoteComparison: HookQuoteComparison | null
  isFetchingQuotes: boolean
  quoteError: string | null
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
  setSimAmount(amount: string): void
  setSimChainId(chainId: number): void
  setQuoteComparison(comparison: HookQuoteComparison | null): void
  setFetchingQuotes(val: boolean): void
  setQuoteError(err: string | null): void
  setPoolDiscovery(discovery: PoolDiscovery | null): void
  setFetchingPools(val: boolean): void
  setPoolFetchError(err: string | null): void
  swapTokens(): void
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
  simTokensSource: null,
  simAmount: '1',
  simChainId: 8453,
  quoteComparison: null,
  isFetchingQuotes: false,
  quoteError: null,
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
        simTokensSource: isNewHook ? null : state.simTokensSource,
        simChainId: inspection.decoded.chainId,
        quoteComparison: isNewHook ? null : state.quoteComparison,
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
      simTokensSource: null,
      quoteComparison: null,
    }),

  addToHistory: (address, chainId) => {
    const existing = get().history
    const filtered = existing.filter((h) => h.address !== address)
    set({ history: [{ address, chainId }, ...filtered].slice(0, 5) })
  },

  clearHistory: () => set({ history: [] }),

  setSimTokenIn: (token) => set({ simTokenIn: token, simTokensSource: null, quoteComparison: null }),
  setSimTokenOut: (token) => set({ simTokenOut: token, simTokensSource: null, quoteComparison: null }),
  setSimTokensFromPool: (token0, token1, chainId) =>
    set(() => ({
      simTokenIn: poolTokenToTokenDef(token0, chainId),
      simTokenOut: poolTokenToTokenDef(token1, chainId),
      simChainId: chainId,
      simTokensSource: `${token0.symbol}/${token1.symbol}`,
      quoteComparison: null,
    })),
  setSimAmount: (amount) => set({ simAmount: amount, quoteComparison: null }),
  setSimChainId: (chainId) => set({ simChainId: chainId, simTokensSource: null }),
  setQuoteComparison: (comparison) => set({ quoteComparison: comparison }),
  setFetchingQuotes: (val) => set({ isFetchingQuotes: val }),
  setQuoteError: (err) => set({ quoteError: err }),
  setPoolDiscovery: (discovery) => set({ poolDiscovery: discovery }),
  setFetchingPools: (val) => set({ isFetchingPools: val }),
  setPoolFetchError: (err) => set({ poolFetchError: err }),
  swapTokens: () =>
    set((state) => ({
      simTokenIn: state.simTokenOut,
      simTokenOut: state.simTokenIn,
      simTokensSource: state.simTokensSource,
      quoteComparison: null,
    })),
}))
