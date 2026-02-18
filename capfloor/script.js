function cumnorm(x) {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;
  if (x &gt;= 0.0) {
    let t = 1.0 / (1.0 + p * x);
    return (1.0 - c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1));
  } else {
    let t = 1.0 / (1.0 - p * x);
    return (c * Math.exp(-x * x / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1));
  }
}

function calculate() {
  const F = parseFloat(document.getElementById('F').value);
  const K = parseFloat(document.getElementById('K').value);
  const sigma = parseFloat(document.getElementById('sigma').value);
  const T = parseFloat(document.getElementById('T').value);
  const DF = parseFloat(document.getElementById('DF').value);
  const Notional = parseFloat(document.getElementById('Notional').value);
  const tau = parseFloat(document.getElementById('tau').value);

  if (isNaN(F) || isNaN(K) || isNaN(sigma) || isNaN(T) || isNaN(DF) || isNaN(Notional) || isNaN(tau) || T &lt;= 0 || sigma &lt;= 0 || F &lt;= 0 || K &lt;= 0) {
    document.getElementById('result').innerHTML = '&lt;p style="color: red;"&gt;Invalid inputs. Ensure all values are positive numbers, T&gt;0, sigma&gt;0.&lt;/p&gt;';
    return;
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const caplet = DF * (F * cumnorm(d1) - K * cumnorm(d2)) * Notional * tau;
  const floorlet = DF * (K * cumnorm(-d2) - F * cumnorm(-d1)) * Notional * tau;

  document.getElementById('result').innerHTML = `
    &lt;p&gt;&lt;strong&gt;Caplet Price: $${caplet.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

&lt;/strong&gt;&lt;/p&gt;
    &lt;p&gt;&lt;strong&gt;Floorlet Price: $${floorlet.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}

&lt;/strong&gt;&lt;/p&gt;
  `;
}