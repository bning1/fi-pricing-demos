// Black '76 Cap/Floor Pricer (Multi-Caplet)
// Pure JS, client-side. Uses approximation for normCDF.

const DAY_MS = 86400000;

// Approximation for cumulative normal distribution (Abramowitz & Stegun)
function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228 * Math.exp(-x * x / 2);
  let prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

// Black '76 caplet price (forward starting)
function black76Caplet(F, K, vol, T, tau, DF, notional, isCap = true) {
  const sigSqrtT = vol / 100 * Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sigSqrtT * sigSqrtT) / sigSqrtT;
  const d2 = d1 - sigSqrtT;
  const N_d1 = normCdf(d1);
  const N_d2 = normCdf(d2);
  const N_md1 = normCdf(-d1);
  const N_md2 = normCdf(-d2);
  let cleanPrice = DF * tau * notional * (F * (isCap ? N_d1 : N_md1) - K * (isCap ? N_d2 : N_md2));
  return cleanPrice * 10000; // bps
}

// Simple DF approximation (flat curve)
function discountFactor(start, end, libor) {
  const T = (end - start) / DAY_MS / 365.25;
  return Math.exp(-libor / 100 * T);
}

// Generate periods
function generatePeriods(startDate, endDate, freqMonths, lagDays) {
  const periods = [];
  let current = new Date(startDate);
  current.setDate(current.getDate() + lagDays);
  const final = new Date(endDate);
  while (current < final) {
    const periodEnd = new Date(current);
    periodEnd.setMonth(periodEnd.getMonth() + freqMonths);
    if (periodEnd > final) periodEnd = final;
    periods.push({ start: current, end: periodEnd });
    current = periodEnd;
  }
  return periods;
}

document.getElementById('pricingForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const notional = parseFloat(formData.get('notional')) || 100;
  const startDate = new Date(formData.get('startDate'));
  const endDate = new Date(formData.get('endDate'));
  const lag = parseInt(formData.get('lag')) || 2;
  const freq = parseInt(formData.get('freq')) || 6;
  const strike = parseFloat(formData.get('strike')) || 5.0;
  const vol = parseFloat(formData.get('vol')) || 20.0;
  const libor = parseFloat(formData.get('libor')) || 4.5;
  const type = formData.get('type') === 'cap';
  const dayCount = formData.get('dayCount') === 'ACT/360' ? 360 : 360; // Simplified

  const periods = generatePeriods(startDate, endDate, freq, lag);
  const caplets = [];
  let totalPrice = 0;

  periods.forEach((p, i) => {
    const T_fix = (p.start - startDate) / DAY_MS / 365.25;
    const tau = (p.end - p.start) / DAY_MS / 365.25;
    const DF = discountFactor(p.start, p.end, libor);
    const F = libor; // Flat forward assumption
    const caplet = black76Caplet(F, strike, vol, T_fix, tau, DF, notional, type);
    caplets.push({
      period: i + 1,
      start: p.start.toISOString().split('T')[0],
      end: p.end.toISOString().split('T')[0],
      df: DF.toFixed(4),
      forward: F.toFixed(2),
      price: caplet.toFixed(2)
    });
    totalPrice += caplet;
  });

  // Table
  const tbody = document.querySelector('#capletTable tbody');
  tbody.innerHTML = caplets.map(c => `<tr><td>${c.period}</td><td>${c.start}</td><td>${c.end}</td><td>${c.df}</td><td>${c.forward}</td><td>$${c.price}</td></tr>`).join('');

  // Total
  document.getElementById('totalPrice').textContent = `Total ${type ? 'Cap' : 'Floor'} Price: $${totalPrice.toFixed(2)} bps`;

  // Chart: Price vs Strike sensitivity (fix other params)
  const ctx = document.getElementById('chart').getContext('2d');
  const strikes = Array.from({length: 20}, (_, i) => 2 + i * 0.5);
  const prices = strikes.map(K => {
    let sum = 0;
    periods.forEach(p => {
      const T_fix = (p.start - startDate) / DAY_MS / 365.25;
      const tau = (p.end - p.start) / DAY_MS / 365.25;
      const DF = discountFactor(p.start, p.end, libor);
      sum += black76Caplet(libor, K, vol, T_fix, tau, DF, notional, type);
    });
    return sum;
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: strikes.map(s => s.toFixed(1)),
      datasets: [{ label: `${type ? 'Cap' : 'Floor'} Price (bps)`, data: prices, borderColor: '#007bff' }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
});
