# HookLens

> A professional-grade Uniswap v4 hook inspector and agentic swap simulation platform.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Uniswap v4](https://img.shields.io/badge/Uniswap-v4-ff007a.svg)

---

## 📋 Table of Contents

- [About the Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 About the Project

HookLens is a developer-focused analytics platform for Uniswap v4. It enables developers, auditors, and DeFi researchers to discover hooks deployed across chains, inspect their callback flags and security posture, analyze live pool markets, and run AI-powered swap simulations that compare hook-gated routes against the best available market route — all in a single interface.

**Problem:** Uniswap v4 introduces hooks as programmable middleware for pool logic, but there is no native tooling to discover hooks, understand their callbacks, assess their risk, or compare their routing performance against standard pools.

**Solution:** HookLens provides a full inspection and simulation pipeline — from subgraph-powered hook discovery to on-chain safety analysis to live Trading API quote comparisons.

### Screenshots

> _Live at your local dev server — run `npm run dev` to see the full UI._

---

## ✨ Features

- **Hook Discovery** — Browse live Uniswap v4 hooks from The Graph subgraph across Ethereum, Base, Arbitrum, Optimism, and more. Each hook shows 7-day and 30-day volume, transaction counts, and an "Active 7d" indicator.

- **Hook Inspection** — Decode hook callback flags (beforeSwap, afterSwap, beforeAddLiquidity, etc.) directly from the address bit pattern. View associated pools, run Sourcify contract analysis, and get a safety score.

- **Pool Market Comparison** — For any pool using a hook, see a side-by-side comparison of hook pools vs. standard pools for the same token pair.

- **AI Studio — Agentic Swap Simulator** — A 6-step deterministic agent pipeline (Plan → Quote → Score → Risk → Decide → Report) powered by the Uniswap Trading API. Compares `V4_HOOKS_ONLY` against `BEST_PRICE` routing using `@uniswap/sdk-core` Currency types — no hardcoded token addresses or decimals.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| State | Zustand |
| Data Fetching | TanStack Query v5 |
| Wallet | wagmi v2 + RainbowKit |
| On-chain | viem v2 |
| Uniswap SDK | `@uniswap/sdk-core`, `@uniswap/v4-sdk` |
| Uniswap API | Trading API (`trade-api.gateway.uniswap.org/v1`) |
| Pool Data | The Graph (Uniswap v4 subgraph) |
| Safety | Sourcify contract verification API |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A Uniswap Trading API key — [get one here](https://developers.uniswap.org/dashboard)
- A The Graph API key — [get one here](https://thegraph.com/studio/)

### Installation

```bash
# Clone the repo
git clone https://github.com/Neeraj1850/HookLens.git
cd HookLens/hooklens

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env`:

```env
VITE_UNISWAP_API_KEY=your_uniswap_trading_api_key
VITE_THEGRAPH_API_KEY=your_thegraph_api_key
```

### Run locally

```bash
npm run dev
```

The Vite dev server includes a built-in CORS proxy for the Uniswap Trading API — no separate backend required.

---

## 📖 Usage

### 1. Discover Hooks

Navigate to **Dashboard** — HookLens queries The Graph for all v4 pools with non-zero hook addresses across supported chains. Each hook row shows:
- 30-day and all-time volume
- Transaction count (7d / 30d / all-time)
- "Active 7d" badge for hooks that processed swaps in the last 7 days
- Category badge decoded from the address bit pattern

### 2. Inspect a Hook

Click **Inspect →** on any hook row (or navigate to `/inspect/:chainId/:address`). The inspector shows:
- Decoded callback flags with explanations
- Safety analysis via Sourcify
- All pools using this hook with 7d/30d metrics
- Same-pair pool comparison (hook vs. no-hook)

### 3. Simulate with AI Studio

Click **✦ Simulate in AI Studio →** from any pool card, or navigate to **/ai-studio**. Select a token pair and amount, then click **Run Agent**. The pipeline:

1. **Plan** — builds a typed swap intent using `@uniswap/sdk-core` Currency objects
2. **Quote** — fetches `V4_HOOKS_ONLY` and `BEST_PRICE` routes from the Trading API
3. **Score** — computes composite route scores (output 50pts + gas 25pts + slippage 15pts + routing type 10pts)
4. **Risk** — classifies hook risk from address bit pattern (LOW / MEDIUM / HIGH)
5. **Decide** — deterministic rule-based routing recommendation with confidence score
6. **Report** — structured findings with rationale and warnings

---

## 🗺 Roadmap

- [ ] Wallet-connected swap execution via Universal Router
- [ ] Hook metadata registry (name, description, audit links)
- [ ] Multi-chain batch hook discovery (parallel subgraph queries)
- [ ] Hook changelog — detect contract upgrades via Sourcify version history
- [ ] Webhook alerts for "Active 7d" status changes on tracked hooks
- [ ] Public hook leaderboard by volume and activity

---

## 🤝 Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

```bash
# Fork the repo, create a feature branch
git checkout -b feature/your-feature

# Make your changes, then submit a PR
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

Please follow the existing code style (TypeScript strict, no `any`, no raw console logging).

---

## 📄 License

Distributed under the MIT License.

---

Built for the Uniswap Hackathon · [Uniswap Developer Docs](https://developers.uniswap.org)
