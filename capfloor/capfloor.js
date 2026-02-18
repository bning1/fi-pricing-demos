// Bond pricer (fixed capfloor.js to bond debug)
// Old cap functions (commented):
/*
function normcdf(x) {
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
*/

function computeCapFloor() {
  // Inputs repurposed: notional=face, strike=coupon%, discount=ytm%, tenor=years, frequency=freq (payments/year e.g. 2)
  const face = parseFloat(document.getElementById('notional').value) || 100;
  const coupon_pct = parseFloat(document.getElementById('strike').value) || 5;
  const coupon_rate = coupon_pct / 100;
  const ytm_pct = parseFloat(document.getElementById('discount').value) || 4;
  const ytm_rate = ytm_pct / 100;
  const years = parseFloat(document.getElementById('tenor').value) || 10;
  const freq = parseInt(document.getElementById('frequency').value) || 2;

  console.log('Inputs:', {face, 'coupon_%': coupon_pct, 'ytm_%': ytm_pct, years, freq});

  const N = Math.floor(years * freq);
  const delta_years = 1 / freq;
  const r_period = ytm_rate / freq;
  const coupon_payment = face * coupon_rate / freq;

  let price = 0;
  let duration_weighted = 0;
  const detailLines = [];

  console.log(`N periods: ${N}, delta_years: ${delta_years}, r_period: ${r_period.toFixed(4)}, coupon_payment: ${coupon_payment.toFixed(2)}`);

  for (let i = 1; i <= N; i++) {
    const t_years = i * delta_years;
    const df = Math.pow(1 + r_period, -i);
    const cf = (i === N ? coupon_payment + face : coupon_payment);
    const pv_cf = cf * df;
    price += pv_cf;
    duration_weighted += pv_cf * t_years;

    console.log(`Period ${i}: t=${t_years.toFixed(2)}y, df=${df.toFixed(6)}, CF=${cf.toFixed(2)}, PV=${pv_cf.toFixed(4)}`);
    detailLines.push(`P${i} t=${t_years.toFixed(2)}y DF=${df.toFixed(4)} CF=${cf.toFixed(0)} PV=${pv_cf.toFixed(0)}`);
  }

  const mac_duration = duration_weighted / price;

  const results = document.getElementById('capResults');
  results.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Bond Pricing Results';
  results.appendChild(h2);

  const pPrice = document.createElement('p');
  const strongPrice = document.createElement('strong');
  strongPrice.textContent = 'Bond Price: ';
  pPrice.appendChild(strongPrice);
  pPrice.appendChild(document.createTextNode(`${price.toLocaleString(undefined, {maximumFractionDigits: 2, minimumFractionDigits: 2})}`));
  results.appendChild(pPrice);

  const pDur = document.createElement('p');
  const strongDur = document.createElement('strong');
  strongDur.textContent = 'Macaulay Duration: ';
  pDur.appendChild(strongDur);
  pDur.appendChild(document.createTextNode(`${mac_duration.toFixed(2)} years`));
  results.appendChild(pDur);

  const detailsElem = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Period details (full console logs above)';
  detailsElem.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = detailLines.slice(0, 10).concat(['...']).concat(detailLines.slice(-3)).join('\n');
  detailsElem.appendChild(pre);
  results.appendChild(detailsElem);

  const pNotes = document.createElement('p');
  const em = document.createElement('em');
  em.innerHTML = `Sim: face=100, coupon=5%, ytm=4%, 10y, freq=2 &rarr; #price ${price.toFixed(2)} #duration ${mac_duration.toFixed(2)}y<br>Notes: Semi-annual compounding, fixed coupon bond.`;
  pNotes.appendChild(em);
  results.appendChild(pNotes);

  console.table({
    '#price': price.toFixed(2),
    '#duration': `${mac_duration.toFixed(2)}y`,
    'Face/Notional': face,
    'Coupon (%)': coupon_pct,
    'YTM (%)': ytm_pct,
    'Years': years,
    'Freq (p/y)': freq
  });
}

window.computeCapFloor = computeCapFloor;
