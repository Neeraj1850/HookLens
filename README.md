# HookLens - Uniswap v4 Hook Inspector

> Paste any deployed Uniswap v4 hook address.
> Instantly understand what it does, how it affects swaps,
> whether it is safe, and which pools use it.

## Live Demo

[hooklens.xyz](https://hooklens.xyz)

## What It Does

### 1. Hook Flag Decoder

Decodes the 14 permission bits encoded in any v4 hook address.
No RPC call needed - pure address math.

### 2. Live Swap Impact (Uniswap Trading API)

Calls the Uniswap Trading API `hooksOptions` parameter:

- `V4_HOOKS_ONLY` - quote through hook pools only
- `V4_NO_HOOKS` - quote through standard pools only
- Shows the delta: exactly what the hook costs or saves

### 3. Safety Analysis (Sourcify)

Fetches verified source code from Sourcify v2 API.
Runs 12 deterministic checks:

- No selfdestruct or delegatecall
- Access control on admin functions
- No reentrancy paths
- Correct callback return types
- Flash loan safety
- And more...

### 4. Pool Discovery (Uniswap v4 Subgraph)

Finds all v4 pools using this hook via The Graph subgraph.
Falls back to onchain `eth_getLogs` if the subgraph is unavailable.

### 5. uniswap-ai Integration

Safety check explanations are powered by the
[uniswap-ai](https://github.com/Uniswap/uniswap-ai)
`uniswap-hooks` skill. Click any safety check to see why it matters,
a concrete attack example, and how to fix it.

## Setup

```bash
git clone https://github.com/your-username/hooklens
cd hooklens
npm install
cp .env.example .env
# Add your VITE_UNISWAP_API_KEY
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| VITE_UNISWAP_API_KEY | Yes | Uniswap Trading API key |
| VITE_THEGRAPH_API_KEY | No | Improves pool discovery |
| VITE_ALCHEMY_API_KEY | No | Improves onchain fallback |
| VITE_WALLETCONNECT_PROJECT_ID | No | Wallet connection |

## Prize Submission Notes

This project integrates the Uniswap Trading API at its core.
The `hooksOptions` field (`V4_HOOKS_ONLY` / `V4_NO_HOOKS`) is
the mechanism that makes HookLens unique: no other tool uses this
parameter to show hook economic impact in real time.

See [FEEDBACK.md](./FEEDBACK.md) for detailed builder experience
feedback on the Uniswap API and Developer Platform.

## Built With

- Uniswap Trading API (`hooksOptions` comparison)
- Sourcify v2 API (contract verification and source)
- Uniswap v4 Subgraph (pool discovery)
- uniswap-ai hooks skill (safety explanations)
- viem (address decoding and onchain reads)
- React + Vite + TypeScript + Tailwind CSS
