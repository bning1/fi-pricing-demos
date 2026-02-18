function calculate() {
  const notional = parseFloat(document.getElementById('notional').value);
  const strike = parseFloat(document.getElementById('strike').value) / 100;
  const forward = parseFloat(document.getElementById('forward').value) / 100;
  const vol = parseFloat(document.getElementById('vol').value) / 100;
  const tenor = parseFloat(document.getElementById('tenor').value);
  const isCap = document.getElementById('isCap').checked;

  const T = tenor;
  const sigma = vol * Math.sqrt(T);
  const d1 = (Math.log(forward / strike) + 0.5 * vol * vol * T) / sigma;
  const d2 = d1 - sigma;

  // Normal CDF approximation (Abramowitz and Stegun)
  function normCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    if (x &gt; 0) {
      prob = 1 - prob;
    } else {
      prob = prob;
    }
    return prob;
  }

  let price;
  if (isCap) {
    price = notional * (forward * normCDF(d1) - strike * normCDF(d2)) * T;  // Simplified caplet (df=1, delta=T)
  } else {
    price = notional * (strike * normCDF(-d2) - forward * normCDF(-d1)) * T;  // Simplified floorlet
  }

  document.getElementById('result').innerHTML = `Price: $${price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}