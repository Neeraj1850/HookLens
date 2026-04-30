import { create } from 'zustand'
import type { FullHookInspection } from '../types/hook'
import type { HookQuoteComparison, TokenDef } from '../types/uniswap'

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
  simAmount: string
  simChainId: number
  quoteComparison: HookQuoteComparison | null
  isFetchingQuotes: boolean
  quoteError: string | null
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
  setSimAmount(amount: string): void
  setSimChainId(chainId: number): void
  setQuoteComparison(comparison: HookQuoteComparison | null): void
  setFetchingQuotes(val: boolean): void
  setQuoteError(err: string | null): void
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
  simAmount: '1',
  simChainId: 8453,
  quoteComparison: null,
  isFetchingQuotes: false,
  quoteError: null,

  setAddress: (address) => set({ currentAddress: address }),
  setChainId: (chainId) => set({ currentChainId: chainId }),
  setDecoding: (val) => set({ isDecoding: val }),
  setDecodeError: (err) => set({ decodeError: err }),
  setAnalyzing: (val) => set({ isAnalyzing: val }),
  setAnalysisError: (err) => set({ analysisError: err }),

  setInspection: (inspection) =>
    set({
      currentInspection: inspection,
      isDecoding: false,
      decodeError: null,
    }),

  clearInspection: () =>
    set({
      currentInspection: null,
      decodeError: null,
      analysisError: null,
    }),

  addToHistory: (address, chainId) => {
    const existing = get().history
    const filtered = existing.filter((h) => h.address !== address)
    set({ history: [{ address, chainId }, ...filtered].slice(0, 5) })
  },

  clearHistory: () => set({ history: [] }),

  setSimTokenIn: (token) => set({ simTokenIn: token, quoteComparison: null }),
  setSimTokenOut: (token) => set({ simTokenOut: token, quoteComparison: null }),
  setSimAmount: (amount) => set({ simAmount: amount, quoteComparison: null }),
  setSimChainId: (chainId) => set({ simChainId: chainId }),
  setQuoteComparison: (comparison) => set({ quoteComparison: comparison }),
  setFetchingQuotes: (val) => set({ isFetchingQuotes: val }),
  setQuoteError: (err) => set({ quoteError: err }),
  swapTokens: () =>
    set((state) => ({
      simTokenIn: state.simTokenOut,
      simTokenOut: state.simTokenIn,
      quoteComparison: null,
    })),
}))
