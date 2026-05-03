# HookLens Feedback

HookLens uses the Uniswap Trading API, Uniswap SDKs, v4 subgraph data, and Sourcify to inspect hook contracts and compare hook-only swap routes against normal market routing.

## Integration Summary

The main quote workflow lives in `src/api/uniswap.ts`. It builds SDK-native `Currency` inputs, converts human amounts to base units with the currency decimals, and requests two quotes:

- `protocols: ["V4"]` with `hooksOptions: "V4_HOOKS_ONLY"`
- `routingPreference: "BEST_PRICE"` for the market route

The app then scores each route in `src/api/agentEngine.ts` using output amount, gas fee, slippage, and routing type. The UI presents the result as a deterministic recommendation rather than a free-form AI decision.

## What Worked Well

- `hooksOptions: "V4_HOOKS_ONLY"` is the key primitive for this product. It makes hook-specific route comparison possible.
- `@uniswap/sdk-core` gave reliable `Currency`, `Token`, `Ether`, and `WETH9` primitives, which kept token addresses and decimals centralized.
- `toAddress()` from `@uniswap/v4-sdk` handled native ETH cleanly for Trading API requests.
- The Trading API response includes enough output, gas, slippage, and routing metadata to produce a useful route score.
- The Uniswap v4 subgraph is useful for hook discovery, pool discovery, and recent activity windows.

## Friction Found

- Browser CORS requires a proxy. HookLens now uses a local Vite proxy and a Vercel serverless proxy so the Uniswap API key can live server-side.
- Dual-quote comparison costs two quote calls, which makes the 3 req/sec rate limit easy to hit. HookLens still spaces the hook quote and market quote to reduce 429s.
- `V4_HOOKS_ONLY` often has no route because hook liquidity is still sparse. The product needs to treat this as a normal state, not a failure.
- Trading API error shapes vary. The app has to extract messages from several possible keys.
- `txFailureReason` is too broad for audit UX. It does not clearly distinguish hook revert, insufficient liquidity, quote simulation failure, or price-impact constraints.
- The quote route payload does not expose the hook address used in a successful hook-only route, so the app cannot cryptographically link a route back to the inspected hook from quote data alone.

## Documentation Gaps

- A dedicated `hooksOptions` guide would help teams understand when to use `V4_HOOKS_ONLY`, `V4_HOOKS_INCLUSIVE`, and `V4_NO_HOOKS`.
- A chain support matrix for v4 hook routing and subgraph availability would reduce trial-and-error.
- Quote-only Permit2 behavior could be clearer. HookLens receives `permitData` but does not execute swaps.
- The v4 hook address bit layout should be documented prominently or exposed through an SDK helper.

## Requests

- Add a batch quote endpoint for comparison workflows.
- Include selected hook address data in quote route metadata.
- Return machine-readable simulation failure codes.
- Add an SDK helper for decoding hook permission flags.
- Provide a development-friendly proxy or sandbox mode for browser tools.

## Current Repo Notes

- The active simulator is `/ai-studio`; older unused swap-impact components were removed.
- The Ollama assistant uses the local REST API directly and no npm Ollama dependency.
- Quote and subgraph debug logging is opt-in through `VITE_HOOKLENS_DEBUG_QUOTES` and `VITE_HOOKLENS_DEBUG_SUBGRAPH`.
- `UNISWAP_API_KEY` is the preferred server-side environment variable for quote proxying.
