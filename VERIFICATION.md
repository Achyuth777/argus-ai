# Verification

- Production Next.js build and TypeScript compilation passed.
- 74 financial-model and safeguard assertions passed (`node tests/risk.test.cjs`).
- Headless Chromium production-browser checks passed: landing/demo navigation, position drawer and Escape dismissal, 20% simulator and liquidation-crossing state, Risk Radar filters, edit/pause/arm/test rules, full shock progression and $500 repayment to HF 1.62, session balance deduction, activity timeline, contextual Guardian answer, revoke automation, demo-to-disconnected isolation, and Phantom/Solflare wallet picker.
- Overview checked at 1440, 1280, 1024 and 390px. No horizontal page overflow at tested settled layouts. Reduced motion used with the accelerated test clock to prevent frozen CSS-transition artifacts.
- Desktop, mobile, landing and rule-dialog screenshots visually inspected. Mobile date inputs were changed to a single-column form to avoid clipping.
- Mobile form overflow check and manual-approval market shock/recovery also passed.
- No uncaught application page errors in the completed browser flow.

## Not externally verified

Actual wallet extension approval, provider outage/wrong-network responses against a real wallet, mainnet Kamino obligations and real transaction submission/confirmation were not exercised. There is no configured Kamino indexer or autonomous executor. These remain documented integration work, not completed live capabilities. Production signing cannot be inferred from successful demo tests.

The preserved V1 dependency graph emits peer/deprecation warnings. Production font loading requires Google's font hosts at build time through the existing next/font setup. Browser testing used a trusted test context for this environment's certificate proxy; one initial untrusted external-resource request failed before that context was configured.
