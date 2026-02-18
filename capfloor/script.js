// Black76 Normal CDF approximation (Abramowitz & Stegun)
function normcdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-0.5 * x * x);
  let prob = d * t * (0.31938153 - t * (0.356563782 + t * (1.781477937 - t * (1.821255978 - t * 1.330274429))));
  if (x &gt; 0) {
    prob = 1 - prob;
  }
  return prob;
}

// Black76 Call price
function black76Call(F, K, sigma, T) {
  if (T &lt;= 0) return Math.max(F - K, 0);
  const sigsqrtT = sigma * Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sigsqrtT * sigsqrtT) / sigsqrtT;
  const d2 = d1 - sigsqrtT;
  return F * normcdf(d1) - K * normcdf(d2);
}

// Black76 Put price
function black76Put(F, K, sigma, T) {
  if (T &lt;= 0) return Math.max(K - F, 0);
  const sigsqrtT = sigma * Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sigsqrtT * sigsqrtT) / sigsqrtT;
  const d2 = d1 - sigsqrtT;
  return K * normcdf(-d2) - F * normcdf(-d1);
}

function compute() {
  const N = parseFloat(document.getElementById('notional').value) || 0;
  const Kp = parseFloat(document.getElementById('strike').value);
  const Fp = parseFloat(document.getElementById('forward').value);
  const sigmap = parseFloat(document.getElementById('vol').value);
  const T = parseFloat(document.getElementById('T').value);
  const tau = parseFloat(document.getElementById('tau').value);
  const df = parseFloat(document.getElementById('df').value);

  const K = Kp / 100;
  const F = Fp / 100;
  const sigma = sigmap / 100;

  const sigsqrtT = sigma * Math.sqrt(T);
  const d1 = sigsqrtT &gt; 0 ? (Math.log(F / K) + 0.5 * sigsqrtT * sigsqrtT) / sigsqrtT : 0;
  const d2 = d1 - sigsqrtT;

  const Nd1 = normcdf(d1);
  const Nd2 = normcdf(d2);

  const capletUndisc = black76Call(F, K, sigma, T);
  const floorletUndisc = black76Put(F, K, sigma, T);
  const caplet = N * tau * df * capletUndisc;
  const floorlet = N * tau * df * floorletUndisc;

  document.getElementById('caplet').textContent = '$' + caplet.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2});
  document.getElementById('floorlet').textContent = '$' + floorlet.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2});
  document.getElementById('d1').textContent = d1.toFixed(4);
  document.getElementById('d2').textContent = d2.toFixed(4);
  document.getElementById('Nd1').textContent = Nd1.toFixed(4);
  document.getElementById('Nd2').textContent = Nd2.toFixed(4);
}

// Update value displays and compute
function updateSlider(sliderId, valId) {
  const slider = document.getElementById(sliderId);
  const valSpan = document.getElementById(valId);
  slider.addEventListener('input', function() {
    const val = parseFloat(this.value);
    if (valId === 'strikeVal') {
      valSpan.textContent = val.toFixed(2);
    } else if (valId === 'forwardVal' || valId === 'volVal') {
      valSpan.textContent = val.toFixed(1);
    } else if (valId === 'tauVal' || valId === 'dfVal') {
      valSpan.textContent = val.toFixed(2);
    } else {
      valSpan.textContent = val.toFixed(2);
    }
    compute();
  });
}

// Init
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('notional').addEventListener('input', compute);
  updateSlider('strike', 'strikeVal');
  updateSlider('forward', 'forwardVal');
  updateSlider('vol', 'volVal');
  updateSlider('T', 'TVal');
  updateSlider('tau', 'tauVal');
  updateSlider('df', 'dfVal');
  compute();
});