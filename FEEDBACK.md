# FEEDBACK.md - Uniswap API Builder Experience

## Project: HookLens - v4 Hook Inspector

## What We Integrated
- POST /quote with hooksOptions: V4_HOOKS_ONLY
- POST /quote with hooksOptions: V4_NO_HOOKS
- POST /quote with hooksOptions: V4_HOOKS_INCLUSIVE
- protocols: ['V4'] (required when using hooksOptions)

## What Worked Well
- hooksOptions parameter is powerful and exactly what we needed.
- autoSlippage: 'DEFAULT' keeps the quote request compact.
- The documented response fields map cleanly into a UI comparison model.
- Rate limiting is predictable at 3 req/sec, so a dual quote can be guarded with a simple 400ms delay.
- API key authentication is simple enough to support both localStorage and Vite env configuration.

## Bugs and Friction Encountered
- The app needed its own dual-quote result type because the API returns two independent failure modes: the hook route can fail while the no-hook route still succeeds.
- "No quotes available" needs product-specific interpretation for V4_HOOKS_ONLY. In HookLens it often means no hook pool exists for the selected pair, not that the whole simulator failed.
- BigInt conversion needs careful string handling. Human inputs like "1.0" must be converted to base units without floating point math.
- Quote output token decimals must be treated defensively in the UI because malformed or partial quote payloads should not crash rendering.

## Docs Gaps
- hooksOptions is mentioned in the /quote reference but not in the integration guide narrative, making it easy to miss.
- No examples show hooksOptions in the swapping-code-examples flow.
- It is unclear in narrative docs that protocols: ['V4'] is required with hooksOptions.
- No documentation explains what "No quotes available" means specifically for V4_HOOKS_ONLY versus general no-liquidity errors.

## DX Friction
- The 3 req/sec limit is documented, but dual-quote comparison tools need explicit guidance on serializing quote calls.
- There is no hook-first quickstart showing the exact V4_HOOKS_ONLY versus V4_NO_HOOKS comparison pattern.
- Error messages are usable, but a machine-readable no-route/no-hook-pool code would make UI handling more robust than substring matching.
- The response type is broad enough that frontend apps still need defensive optional fields for gas and routing details.

## Missing Endpoints / Features Wished For
- An endpoint to list all pools using a specific hook address (currently requires subgraph query).
- hooksOptions on the /check_approval endpoint would be helpful.
- A /hook-info endpoint that returns hook metadata given an address.
- A pool discovery endpoint filtered by chain, token pair, and hook address would make hook simulators much easier to build.

## Rate Limiting Notes
- 3 req/sec limit means our dual-quote (2 calls) must be spaced 400ms apart to stay safe under any concurrent usage.
- Wish for a higher free tier limit or a burst allowance for developer tools that need multiple quotes simultaneously.

## Sourcify Integration Notes (Phase 3)

### What We Used
- GET /v2/contract/{chainId}/{address}?fields=all
- Legacy fallback: GET /files/any/{chainId}/{address}

### Sourcify API Experience
- The v2 `fields=all` shape is convenient because ABI, sources, bytecode, and compiler settings can be pulled in one browser request.
- 404 is cleanly usable as "not verified" and can be shown as an analysis result rather than treated as an app failure.
- The legacy files endpoint needs a different parser because it can return either an array of files or an object with a `files` array.
- Response fields are broad enough that HookLens treats ABI, sources, and bytecode as optional and falls back gracefully.

### Chains Where Source Was Available vs Not
- Mainnet, Base, Arbitrum, Optimism, and Polygon use standard chain IDs and can be queried directly.
- Unichain is included in the app UI, but Sourcify coverage may vary by deployment age and repo support.
- For unverified contracts, HookLens still returns a deterministic report with verification failure and bytecode-only checks when bytecode is available.

### Static Analysis Notes
- Source-level checks work well for explicit patterns like `selfdestruct`, `delegatecall`, `tx.origin`, callback return types, and visible admin setters.
- Access control detection is inherently conservative because modifiers and inherited auth helpers vary across projects.
- Reentrancy and arbitrary external call checks are pattern-based and should be treated as triage signals, not formal verification.
- Bytecode-only analysis is intentionally minimal; detecting `0xff` can produce false positives because bytecode may contain the byte for reasons other than SELFDESTRUCT.
