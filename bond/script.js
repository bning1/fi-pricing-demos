function calculateBond() {
  const face = parseFloat(document.getElementById('faceValue').value) || 0;
  const couponRate = parseFloat(document.getElementById('couponRate').value) / 100 || 0;
  const ytm = parseFloat(document.getElementById('ytm').value) / 100 || 0;
  const years = parseFloat(document.getElementById('years').value) || 0;
  const freq = parseInt(document.getElementById('frequency').value) || 2;

  const numPeriods = Math.floor(years * freq);
  const couponPayment = face * couponRate / freq;
  const periodRate = ytm / freq;

  let price = 0;
  let details = [];

  for (let i = 1; i <= numPeriods; i++) {
    const pvCoupon = couponPayment / Math.pow(1 + periodRate, i);
    price += pvCoupon;
    if (i === numPeriods) {
      const pvFace = face / Math.pow(1 + periodRate, i);
      price += pvFace;
    }
    details.push(`Period ${i}: Coupon PV $${pvCoupon.toFixed(2)}${i === numPeriods ? ` + Face $${pvFace.toFixed(2)}` : ''}`);
  }

  const results = document.getElementById('bondResults');
  results.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = 'Pricing Results';
  results.appendChild(h2);

  const pPrice = document.createElement('p');
  const strongPrice = document.createElement('strong');
  strongPrice.textContent = 'Bond Price:';
  pPrice.appendChild(strongPrice);
  pPrice.appendChild(document.createTextNode(` $${price.toFixed(2)}`));
  results.appendChild(pPrice);

  const detailsElem = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Period-by-period PVs';
  detailsElem.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = details.join('\n');
  detailsElem.appendChild(pre);
  results.appendChild(detailsElem);

  console.table({
    'Bond Price': price.toFixed(2),
    Face,
    'Coupon Rate': (couponRate * 100).toFixed(2) + '%',
    YTM: (ytm * 100).toFixed(2) + '%',
    Years,
    Frequency: freq,
    Periods: numPeriods
  });
}