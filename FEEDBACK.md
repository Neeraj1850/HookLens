# FEEDBACK.md - Uniswap API Builder Experience

## Project: HookLens - Uniswap v4 Hook Inspector
## Hackathon: Uniswap Hook Incubator
## Builder: HookLens Team

---

## What We Built

HookLens uses the Uniswap Trading API `hooksOptions` parameter to show developers the exact economic impact of any v4 hook on a real swap. We call `POST /quote` twice, once with `V4_HOOKS_ONLY` and once with `V4_NO_HOOKS`, then show the delta. This is powered directly by the Uniswap API.

## API Surfaces Integrated

### 1. POST /quote - hooksOptions parameter (CORE INTEGRATION)

This is the heart of HookLens. We use three values:

- `V4_HOOKS_ONLY` - routes only through v4 hook pools
- `V4_NO_HOOKS` - routes only through v4 non-hook pools
- `V4_HOOKS_INCLUSIVE` - all v4 pools, useful as a reference path

**Critical finding:** `hooksOptions` requires `protocols: ['V4']` to be set at the same time. Without this, the parameter is effectively ignored and the API can route across v2/v3/v4 freely. This was not obvious from the integration guide and took real debugging time.

**Rate limiting:** The 3 req/sec limit means our dual quote flow needs a delay between calls. A batch quote endpoint that accepts multiple `hooksOptions` values would make this use case cleaner and faster.

### 2. Uniswap AI - uniswap-hooks plugin

We used the `uniswap-ai` repo's hooks skill:

```bash
npx skills add Uniswap/uniswap-ai
```

The skill was useful for generating v4-specific safety explanations for callback return types, owner trust assumptions, reentrancy, arbitrary external calls, and flash-loan-sensitive pricing logic. HookLens embeds those explanations statically so the app can show them at runtime without needing an agent session.

**Gap:** There is no programmatic API for the skill. An HTTP endpoint for querying the knowledge base at runtime would let apps provide live contextual explanations.

### 3. Uniswap v4 Subgraph (The Graph)

HookLens uses the v4 subgraph to discover pools using a given hook address.

**Finding:** The subgraph is the right surface for pool discovery, but USD liquidity is not consistently available for v4 pools yet. Raw liquidity is useful for ordering but not very human-readable.

**Finding:** Public Graph gateway access can be inconsistent without a key. We added a The Graph key setting and an onchain `eth_getLogs` fallback over recent `Initialize` events.

## What Worked Well

- `hooksOptions` is powerful and exactly what HookLens needed.
- `autoSlippage: 'DEFAULT'` kept the quote request simple.
- Error responses are structured enough to show actionable messages.
- The v4 quote response maps cleanly into a hook-vs-no-hook comparison UI.
- Sourcify v2 `?fields=all` is a strong companion API for hook safety analysis.
- The v4 subgraph makes hook pool discovery possible without maintaining an indexer.

## What Did Not Work / Bugs Hit

- `hooksOptions` is easy to misuse unless `protocols: ['V4']` is included.
- `V4_HOOKS_ONLY` often returns no quote because v4 hook liquidity is sparse. That is expected, but the error looks similar to a true API failure.
- Substring matching was needed to distinguish no-route cases from other quote errors. A machine-readable no-route reason would be better.
- The Graph gateway sometimes needs an API key even for low-volume development.
- Sourcify can return partial metadata, so ABI, source, and bytecode all need defensive optional handling.

## DX Friction Points

- The integration guide does not put `hooksOptions` in the main happy path.
- No single docs page explains the full developer-tool flow: quote, compare routing modes, inspect source, then discover pools.
- No official typed TypeScript client for the Trading API meant hand-rolling request and response types.
- There is no Trading API endpoint for "which pools use hook X", so HookLens needs the subgraph and an RPC fallback.

## Missing Endpoints / Features We Wished For

1. **Batch quote endpoint**
   Accept several `hooksOptions` values in one request and return all quote outcomes together.

2. **Hook pool endpoint**
   `GET /v1/hook/{address}/pools` returning pools that use a hook, with chain and token filters.

3. **Hook metadata endpoint**
   `GET /v1/hook/{address}/info` returning decoded flags, basic verification status, and pool count.

4. **Better no-route codes**
   Distinguish "no hook pool exists" from "API failed" and "insufficient liquidity".

5. **Typed TypeScript client**
   An official `@uniswap/trading-api` package with request/response types and documented error codes.

## Recommendations for Documentation

- Add `hooksOptions` to the integration guide narrative, not only the API reference.
- Document that `protocols: ['V4']` is required with `hooksOptions`.
- Add a code example comparing `V4_HOOKS_ONLY` against `V4_NO_HOOKS`.
- Clarify no-route behavior for sparse hook liquidity.
- Add a "Building v4 hook developer tools" guide covering the Trading API, v4 subgraph, Sourcify, and onchain PoolManager events.

---

This feedback was written from the actual HookLens build across all four phases. Every point reflects friction or design choices encountered while integrating the Uniswap API and v4 hook data surfaces.
