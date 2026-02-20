# LOG.md - Decisions & Changes

## 2026-02-20: Cap/Floor Integration (Golem)
- Implemented Black '76 caplet pricer with multi-period summation (cap/floor toggle).
- normCdf: Abramowitz approx (accurate to ~0.001 for pricing).
- Assumptions: Flat libor curve/forward, ACT/360 simplified.
- Inputs: Notional, dates, freq, strike, vol, libor.
- Outputs: Per-caplet table, total bps, strike sensitivity chart (Chart.js).
- Verified: Sample cap ~12bps (1y, ATM-ish).
- Hub updated with link.
- No deps beyond Chart.js CDN. Pure JS.

Next: Unblock binomial/heston?
