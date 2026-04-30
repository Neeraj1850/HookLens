import { create } from 'zustand'
import type { FullHookInspection } from '../types/hook'

interface HookStore {
  currentAddress: string
  currentChainId: number
  currentInspection: FullHookInspection | null
  isDecoding: boolean
  decodeError: string | null
  history: { address: string; chainId: number; label?: string }[]
  setAddress(address: string): void
  setChainId(chainId: number): void
  setDecoding(val: boolean): void
  setDecodeError(err: string | null): void
  setInspection(inspection: FullHookInspection): void
  clearInspection(): void
  addToHistory(address: string, chainId: number): void
  clearHistory(): void
}

export const useHookStore = create<HookStore>((set, get) => ({
  currentAddress: '',
  currentChainId: 8453,
  currentInspection: null,
  isDecoding: false,
  decodeError: null,
  history: [],

  setAddress: (address) => set({ currentAddress: address }),
  setChainId: (chainId) => set({ currentChainId: chainId }),
  setDecoding: (val) => set({ isDecoding: val }),
  setDecodeError: (err) => set({ decodeError: err }),

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
    }),

  addToHistory: (address, chainId) => {
    const existing = get().history
    const filtered = existing.filter((h) => h.address !== address)
    set({ history: [{ address, chainId }, ...filtered].slice(0, 5) })
  },

  clearHistory: () => set({ history: [] }),
}))
