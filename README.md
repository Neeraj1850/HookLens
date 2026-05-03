# HookLens

HookLens is a Uniswap v4 hook inspector and swap simulation workspace for developers, auditors, and DeFi researchers. It discovers live hook pools, decodes hook permission bits, checks verified source through Sourcify, compares same-pair pool markets, and runs a deterministic swap-routing pipeline against the Uniswap Trading API.

## What It Does

- Decode all 14 Uniswap v4 hook callback flags from a hook address.
- Discover hook addresses and pool activity from the Uniswap v4 subgraph on configured chains.
- Inspect pools using a hook, including 7-day and 30-day volume and transaction windows.
- Compare pools using the selected hook against same-pair no-hook pools.
- Run a six-step swap simulation pipeline: plan, quote, score, classify risk, decide, report.
- Compare `V4_HOOKS_ONLY` routes against `BEST_PRICE` market routes.
- Run Sourcify-backed source checks for common hook risks.
- Chat locally with Ollama about a generated swap report.

## Current Architecture

| Area | Implementation |
| --- | --- |
| App | React 18, Vite, TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router |
| State | Zustand |
| Uniswap quoting | Trading API through `/hooklens-uniswap/v1/*` |
| Local quote proxy | Vite middleware in `vite.config.ts` |
| Vercel quote proxy | `api/uniswap/[...path].js` |
| Hook data | The Graph gateway subgraphs |
| Source verification | Sourcify |
| Local AI | Ollama REST API at `localhost:11434` |

## Environment

Create a `.env` file in the repo root:

```env
UNISWAP_API_KEY=your_uniswap_trading_api_key
VITE_THEGRAPH_API_KEY=your_thegraph_api_key
```

`UNISWAP_API_KEY` is read by the local Vite proxy and the Vercel serverless proxy, so it does not need to be exposed in the browser bundle. `VITE_UNISWAP_API_KEY` is still accepted as a legacy fallback, but `UNISWAP_API_KEY` is preferred.

Optional debug flags:

```env
VITE_HOOKLENS_DEBUG_QUOTES=true
VITE_HOOKLENS_DEBUG_SUBGRAPH=true
```

## Setup

```bash
npm install
npm run dev
```

The app starts with Vite. Quote requests go to `/hooklens-uniswap/v1/quote`, then the local proxy forwards them to `https://trade-api.gateway.uniswap.org`.

## Local Ollama Assistant

The assistant is optional. Start Ollama and pull at least one supported model:

```bash
ollama serve
ollama pull llama3.2
```

The app talks to Ollama with `fetch`; no npm Ollama package is required.

## Scripts

```bash
npm run lint
npm run build
npm run preview
```

## Main Paths

- `/` - hook address entry and recent inspections
- `/dashboard` - indexed hook discovery
- `/inspect/:chainId/:address` - callback, pool, and safety inspection
- `/ai-studio` - swap simulation pipeline and local auditor chat

## Future Roadmap

- Batch quote mode for comparing multiple token amounts and route settings in one run.
- Quote result caching with stale-time controls to reduce repeated Trading API calls.
- Hook watchlists with saved addresses, notes, and quick re-simulation.
- CSV and JSON exports for dashboard hook discovery and simulator reports.
- Pool liquidity health scoring using volume, transaction count, and recent activity windows.
- Source-aware analysis that maps findings to exact Solidity file names and function names.
- Route explanation panels that separate liquidity shortage, hook-only routing, gas, slippage, and price impact.
- Optional wallet connection only if transaction simulation or execution becomes part of the product.
- Server-side subgraph proxy support so The Graph keys can also stay out of the browser.
- Regression fixtures for quote parsing, hook flag decoding, and safety checks.

## Notes

- Only Base and Ethereum have configured Uniswap v4 subgraph IDs in `src/config/constants.ts`.
- Arbitrum is available in the simulator token list, but dashboard discovery depends on adding a verified v4 subgraph ID.
- Safety analysis is deterministic static analysis. It is not a replacement for a manual audit.
- The swap simulator uses quote data only; it does not submit transactions.
