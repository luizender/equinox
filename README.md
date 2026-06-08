# ◈ Equinox

**Cross-chain DeFi portfolio analyzer & interactive liquidation simulator.**

Paste any public wallet address — no keys, no connections — and instantly visualize your lending positions across **Kamino Lend** (Solana) and **Aave V3** (14 EVM chains). Drag sliders to simulate price crashes, rebalance collateral, and see exactly when you get liquidated.

---

## Why Equinox?

Most DeFi dashboards show you numbers. Equinox lets you **play with them**.

- 🔑 **Keyless** — read-only, no wallet connection required
- 🔗 **Cross-chain** — Solana + 14 EVM networks from a single address
- 🎯 **Focused** — analyze one market/network at a time; every metric scopes to your selection
- 🧮 **Exact math** — mirrors the on-chain liquidation formulas
- 🎛️ **Interactive** — combined slider + numeric inputs with instant feedback
- 📡 **Live** — 15-second auto-refresh with visual countdown

---

## Features

### Portfolio Dashboard

| Component | What it does |
|---|---|
| **Market Selector** | Pick one market/network from a pill bar — protocol badge, network, collateral, and health factor per chip. The whole dashboard scopes to your choice |
| **KPI Cards** | Net value, collateral, debt, and weighted net APY for the selected market — with before/after deltas during simulation |
| **Allocation Chart** | Interactive doughnut chart of the selected market's collateral distribution by token |
| **Protocol Auto-detect** | Paste an address and Equinox figures out if it's Solana or EVM |

### Liquidation Analysis

| Scenario | Description |
|---|---|
| **Single Asset Drop** | For each collateral asset: the exact price that triggers liquidation, the buffer percentage remaining, and a "Safe at $0" badge when applicable |
| **Global Market Crash** | The uniform percentage drop across all volatile assets that triggers liquidation, with per-asset crash prices |
| **Edge Cases** | Volatile debt warnings, insolvency detection, at-risk alerts with animated indicators |

### What-If Simulator

- **Dual-input controls** — range slider for quick experiments + numeric field for precision
- **Absolute / Delta toggle** — set a target (`1000 USDC`) or apply an offset (`+10 ETH`)
- **Add new assets** — resolve reserves live from the protocol's catalog and inject them into the simulation
- **Comparison engine** — real-time Health Factor, LTV, and Net Value displayed as `Before → After` with color-coded risk levels
- **One-click reset** — clear all overrides and return to live values

### Live Watch Mode

- Circular countdown timer with 15-second polling interval
- Green border flash when fresh data arrives
- Server-side caching prevents rate-limiting under continuous polling

---

## Quick Start

```bash
# Prerequisites: Node.js ≥ 20, Yarn

# Install
git clone https://github.com/luiz/equinox.git && cd equinox
yarn install

# Develop
yarn dev              # → http://localhost:3000

# Test (100% coverage enforced)
yarn coverage

# Build
yarn build && yarn start
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React 19)                                         │
│                                                             │
│  /                    Landing page — address search          │
│  /dashboard           Portfolio dashboard (client components)│
└────────────┬───────────────────────────┬────────────────────┘
             │                           │
    GET /api/portfolio/[address]   GET /api/reserve
             │                           │
   ┌─────────┴─────────┐       ┌─────────┴─────────┐
   │  Protocol Router   │       │  Reserve Resolver  │
   │                    │       │                    │
   │  ┌──────────────┐ │       │  Fetches LTV,      │
   │  │ Kamino REST   │ │       │  borrow factor,    │
   │  │ 15s revalidate│ │       │  price from the    │
   │  └──────────────┘ │       │  protocol's reserve │
   │  ┌──────────────┐ │       │  catalog            │
   │  │ Aave GraphQL  │ │       └────────────────────┘
   │  │ memory cache  │ │
   │  └──────────────┘ │
   └────────────────────┘
```

All external calls go through **Next.js Route Handlers** — no CORS issues, no API keys in the browser. Responses are cached server-side for 15 seconds.

---

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 16 · App Router · React 19 |
| **Language** | TypeScript · strict mode |
| **Styling** | Tailwind CSS 4 · tw-animate-css · custom glassmorphism utilities |
| **Components** | shadcn/ui (base-ui primitives) |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Testing** | Vitest · v8 coverage · 100% threshold enforcement |
| **Package Manager** | Yarn |

---

## DeFi Math

The engine in [`src/lib/math-engine.ts`](src/lib/math-engine.ts) implements the exact formulas from the original [lend-liq](https://github.com/luiz/lend-liq) Python tool.

### Health Factor

```
Health Factor = Liquidation Limit / Debt Value

where:
  Liquidation Limit = Σ (amount × price × liquidationThreshold)
  Debt Value        = Σ (tokenValue × borrowFactor)          # Kamino
                    = Σ (borrow USD value)                    # Aave
```

Position is liquidated when Health Factor drops below **1.0**.

### Single Asset Liquidation Price

The price at which a position is liquidated if **only one asset** drops:

```
Held Capacity     = Liquidation Limit − (c.amount × c.price × c.LT)
Liquidation Price = (Debt Value − Held Capacity) / (c.amount × c.LT)
```

If the result is ≤ 0 → the asset is **"Safe at $0"** (other collateral covers the debt alone).

### Global Crash Threshold

When all borrows are stablecoins, the uniform volatile drop that triggers liquidation:

```
Stable Capacity   = Σ stable collateral weighted values
Volatile Capacity = Σ volatile collateral weighted values
Remaining Ratio   = (Debt − Stable Capacity) / Volatile Capacity
Crash Drop        = 1 − Remaining Ratio
```

### Simulation Debt Scaling

Kamino applies per-asset borrow factors. When simulating amount changes, the engine preserves the aggregate factor:

```
Scale Factor    = Original Debt Value / Σ(orig amount × orig price)
Simulated Debt  = Scale Factor × Σ(sim amount × sim price)
                + Σ(added amount × added price × borrowFactor)
```

---

## Test Coverage

```
 58 tests | 3 test files | 100% coverage

 ──────────────────┬─────────┬──────────┬─────────┬─────────
 File              │ % Stmts │ % Branch │ % Funcs │ % Lines
 ──────────────────┼─────────┼──────────┼─────────┼─────────
 All files         │     100 │      100 │     100 │     100
  aave-client.ts   │     100 │      100 │     100 │     100
  kamino-client.ts │     100 │      100 │     100 │     100
  math-engine.ts   │     100 │      100 │     100 │     100
  validation.ts    │     100 │      100 │     100 │     100
 ──────────────────┴─────────┴──────────┴─────────┴─────────
```

**Covered edge cases:** Safe-at-\$0 thresholds · volatile debt crash suppression · insolvency detection · zero/negative amounts · empty reserves · Aave eMode overrides · GraphQL error propagation · cache hit/miss/expiry cycles.

---

## Project Structure

```
equinox/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing — address search
│   │   ├── dashboard/page.tsx          # Dashboard — data fetching, watch mode
│   │   └── api/
│   │       ├── portfolio/[address]/route.ts  # Portfolio endpoint
│   │       └── reserve/route.ts              # Reserve resolver endpoint
│   ├── components/
│   │   ├── dashboard-header.tsx        # Search, chain selector, watch toggle
│   │   ├── market-selector.tsx         # Pill bar — pick one market to analyze
│   │   ├── kpi-cards.tsx              # Net value / collateral / debt / APY
│   │   ├── allocation-chart.tsx       # Doughnut chart (Recharts)
│   │   ├── liquidation-views.tsx      # Single drop & crash tabs
│   │   ├── simulation-panel.tsx       # Sliders, numeric inputs, comparison
│   │   └── ui/                        # shadcn primitives
│   ├── lib/
│   │   ├── math-engine.ts            # Health factor, drops, simulation
│   │   ├── validation.ts             # Address format detection
│   │   ├── kamino-client.ts           # Kamino REST with revalidation
│   │   ├── aave-client.ts            # Aave GraphQL with memory cache
│   │   ├── markets.ts                # Protocol + network labels per market
│   │   └── config.ts                 # Endpoints, stablecoins, chains
│   └── types/index.ts                 # Shared TypeScript interfaces
├── tests/
│   ├── math-engine.test.ts            # 20 tests
│   ├── api-parsers.test.ts            # 26 tests
│   └── validation.test.ts            # 12 tests
└── docs/
    ├── plan.md                        # Full implementation plan
    └── dashboard.png                  # Design reference
```

---

## Supported Networks

| Protocol | Networks |
|---|---|
| **Kamino Lend** | Solana |
| **Aave V3** | Ethereum · Arbitrum · Base · Optimism · Polygon · Avalanche · BSC · Gnosis · Sonic · zkSync · Metis · Celo · Linea · Scroll |

---

## License

MIT
