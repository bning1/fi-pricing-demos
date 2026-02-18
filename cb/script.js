// Black-Scholes cumulative normal CDF approximation
function normCDF(x) {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x &gt;= 0.0) {
    const t = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 + p * -x);
    return c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

// Black-Scholes call price (q=0 dividend yield)
function blackScholesCall(S, K, T, r, sigma) {
  if (T &lt;= 0) {
    return Math.max(S - K, 0);
  }
  if (sigma &lt;= 0) {
    return Math.max(S * Math.exp(-r * T) - K * Math.exp(-r * T), 0);
  }
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
}

document.getElementById('cbForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const face = parseFloat(document.getElementById('face').value) || 0;
  const coupon = parseFloat(document.getElementById('coupon').value) / 100 || 0;
  const conv = parseFloat(document.getElementById('conv').value) || 0;
  const S = parseFloat(document.getElementById('stock').value) || 0;
  const vol = parseFloat(document.getElementById('vol').value) / 100 || 0;
  const r = parseFloat(document.getElementById('r').value) / 100 || 0;
  const T = parseFloat(document.getElementById('T').value) || 0;

  // Straight bond value (continuous compounding, continuous coupon at annual rate)
  let straight;
  if (r === 0) {
    straight = face * (1 + coupon * T);
  } else {
    straight = face * coupon * (1 - Math.exp(-r * T)) / r + face * Math.exp(-r * T);
  }

  // Option value: BS call on stock * conv_ratio shares, strike = face
  const K = face / conv;
  const callValue = blackScholesCall(S, K, T, r, vol) * conv;
  const cbPrice = straight + callValue;

  document.getElementById('result').innerHTML = `
    &lt;div&gt;Straight: $${straight.toFixed(2)}&lt;/div&gt;
    &lt;div&gt;Option: $${callValue.toFixed(2)}&lt;/div&gt;
    &lt;div&gt;CB Price: $${cbPrice.toFixed(2)}&lt;/div&gt;
  `;
});