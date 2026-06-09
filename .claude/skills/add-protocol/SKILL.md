---
name: add-protocol
description: Scaffold a new read-only lending-protocol client for Equinox, mirroring the existing Aave and Kamino integrations end-to-end (config, types, client, validation, route wiring, and 100%-coverage tests). Use when adding support for a new lending protocol.
disable-model-invocation: true
---

# Add a lending protocol to Equinox

Equinox reads positions from external lending protocols and normalizes them into one domain model. Two protocols exist today and define the pattern to copy:

- **Kamino** (Solana, REST) — `src/lib/kamino-client.ts`, the simpler template.
- **Aave** (EVM, GraphQL) — `src/lib/aave-client.ts`, multi-chain.

The goal of a new protocol is a `load<Protocol>Positions(address, …)` function that returns `PortfolioPosition[]`, parsed from the upstream payload. Follow these steps and **read the closest existing client first** as your template.

## Ask before scaffolding

1. **Protocol name** and **chain family** (EVM `0x…` address, Solana base58, or other)?
2. **Transport** — REST or GraphQL? Base URL? Auth/headers (today both clients send only `User-Agent: 'equinox/0.1'`)?
3. Which upstream endpoints give **positions** (collateral + debt) and **reserve** info (price, liquidation threshold, borrow factor)?

## Steps

1. **Config** — add the API base URL (and any chain map) to `src/lib/config.ts`, alongside `API_BASE` / `AAVE_API` / `AAVE_CHAINS`. Add any new stablecoin symbols to `STABLE_SYMBOLS` if the protocol lists assets not already covered.

2. **Types** — add the upstream response interfaces to `src/types/index.ts` under a new clearly-labeled section (mirror the `Kamino…` / `Aave…` blocks). **Numeric fields from the wire are strings** (see `KaminoDeposit.tokenAmount`, `AaveReserve.usdExchangeRate`) — type them as `string` and coerce later. Type genuinely optional fields as nullable/optional.

3. **Client** — create `src/lib/<protocol>-client.ts`:
   - Header comment stating it is a **read-only** client and how it caches (Kamino uses `next: { revalidate: 15 }`; Aave uses a manual 15s in-memory cache because POST can't revalidate).
   - A `fetchJson<T>()`-style helper that throws `Error('<Protocol> API error: <status> <statusText>')` on non-ok responses.
   - `export async function load<Protocol>Positions(address, …): Promise<PortfolioPosition[]>` — fetch, then map each loan into a `PortfolioPosition` with `collateral: PortfolioAsset[]` and `borrows: PortfolioBorrowAsset[]`, coercing every string numeric with `Number(...)`. Keep `liquidationThreshold` and `borrowFactor` as fractions in `[0, 1]` (never percents).
   - Export any helper the route needs (Aave exports `resolveChainIds`).

4. **Validation / routing** — extend `src/lib/validation.ts` so `validateAddress` detects the new protocol's address format and returns its name in `ValidationResult.protocol` (widen that union and `PortfolioResponse.protocol` in `src/types/index.ts`). Add a branch in `src/app/api/portfolio/[address]/route.ts` that calls `load<Protocol>Positions` and returns `{ protocol, positions }`. Wire reserve lookups into `src/app/api/reserve/route.ts` if applicable.

5. **Market display** — update `src/lib/markets.ts` so the new protocol's `marketId` shape is detected and its chain/protocol render correctly (it currently distinguishes Kamino from Aave by the `chainId:` prefix).

6. **Tests + coverage** — add the new client to the `coverage.include` list in `vitest.config.ts` (thresholds are **100%** across lines/functions/branches/statements). Add parser tests to `tests/api-parsers.test.ts` (and a dedicated `tests/<protocol>-client.test.ts` if substantial), covering: happy path, empty positions, **non-ok HTTP**, and **null/missing optional fields**. Run `yarn coverage` until it passes at 100%.

7. **Verify** — `yarn typecheck && yarn lint && yarn coverage` all green. Spot-check the live endpoint with a known address via `GET /api/portfolio/<address>?protocol=<name>`.

## Done when

`yarn typecheck`, `yarn lint`, and `yarn coverage` (100%) all pass, and the new protocol resolves real positions through `/api/portfolio/[address]`.
