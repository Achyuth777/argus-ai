const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const mod = { exports: {} };
new Function(
  "exports",
  "require",
  ts.transpileModule(fs.readFileSync("lib/risk.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
)(mod.exports, require);
const {
  DEMO_POSITIONS,
  metrics,
  simulate,
  requiredRepayment,
  requiredCollateral,
  riskState,
  defaultRule,
  evaluateRule,
  applyProtection,
} = mod.exports;
let checks = 0;
const close = (a, b) => {
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
  checks++;
};
const p = DEMO_POSITIONS[0];
close(metrics(p).hf, 1.7198297872340425);
close(metrics(p).liquidationPrice, 73.4375);
close(metrics(simulate(p, 26)).hf, metrics(p).hf * 0.74);
for (const x of DEMO_POSITIONS) {
  for (const drop of [0, 5, 10, 20, 30, 50]) {
    const q = simulate(x, drop),
      m = metrics(q);
    close(m.buffer, (1 - 1 / m.hf) * 100);
    const repay = requiredRepayment(q, 2.5);
    close(metrics({ ...q, debt: q.debt - repay }).hf, 2.5);
    const topup = requiredCollateral(q, 2.5);
    close(metrics({ ...q, units: q.units + topup / q.price }).hf, 2.5);
  }
}
assert.equal(riskState(1.6), "SAFE");
assert.equal(riskState(1.3), "WATCH");
assert.equal(riskState(1.1), "WARNING");
assert.equal(riskState(1.0999), "CRITICAL");
checks += 4;
const rule = defaultRule(),
  shocked = simulate(p, 26);
const result = evaluateRule(rule, shocked, 2400);
assert.equal(result.ok, true);
assert.equal(result.amount, 500);
close(metrics(applyProtection(shocked, rule, result.amount)).hf, 1.61664);
assert.equal(evaluateRule({ ...rule, armed: false }, shocked, 2400).ok, false);
assert.equal(
  evaluateRule({ ...rule, expiresAt: "2000-01-01" }, shocked, 2400).ok,
  false,
);
assert.equal(
  evaluateRule({ ...rule, sessionExpiresAt: "2000-01-01" }, shocked, 2400).ok,
  false,
);
assert.equal(evaluateRule({ ...rule, spent: 1000 }, shocked, 2400).ok, false);
assert.equal(evaluateRule(rule, shocked, 0).ok, false);
assert.equal(evaluateRule(rule, p, 2400).ok, false);
assert.equal(evaluateRule(rule, simulate(p, 50), 2400).ok, false);
assert.equal(evaluateRule(rule, shocked, 100).amount, 100);
checks += 10;
assert.equal(metrics({ ...p, debt: 0 }).hf, Infinity);
assert.equal(requiredRepayment({ ...p, debt: 0 }, 1.6), 0);
checks += 2;
console.log(`${checks} financial-model and safeguard assertions passed.`);
