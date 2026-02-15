function normcdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-0.5 * x * x);
  let prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

function blackScholesCall(S, K, T, r, sigma, q) {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * Math.exp(-q * T) * normcdf(d1) - K * Math.exp(-r * T) * normcdf(d2);
}

function calculateCall() {
  const S = parseFloat(document.getElementById('spot').value) || 0;
  const K = parseFloat(document.getElementById('strike').value) || 0;
  const T = parseFloat(document.getElementById('time').value) || 0;
  const r = parseFloat(document.getElementById('r').value) / 100 || 0;
  const q = parseFloat(document.getElementById('q').value) / 100 || 0;
  const sigma = parseFloat(document.getElementById('vol').value) / 100 || 0;

  const price = blackScholesCall(S, K, T, r, sigma, q);

  const results = document.getElementById('callResults');
  results.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Pricing Results';
  results.appendChild(h2);

  const pPrice = document.createElement('p');
  const strongPrice = document.createElement('strong');
  strongPrice.textContent = 'European Call Price:';
  pPrice.appendChild(strongPrice);
  pPrice.appendChild(document.createTextNode(` $${price.toFixed(2)}`));
  results.appendChild(pPrice);

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Greeks & details';
  details.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = `Spot: $${S}\nStrike: $${K}\nT: ${T}y\nr: ${(r*100).toFixed(1)}%\nq: ${(q*100).toFixed(1)}%\nVol: ${(sigma*100).toFixed(1)}%\nd1: ${((Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))).toFixed(4)}\nPrice: $${price.toFixed(2)}`;
  details.appendChild(pre);
  results.appendChild(details);

  const emP = document.createElement('p');
  const em = document.createElement('em');
  em.textContent = 'Notes: Black-Scholes European call, continuous div/r, lognormal vol.';
  emP.appendChild(em);
  results.appendChild(emP);

  console.table({
    'Call Price': price.toFixed(2),
    Spot: S,
    Strike: K,
    T_y: T,
    r_pct: r * 100,
    q_pct: q * 100,
    Vol_pct: sigma * 100
  });
}