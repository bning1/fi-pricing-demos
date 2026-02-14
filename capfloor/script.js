function normcdf(x) {
  // High accuracy normal CDF approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-0.5 * x * x);
  let prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

function blackCap(F, K, sigma, t) {
  if (t <= 0) return 0;
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return F * normcdf(d1) - K * normcdf(d2);
}

function calculateCap() {
  const notional = parseFloat(document.getElementById('notional').value) || 0;
  const strike = parseFloat(document.getElementById('strike').value) / 100;
  const forward = parseFloat(document.getElementById('forward').value) / 100;
  const vol = parseFloat(document.getElementById('vol').value) / 100;
  const tenor = parseFloat(document.getElementById('tenor').value) || 0;
  const freqMonths = parseFloat(document.getElementById('frequency').value) || 6;
  const discount = parseFloat(document.getElementById('discount').value) / 100;

  const periodYears = freqMonths / 12;
  const numPeriods = Math.floor(tenor / periodYears);

  let capPrice = 0;
  const detailLines = [];

  for (let i = 1; i <= numPeriods; i++) {
    const t = i * periodYears;
    const delta = periodYears;
    const df = Math.exp(-discount * t);
    const capletUndisc = blackCap(forward, strike, vol, t);
    const caplet = notional * delta * df * capletUndisc;
    capPrice += caplet;
    detailLines.push(`Caplet ${i} (t=${t.toFixed(2)}y): Black=${capletUndisc.toFixed(4)}, PV=$${caplet.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
  }

  const results = document.getElementById('capResults');
  results.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Pricing Results';
  results.appendChild(h2);

  const pCap = document.createElement('p');
  const strongCap = document.createElement('strong');
  strongCap.textContent = 'Payer Cap NPV:';
  pCap.appendChild(strongCap);
  pCap.appendChild(document.createTextNode(` $${capPrice.toLocaleString(undefined, {maximumFractionDigits: 0, minimumFractionDigits: 0})}`));
  results.appendChild(pCap);

  const detailsElem = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Caplet details (console logs too)';
  detailsElem.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = detailLines.join('\n');
  detailsElem.appendChild(pre);
  results.appendChild(detailsElem);

  const pNotes = document.createElement('p');
  const em = document.createElement('em');
  em.textContent = 'Notes: Payer cap (call on libor), Black\\''76, flat F/vol/r, simplified δ. Real: smile, smiley, margined.';
  pNotes.appendChild(em);
  results.appendChild(pNotes);

  console.table({
    'Cap NPV': capPrice,
    Notional,
    'Strike (%)': strike * 100,
    'Forward (%)': forward * 100,
    'Vol (%)': vol * 100,
    Tenor,
    Frequency: freqMonths,
    'Discount (%)': discount * 100
  });
}