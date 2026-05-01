import { createConfig, http } from 'wagmi'
import { base, mainnet, arbitrum, optimism, polygon } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? ''
const connectors = projectId ? [injected(), walletConnect({ projectId })] : [injected()]

export const wagmiConfig = createConfig({
  chains: [base, mainnet, arbitrum, optimism, polygon],
  connectors,
  transports: {
    [base.id]: http(import.meta.env.VITE_RPC_BASE ?? 'https://mainnet.base.org'),
    [mainnet.id]: http(import.meta.env.VITE_RPC_ETH ?? 'https://eth.llamarpc.com'),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
})
