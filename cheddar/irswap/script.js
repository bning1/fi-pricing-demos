function calculateIRS() {
  const notional = parseFloat(document.getElementById('notional').value) || 0;
  const fixedRate = parseFloat(document.getElementById('fixedRate').value) / 100 || 0;
  const tenor = parseFloat(document.getElementById('tenor').value) || 0;
  const freqMonths = parseFloat(document.getElementById('frequency').value) || 6;
  const discountRate = parseFloat(document.getElementById('discountRate').value) / 100 || 0;
  const forwardRate = parseFloat(document.getElementById('forwardRate').value) / 100 || 0;

  const periodYears = freqMonths / 12;
  const numPeriods = Math.floor(tenor / periodYears);

  let pvFixed = 0;
  let pvFloating = 0;
  const detailLines = [];

  for (let i = 1; i <= numPeriods; i++) {
    const t = i * periodYears;
    const delta = periodYears;
    const df = Math.exp(-discountRate * t);

    const fixedCashflow = notional * delta * fixedRate;
    const floatingCashflow = notional * delta * forwardRate;
    pvFixed += fixedCashflow * df;
    pvFloating += floatingCashflow * df;

    detailLines.push(`Period ${i} (t=${t.toFixed(2)}y): DF=${df.toFixed(4)}, Fixed CF=${fixedCashflow.toLocaleString()}, PV=${(fixedCashflow * df).toLocaleString()} | Floating CF=${floatingCashflow.toLocaleString()}, PV=${(floatingCashflow * df).toLocaleString()}`);
  }

  const netPV = pvFloating - pvFixed;

  const results = document.getElementById('results');
  results.innerHTML = '';

  // H2: Pricing Results
  const h2 = document.createElement('h2');
  h2.textContent = 'Pricing Results';
  results.appendChild(h2);

  // PV Fixed Rate Leg
  const pFixed = document.createElement('p');
  const strongFixed = document.createElement('strong');
  strongFixed.textContent = 'PV Fixed Rate Leg:';
  pFixed.appendChild(strongFixed);
  pFixed.appendChild(document.createTextNode(` $${pvFixed.toLocaleString(undefined, {maximumFractionDigits: 0, minimumFractionDigits: 0})}`));
  results.appendChild(pFixed);

  // PV Floating Rate Leg
  const pFloating = document.createElement('p');
  const strongFloating = document.createElement('strong');
  strongFloating.textContent = 'PV Floating Rate Leg:';
  pFloating.appendChild(strongFloating);
  pFloating.appendChild(document.createTextNode(` $${pvFloating.toLocaleString(undefined, {maximumFractionDigits: 0, minimumFractionDigits: 0})}`));
  results.appendChild(pFloating);

  // Net PV
  const pNet = document.createElement('p');
  const strongNet = document.createElement('strong');
  strongNet.textContent = 'Net PV (Fixed Payer):';
  pNet.appendChild(strongNet);
  pNet.appendChild(document.createTextNode(` $${netPV.toLocaleString(undefined, {maximumFractionDigits: 0, minimumFractionDigits: 0})}`));
  results.appendChild(pNet);

  // Details toggle
  const detailsElem = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Detailed Cashflows (console also logs)';
  detailsElem.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = detailLines.join('\n');
  detailsElem.appendChild(pre);
  results.appendChild(detailsElem);

  // Notes
  const pNotes = document.createElement('p');
  const em = document.createElement('em');
  em.textContent = 'Notes: Flat curves, continuous compounding, simplified delta. Real IRS uses bootstrapped curves, day counts (ACT/360), etc.';
  pNotes.appendChild(em);
  results.appendChild(pNotes);

  // Console summary
  console.table({
    'PV Fixed Rate Leg': pvFixed,
    'PV Floating Rate Leg': pvFloating,
    'Net PV (Fixed Payer)': netPV,
    Notional: notional,
    'Coupon Rate (Fixed)': (fixedRate * 100).toFixed(2) + '%',
    Tenor: tenor + 'y',
    'Discount Rate': (discountRate * 100).toFixed(2) + '%',
    'Floating Rate': (forwardRate * 100).toFixed(2) + '%'
  });
}