function computeBond() {
  const faceValue = parseFloat(document.getElementById('faceValue').value) || 1000;
  const couponRatePct = parseFloat(document.getElementById('couponRate').value) || 4.0;
  const ytmPct = parseFloat(document.getElementById('ytm').value) || 3.5;
  const yearsToMaturity = parseFloat(document.getElementById('years').value) || 10;
  const paymentsPerYear = parseInt(document.getElementById('frequency').value) || 2;
  
  const couponRate = couponRatePct / 100;
  const ytm = ytmPct / 100;
  const couponPayment = faceValue * couponRate / paymentsPerYear;
  const numPeriods = yearsToMaturity * paymentsPerYear;
  const discountRatePerPeriod = ytm / paymentsPerYear;
  
  console.log('Bond Calculation Inputs:', {
    faceValue,
    couponRatePct,
    ytmPct,
    yearsToMaturity,
    paymentsPerYear,
    couponPayment: couponPayment.toFixed(2),
    numPeriods,
    discountRatePerPeriod: (discountRatePerPeriod * 100).toFixed(4) + '%'
  });
  
  let bondPrice = 0;
  // PV of coupons
  for (let period = 1; period <= numPeriods; period++) {
    bondPrice += couponPayment / Math.pow(1 + discountRatePerPeriod, period);
  }
  // PV of face value
  bondPrice += faceValue / Math.pow(1 + discountRatePerPeriod, numPeriods);
  
  console.log('Bond Price:', bondPrice.toFixed(2));
  
  document.getElementById('bondResults').innerHTML = `
    <div class="results">
      <h2>Bond Price: <span id="price">$${bondPrice.toFixed(2)}</span></h2>
      <p><strong>Coupon Payment:</strong> $${couponPayment.toFixed(2)} per period</p>
      <p><strong>Number of Periods:</strong> ${numPeriods}</p>
      <p><strong>Discount Rate per Period:</strong> ${(discountRatePerPeriod * 100).toFixed(4)}%</p>
    </div>
  `;
}