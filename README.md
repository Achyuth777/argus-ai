# ARGUS V2

Autonomous risk intelligence for Solana DeFi. An in-place upgrade of [Argus V1](https://github.com/jahanvi-jha/argus), retaining Next.js 16 / React 19, TypeScript, Tailwind 4, Solana wallet adapters, the Gemini endpoint, and the dependency lockfile.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000 and choose **Explore Demo**. Production: `npm run build && npm start`. Node 22 LTS recommended. Existing dependencies have upstream peer/deprecation warnings; no new production libraries were added.

## The 37-second demonstration

Explore Demo → Simulate market shock. Three correlated collateral prices fall in six stages. SOL HF moves 1.72 → 1.27, crosses WATCH then WARNING, and the default 22%-of-debt repayment rule triggers. The $500 execution cap limits repayment, yielding HF 1.62. The session USDC balance decreases by $500 and the timeline records the simulated action. No signature is invented.

The shock preserves edited rule settings, pauses, revocations, and balances. It resets positions to the scenario baseline. **Reset** starts a fresh demo with the default rule and balance. Set manual approval in Protection to test the approval flow. Pause/revoke a rule to see a blocked response. Rules and events are session-local and are not persisted across reloads. The daily cap is modeled as a session allowance, without background resets.

## Features

- Frontier command center, collapsible navigation, responsive position cards, risk gauge and health history.
- Position detail drawer, liquidation buffer and explainable recommendations.
- Risk Radar filters and urgency/size/health/distance sorting.
- Deterministic, instant 0–50% market simulator with target-HF repayment/top-up estimates.
- Protection rule create/edit/pause/delete/test; amount, balance, allowance, expiry and approval safeguards.
- Activity and notification centers; timeline with signature links only when an actual signature exists.
- Portfolio-aware deterministic AI Guardian; the existing Gemini endpoint is retained separately.
- Interactive public landing page, reduced-motion support, native accessible dialogs, keyboard focus states.

## V1 inspection and preserved integrations

V1's `app/page.tsx` was a 2,090-line client page with navigation, demo figures and simulated confirmation state. `AppWalletProvider` already used Phantom/Solflare. `DemoContext` supplied the mode. `useKaminoPositions` returned hardcoded data both for demo and connected wallets. `/api/kamino/positions` had its SDK disabled and returned healthy placeholder values. `useWalletPositions` read SPL tokens on devnet. `/api/chat` called Gemini with server-side credentials. Old PositionCard, RiskBadge and chat components remain available for reference/reuse.

V2 keeps the framework, provider, context, chat endpoint and package versions. It extracts the primary experience into `components/v2` and calculations into `lib/risk.ts`. Wallet connection defaults to mainnet, and the position hook no longer disguises demo numbers as live data. The unconfigured Kamino endpoint returns an explicit 503 rather than HF 999. Legacy devnet token retrieval is retained but is not used by V2.

## Real-data / execution limits

**This is a functional risk and protection simulator, not production autonomous execution.** Phantom/Solflare connection is real; read-only RPC genesis checks distinguish mainnet, wrong network and RPC failure. Kamino live position indexing was not implemented in V1 and remains explicitly unavailable here. No live positions, balances, health claims, or successful transactions are fabricated. The current V2 UI accepts demo positions only; adding live positions requires a verified adapter to the canonical Position model, not merely changing the API response.

No transaction builder, executor, session-key delegation or background monitoring is enabled. Revoke Automation pauses demo rules; it does not claim to revoke an on-chain permission. True pending/confirmed/failed blockchain execution requires a future audited executor and signature confirmation. The UI supports pending/failed/simulated protection events; no real transaction-confirmed event is emitted.

Before live deployment: integrate and validate Kamino obligations/reserves and oracle freshness, support multi-asset debt/collateral and protocol-specific risk weights, handle rate limits and stale data, implement signed transaction previews and confirmation/recovery, use durable event/rule storage, and implement explicit bounded on-chain permissions. Gemini should gain request validation, authentication/rate limits and deployment-specific security review before exposing it publicly.

## Calculations

The model assumes a single SOL-correlated collateral asset per position with stable USDC debt and fixed liquidation LTV.

- Collateral = asset units × oracle price.
- HF = collateral × liquidation LTV / debt.
- LTV = debt / collateral.
- Liquidation price = debt / (units × liquidation LTV).
- Buffer = (1 − liquidation price / current price) × 100; negative means beyond threshold.
- Repayment to target = max(0, debt − collateral × liquidation LTV / target HF).
- Same-asset collateral needed = max(0, target HF × debt / liquidation LTV − collateral).
- SAFE ≥ 1.60; WATCH ≥ 1.30; WARNING ≥ 1.10; CRITICAL below 1.10. HF ≤ 1 reaches modeled liquidation.
- Portfolio score = clamp((2.2 − lowest HF) / 1.2 × 100, 0, 100). This heuristic is not a liquidation probability.

mSOL/JitoSOL follow SOL proportionally in demo. No depeg, oracle delay, liquidity impact, fees or interest growth is included in a price shock. History is labelled simulated session samples; it is not a fabricated 24h feed. Rule-covered capital is not a guarantee of protected capital. Top-up assumes same-asset purchase at modeled price; deleverage applies the configured slippage haircut, without representing an executable quote.

## Configuration

Copy `.env.example` to `.env.local` and use your own mainnet RPC if connecting a wallet. Never put private keys or seed phrases into configuration. The existing Gemini API is optional and not called by deterministic Guardian.

## Verify

```sh
node tests/risk.test.cjs
npx tsc --noEmit
npm run build
```

Financial regression tests check target-HF inversions, liquidation-distance consistency, threshold boundaries, expiry, limits, insufficient balances, liquidation-crossed guards and default shock recovery. Browser verification is documented in `VERIFICATION.md`.
