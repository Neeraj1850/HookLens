# FEEDBACK.md — HookLens Builder Experience

> Honest feedback on building with the Uniswap API, v4 SDK, and developer platform.
> Submitted as part of the Uniswap Hackathon prize track: **Best Uniswap API Integration**.

---

## 1. Overview

**What we built:** HookLens is a Uniswap v4 hook inspector and agentic swap simulator. It discovers live hooks across chains via The Graph subgraph, decodes their callback flags from address bit patterns, runs safety analysis via Sourcify, and powers a 6-step deterministic agent pipeline (**Swap Simulator**) that compares `V4_HOOKS_ONLY` vs `BEST_PRICE` routing decisions using the Uniswap Trading API.

**How we used the Uniswap API and v4 SDK:**
- `POST /v1/quote` with `hooksOptions: "V4_HOOKS_ONLY"` and `"BEST_PRICE"` for dual-route comparison
- `@uniswap/sdk-core`: `Token`, `Ether.onChain()`, `WETH9`, `ChainId` — canonical source for all token addresses and decimals
- `@uniswap/v4-sdk`: `toAddress()` to correctly resolve native ETH → `0x000...000` for the API
- `routingPreference: "BEST_PRICE"` with `autoSlippage: "DEFAULT"` for market route
- `protocols: ["V4"]` with `hooksOptions` to isolate hook pool routing
- `x-universal-router-version: "2.0"` header consistently across all quote calls

---

## 2. What Worked Well

- **`hooksOptions` field** is a genuinely powerful addition. Being able to request `V4_HOOKS_ONLY` routes is exactly what a hook analytics tool needs. This is the right API design.
- **`autoSlippage: "DEFAULT"`** worked reliably for v2/v3/v4 protocol routes — removes a significant source of user friction.
- **`@uniswap/sdk-core` constants** (`WETH9`, `ChainId`, `Ether`) are comprehensive and cover all supported chains correctly. Using these as the canonical source for addresses/decimals eliminated an entire class of hardcoding bugs.
- **`toAddress()` from `@uniswap/v4-sdk`** correctly handles `isNative` currencies and returns the zero address — this is the right abstraction and it worked exactly as documented.
- **`routing` field in the response** (e.g. `CLASSIC`, `DUTCH_V2`, `DUTCH_V3`) is useful for understanding which protocol layer is being used and factoring into route scoring.
- **The Graph subgraph** for Uniswap v4 is well-structured. `poolDayData` with date filters made 7-day and 30-day volume aggregation straightforward. The `hooks_not` filter for hook discovery is essential and works reliably.
- **Sourcify API** for contract verification is a good complementary tool — it worked for most mainnet and Base contracts.

---

## 3. Challenges & Issues Faced

- **No hook pool for most pairs.** `V4_HOOKS_ONLY` returns no route for the vast majority of token pairs because hook pool liquidity is still sparse. This means `noHookPool: true` is the most common result, which reduces the impact of the comparison feature. The API correctly signals this (via 404 or empty route), but the UX implication is that most simulations fall back immediately to market route only.

- **Rate limiting at 3 req/sec.** Running two sequential quote calls (hook + market) for the dual-quote pattern consumes 2 of 3 allowed requests in a single user interaction. We had to add a 350ms gap between the calls to avoid 429 errors. A batch quote endpoint (`/v1/quote/batch`) would eliminate this entirely.

- **CORS on the Trading API.** The API does not support direct browser requests — a server-side proxy is required. We built a Vite dev server plugin to proxy `/hooklens-uniswap → trade-api.gateway.uniswap.org` during development. In production, this requires a backend or edge function. There is no sandbox or client-side-safe mode for development.

- **`txFailureReason` is opaque.** When the simulation fails, `txFailureReason` returns a short string (e.g. `"SIMULATION_ERROR"`) with no further breakdown. It is impossible to distinguish between a hook reverting vs. insufficient liquidity vs. price impact too high without additional context.

- **`poolDayData` aliasing in GraphQL.** Subgraph queries using aliased `poolDayData` fields (`poolDayData7d`, `poolDayData30d`) with different `where` filters are not supported on all subgraph versions — some returned errors silently. We resolved this by testing each subgraph endpoint independently.

- **Hook address bit-pattern decoding is undocumented.** We reverse-engineered the callback flag encoding from v4-core source code (bits 0–15 of the last 2 bytes of the hook address). There is no official SDK helper or documentation for this — it is critical information for hook analytics tools.

---

## 4. Documentation Gaps

- **`hooksOptions` is only mentioned in the API reference, not in any guide.** There is no walkthrough showing how to use `V4_HOOKS_ONLY` in a real application context — how to interpret a missing route, how to fall back gracefully, or how to combine it with other routing parameters.

- **`routingPreference` deprecation is not clearly surfaced.** The docs say everything except `FASTEST` and `BEST_PRICE` is deprecated, but older examples in blog posts and tutorials still use deprecated values.

- **Permit2 flow is confusing for read-only use cases.** For a simulator that only calls `/quote` (not `/swap`), the `permitData` field in the response and when to use `x-permit2-disabled` is not clearly explained. We set `x-permit2-disabled: false` (the default) and ignore `permitData` — but it is unclear whether this is the correct approach for quote-only integrations.

- **`amount` must be in base units** — this is documented, but the error message when you pass a human-readable amount is generic (`"Bad request"`) with no indication that the unit is wrong. A more specific error like `"amount must be in token base units"` would save significant debugging time.

- **No documentation on which chains support `hooksOptions`.** We had to test each chain manually. Arbitrum and Base work; other chains silently return `V4_HOOKS_INCLUSIVE` behavior.

---

## 5. Developer Experience (DX) Friction

- **No client-side safe mode.** Every quote call requires a server proxy in a browser context. For hackathon prototyping and tool development, a CORS-permissive sandbox endpoint (even with stricter rate limits) would dramatically reduce setup friction.

- **Error messages from the API are inconsistent.** Some errors return `{ message: "..." }`, others return `{ error: "..." }`, and some return plain text. We wrote a multi-key error extractor to handle all cases.

- **The subgraph `hooks_not` filter returns results even for contracts that are not valid hook implementations.** Some addresses in the data do not conform to the hook address bit pattern. Filtering by `isAddress` and checking the lower-nibble bits is required client-side.

- **No introspection into why a route chose specific pools.** The `route` field in the response contains raw pool data but lacks hook address information. When a `V4_HOOKS_ONLY` quote succeeds, there is no way to confirm which specific hook was used in the route.

- **`gasFeeUSD` is sometimes null or `"0"` for valid routes.** We had to handle this as a non-fatal case in route scoring.

---

## 6. Missing Features / Wishlist

- **Hook discovery API.** There is no endpoint to list hooks, get hook metadata, or query pools by hook address via the Trading API. Everything requires a direct subgraph query. A `/v1/hooks` endpoint with metadata (deployment date, callback flags, pool count, volume) would be transformative for tooling.

- **Batch quote endpoint.** `/v1/quote/batch` accepting multiple `[tokenIn, tokenOut, amount, hooksOptions]` tuples in a single request would eliminate the rate limit issue for comparison use cases.

- **Route introspection.** The quote response should include the hook address(es) used when routing through `V4_HOOKS_ONLY`. Currently there is no way to confirm which hook was actually selected.

- **Hook risk metadata.** The SDK does not provide any hook risk classification utilities. We implemented our own bit-pattern decoder based on v4-core source. An official `classifyHookFlags(address)` helper in `@uniswap/v4-sdk` would be valuable.

- **Simulation dry-run mode.** A `/v1/simulate` endpoint that runs the swap simulation without requiring a permit signature or wallet address would be useful for analytics tools that want to evaluate routes without a connected wallet.

- **`poolDayData` in the Trading API response.** Including recent volume and activity stats for the recommended pool in the quote response would eliminate the need for a separate subgraph query to contextualize the result.

---

## 7. Suggestions for Improvement

**API:**
- Add `hookAddress` to the quote response route data when `hooksOptions: "V4_HOOKS_ONLY"` is used.
- Return a machine-readable `errorCode` alongside `txFailureReason` (e.g. `HOOK_REVERT`, `INSUFFICIENT_LIQUIDITY`, `PRICE_IMPACT_TOO_HIGH`).
- Provide a CORS-permissive development sandbox endpoint for browser-based tooling.
- Add a `/v1/quote/batch` endpoint for multi-route comparison workflows.

**SDK:**
- Add `classifyHookFlags(address: string): HookFlags` to `@uniswap/v4-sdk` — decoding callback bits from the address is a common pattern for v4 tooling.
- Export a `getQuoterAddress(chainId: number): string` helper from `@uniswap/v4-sdk` so developers don't need to maintain their own deployment address maps.
- Add `USDC_BY_CHAIN` and `USDT_BY_CHAIN` constants to `@uniswap/sdk-core` alongside `WETH9` — these are the most commonly used stablecoin pairs.

**Documentation:**
- Add a `hooksOptions` guide with a real end-to-end example showing hook route discovery, fallback logic, and result interpretation.
- Clarify the quote-only (no swap) use case for Permit2 — when `permitData` can be safely ignored.
- Document the hook address bit-pattern encoding formally in the v4 periphery docs.
- Add chain support matrix for `hooksOptions` and v4 pool availability.

**Dev Tooling:**
- A Uniswap API response inspector (like Etherscan's "Read Contract" but for quote responses) would dramatically improve debugging.
- A hook registry browser in the official app (similar to ENS registry) would reduce the need for third-party tools to re-implement hook discovery.

---

## 8. Conclusion

The Uniswap v4 developer platform is genuinely exciting — `hooksOptions` is a well-designed API primitive, the SDK constants are reliable, and the subgraph data is comprehensive. For a hackathon prototype, the platform delivered everything we needed to build a compelling demo.

However, for production deployment, three issues stand out:

1. **CORS** — requiring a server-side proxy for every API call is a significant operational burden for client-side tools.
2. **Hook pool liquidity** — `V4_HOOKS_ONLY` routes are unavailable for the vast majority of pairs in production, which limits the practical impact of hook-specific tooling today.
3. **Rate limits** — 3 req/sec makes dual-quote workflows require artificial delays, degrading user experience.

With a batch quote endpoint, CORS support for development, and better route introspection, this platform would be significantly more production-ready for analytics and tooling use cases. The foundations are strong — the gaps are specific and addressable.

---

_Submitted by HookLens — Uniswap Hackathon 2025_
