/**
 * Barrier Options Pricer — Reiner-Rubinstein (1991) closed-form.
 * 8 vanilla barriers: UIC, UIP, UOC, UOP, DIC, DIP, DOC, DOP.
 *
 * Inputs:
 *   S  = spot price
 *   H  = barrier level
 *   K  = strike price
 *   r  = risk-free rate (decimal, e.g. 0.05)
 *   q  = dividend yield (decimal, default 0)
 *   v  = volatility (decimal, e.g. 0.20)
 *   T  = time to maturity (years)
 *
 * Reference: Reiner & Rubinstein, "Breaking Down the Barriers", Risk 4(8), 1991.
 */

(function () {
  'use strict';

  // --- Utilities ---

  /** Cumulative normal distribution (Abramowitz & Stegun approximation). */
  function N(x) {
    var a1 =  0.31938153, a2 = -0.356563782, a3 =  1.781477937,
        a4 = -1.821255978, a5 = 1.330274429;
    var L = Math.abs(x);
    var k = 1.0 / (1.0 + 0.2316419 * L);
    var w = 1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-L * L / 2.0) *
            (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
    return x < 0 ? 1.0 - w : w;
  }

  // --- Reiner-Rubinstein building blocks (A-F terms) ---

  function mu(r, q, v) { return (r - q - 0.5 * v * v) / (v * v); }

  function lambda(r, q, v) {
    var m = mu(r, q, v);
    return Math.sqrt(m * m + 2.0 * r / (v * v));
  }

  function x1(S, K, v, T, r, q) {
    return Math.log(S / K) / (v * Math.sqrt(T)) + (1 + mu(r, q, v)) * v * Math.sqrt(T);
  }

  function x2(S, H, v, T, r, q) {
    return Math.log(S / H) / (v * Math.sqrt(T)) + (1 + mu(r, q, v)) * v * Math.sqrt(T);
  }

  function y1(H, S, K, v, T, r, q) {
    return Math.log(H * H / (S * K)) / (v * Math.sqrt(T)) + (1 + mu(r, q, v)) * v * Math.sqrt(T);
  }

  function y2(H, S, v, T, r, q) {
    return Math.log(H / S) / (v * Math.sqrt(T)) + (1 + mu(r, q, v)) * v * Math.sqrt(T);
  }

  function z(H, S, v, T, r, q) {
    return Math.log(H / S) / (v * Math.sqrt(T)) + lambda(r, q, v) * v * Math.sqrt(T);
  }

  // Term A: vanilla call/put component
  function A(phi, S, K, r, q, v, T) {
    var d1 = x1(S, K, v, T, r, q);
    var d2 = d1 - v * Math.sqrt(T);
    return phi * (S * Math.exp(-q * T) * N(phi * d1) - K * Math.exp(-r * T) * N(phi * d2));
  }

  // Term B
  function B(phi, S, H, r, q, v, T) {
    var d1 = x2(S, H, v, T, r, q);
    var d2 = d1 - v * Math.sqrt(T);
    return phi * (S * Math.exp(-q * T) * N(phi * d1) - K_placeholder * Math.exp(-r * T) * N(phi * d2));
  }

  // We need to pass K into B — Reiner-Rubinstein B uses H not K for log but K for payoff.
  // Corrected: B uses x2 (log(S/H)) but strike K in the payoff.
  function B_full(phi, S, K, H, r, q, v, T) {
    var d1 = x2(S, H, v, T, r, q);
    var d2 = d1 - v * Math.sqrt(T);
    return phi * (S * Math.exp(-q * T) * N(phi * d1) - K * Math.exp(-r * T) * N(phi * d2));
  }

  // Term C
  function C(phi, eta, S, K, H, r, q, v, T) {
    var m = mu(r, q, v);
    var hy1 = y1(H, S, K, v, T, r, q);
    var hy2 = hy1 - v * Math.sqrt(T);
    return phi * (S * Math.exp(-q * T) * Math.pow(H / S, 2 * (m + 1)) * N(eta * hy1) -
                  K * Math.exp(-r * T) * Math.pow(H / S, 2 * m) * N(eta * hy2));
  }

  // Term D
  function D(phi, eta, S, K, H, r, q, v, T) {
    var m = mu(r, q, v);
    var hy2 = y2(H, S, v, T, r, q);
    var hy2m = hy2 - v * Math.sqrt(T);
    return phi * (S * Math.exp(-q * T) * Math.pow(H / S, 2 * (m + 1)) * N(eta * hy2) -
                  K * Math.exp(-r * T) * Math.pow(H / S, 2 * m) * N(eta * hy2m));
  }

  // Term E (for knock-in rebate — we set rebate = 0 for vanilla)
  function E(eta, S, H, r, q, v, T, rebate) {
    var m = mu(r, q, v);
    var lam = lambda(r, q, v);
    var hx2 = x2(S, H, v, T, r, q);
    var hy2 = y2(H, S, v, T, r, q);
    return rebate * Math.exp(-r * T) * (N(eta * hx2 - eta * v * Math.sqrt(T)) -
           Math.pow(H / S, 2 * m) * N(eta * hy2 - eta * v * Math.sqrt(T)));
  }

  // Term F (for knock-out rebate — we set rebate = 0 for vanilla)
  function F(eta, S, H, r, q, v, T, rebate) {
    var lam = lambda(r, q, v);
    var hz = z(H, S, v, T, r, q);
    return rebate * (Math.pow(H / S, mu(r, q, v) + lam) * N(eta * hz) +
           Math.pow(H / S, mu(r, q, v) - lam) * N(eta * hz - 2 * eta * lam * v * Math.sqrt(T)));
  }

  // --- 8 Barrier Option Pricers ---
  // phi = +1 for call, -1 for put
  // eta = +1 for down barriers, -1 for up barriers
  // Rebate = 0 (vanilla, no rebate)

  /** Down-and-In Call (S > H) */
  function DIC(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S <= H) return A(1, S, K, r, q, v, T); // already knocked in
    if (K >= H) {
      return C(1, 1, S, K, H, r, q, v, T);
    } else {
      return A(1, S, K, r, q, v, T) - B_full(1, S, K, H, r, q, v, T) + D(1, 1, S, K, H, r, q, v, T);
    }
  }

  /** Down-and-In Put (S > H) */
  function DIP(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S <= H) return A(-1, S, K, r, q, v, T); // already knocked in
    if (K >= H) {
      return B_full(-1, S, K, H, r, q, v, T) - C(-1, 1, S, K, H, r, q, v, T) + D(-1, 1, S, K, H, r, q, v, T);
    } else {
      return A(-1, S, K, r, q, v, T);
    }
  }

  /** Down-and-Out Call (S > H) */
  function DOC(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S <= H) return 0; // knocked out
    // DOC = Vanilla Call - DIC
    return A(1, S, K, r, q, v, T) - DIC(S, H, K, r, v, T, q);
  }

  /** Down-and-Out Put (S > H) */
  function DOP(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S <= H) return 0; // knocked out
    // DOP = Vanilla Put - DIP
    return A(-1, S, K, r, q, v, T) - DIP(S, H, K, r, v, T, q);
  }

  /** Up-and-In Call (S < H) */
  function UIC(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S >= H) return A(1, S, K, r, q, v, T); // already knocked in
    if (K >= H) {
      return A(1, S, K, r, q, v, T);
    } else {
      return B_full(1, S, K, H, r, q, v, T) - C(1, -1, S, K, H, r, q, v, T) + D(1, -1, S, K, H, r, q, v, T);
    }
  }

  /** Up-and-In Put (S < H) */
  function UIP(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S >= H) return A(-1, S, K, r, q, v, T); // already knocked in
    if (K >= H) {
      return C(-1, -1, S, K, H, r, q, v, T);
    } else {
      return A(-1, S, K, r, q, v, T) - B_full(-1, S, K, H, r, q, v, T) + D(-1, -1, S, K, H, r, q, v, T);
    }
  }

  /** Up-and-Out Call (S < H) */
  function UOC(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S >= H) return 0; // knocked out
    // UOC = Vanilla Call - UIC
    return A(1, S, K, r, q, v, T) - UIC(S, H, K, r, v, T, q);
  }

  /** Up-and-Out Put (S < H) */
  function UOP(S, H, K, r, v, T, q) {
    q = q || 0;
    if (S >= H) return 0; // knocked out
    // UOP = Vanilla Put - UIP
    return A(-1, S, K, r, q, v, T) - UIP(S, H, K, r, v, T, q);
  }

  // --- Public API ---
  window.BarrierPricers = {
    UIC: function (S, H, K, r, v, T) { return Math.max(0, UIC(S, H, K, r, v, T, 0)); },
    UIP: function (S, H, K, r, v, T) { return Math.max(0, UIP(S, H, K, r, v, T, 0)); },
    UOC: function (S, H, K, r, v, T) { return Math.max(0, UOC(S, H, K, r, v, T, 0)); },
    UOP: function (S, H, K, r, v, T) { return Math.max(0, UOP(S, H, K, r, v, T, 0)); },
    DIC: function (S, H, K, r, v, T) { return Math.max(0, DIC(S, H, K, r, v, T, 0)); },
    DIP: function (S, H, K, r, v, T) { return Math.max(0, DIP(S, H, K, r, v, T, 0)); },
    DOC: function (S, H, K, r, v, T) { return Math.max(0, DOC(S, H, K, r, v, T, 0)); },
    DOP: function (S, H, K, r, v, T) { return Math.max(0, DOP(S, H, K, r, v, T, 0)); }
  };

  /** Vanilla Black-Scholes (for reference/validation). */
  window.BarrierPricers.vanillaCall = function (S, K, r, v, T) { return A(1, S, K, r, 0, v, T); };
  window.BarrierPricers.vanillaPut  = function (S, K, r, v, T) { return A(-1, S, K, r, 0, v, T); };

  /** normCDF exposed for testing. */
  window.BarrierPricers.normCDF = N;

})();
