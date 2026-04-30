# HookLens

HookLens is a browser-based developer tool for inspecting Uniswap v4 hooks.

Phase 1 includes the React, TypeScript, Tailwind, routing, wallet, state, and hook flag decoding foundation. Paste a hook address to decode its 14 Uniswap v4 callback permission bits directly from the address.

## Run

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Phases

- Phase 1: hook address input, flag decoder, inspection UI
- Phase 2: Uniswap Trading API quote comparison with `hooksOptions`
- Phase 3: static safety analysis via bytecode and Sourcify
- Phase 4: pool discovery and Uniswap AI integration notes
