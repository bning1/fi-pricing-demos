function normcdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-0.5 * x * x);
  let prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

function blackCall(F, K, sigma, t) {
  if (t <= 0) return 0;
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return F * normcdf(d1) - K * normcdf(d2);
}

function calculateSwaption() {
  const notional = parseFloat(document.getElementById('notional').value) || 0;
  const strike = parseFloat(document.getElementById('strike').value) / 100;
  const fwdSwap = parseFloat(document.getElementById('fwdSwap').value) / 100;
  const vol = parseFloat(document.getElementById('vol').value) / 100;
  const expiry = parseFloat(document.getElementById('expiry').value) || 0;
  const annuity = parseFloat(document.getElementById('annuity').value) || 0;

  const t = expiry;
  const sigma = vol * Math.sqrt(t);
  const black = blackCall(fwdSwap, strike, sigma, t);
  const price = notional * annuity * black;

  const results = document.getElementById('swapResults');
  results.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Pricing Results';
  results.appendChild(h2);

  const pPrice = document.createElement('p');
  const strongPrice = document.createElement('strong');
  strongPrice.textContent = 'Payer Swaption NPV:';
  pPrice.appendChild(strongPrice);
  pPrice.appendChild(document.createTextNode(` $${price.toLocaleString(undefined, {maximumFractionDigits: 0})}`));
  results.appendChild(pPrice);

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Black details';
  details.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = `Fwd Swap: ${(fwdSwap*100).toFixed(2)}%\nStrike: ${(strike*100).toFixed(2)}%\nVol * sqrt(T): ${(sigma*100).toFixed(2)}%\nBlack: ${black.toFixed(4)}\nAnnuity: ${annuity}`;
  details.appendChild(pre);
  results.appendChild(details);

  const emP = document.createElement('p');
  const em = document.createElement('em');
  em.textContent = 'Notes: European payer (call on swap rate), Black approx, annuity = ∑ δ DF.';
  emP.appendChild(em);
  results.appendChild(emP);

  console.table({
    'Swaption NPV': price,
    Notional,
    'Strike (%)': strike * 100,
    'Fwd Swap (%)': fwdSwap * 100,
    'Vol (%)': vol * 100,
    'Expiry (y)': expiry,
    Annuity,
    Black: black
  });
}