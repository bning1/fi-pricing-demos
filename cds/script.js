document.addEventListener('DOMContentLoaded', function() {
  const inputs = document.querySelectorAll('#cdsForm input');
  inputs.forEach(input =&gt; {
    input.addEventListener('input', cdsPrice);
  });
  cdsPrice(); // initial calc
});

let chartSurvival = null;
let chartLegs = null;

function cdsPrice() {
  const notional = parseFloat(document.getElementById('notional').value) || 0;
  const tenor = parseFloat(document.getElementById('tenor').value) || 0;
  const paymentFreq = parseFloat(document.getElementById('paymentFreq').value) || 4;
  const spread = parseFloat(document.getElementById('spread').value) || 0;
  const recovery = parseFloat(document.getElementById('recovery').value) || 0;
  const riskFree = parseFloat(document.getElementById('riskFree').value) / 100 || 0;
  const hazard = parseFloat(document.getElementById('hazard').value) / 100 || 0;
  const numPeriods = parseInt(document.getElementById('numPeriods').value) || 100;

  if (tenor &lt;= 0 || notional &lt;= 0 || numPeriods &lt; 10) {
    document.getElementById('cdsResults').innerHTML = '&lt;p style=&quot;color: #e53e3e;&quot;&gt;Please enter valid inputs.&lt;/p&gt;';
    return;
  }

  const spread_frac = spread / 10000;
  const delta_t_pay = 1 / paymentFreq;
  let premium_pv = 0;
  let num_pays = Math.floor(tenor / delta_t_pay);

  // Premium payments
  for (let k = 1; k &lt;= num_pays; k++) {
    let tp = k * delta_t_pay;
    let accrual = delta_t_pay;
    if (tp &gt; tenor) {
      accrual = tenor - (k - 1) * delta_t_pay;
      tp = tenor;
    }
    let disc = Math.exp(-riskFree * tp);
    let Q = Math.exp(-hazard * tp);
    premium_pv += disc * Q * spread_frac * accrual * notional;
    if (tp &gt;= tenor) break;
  }

  // Default leg - fine grid
  const delta_t = tenor / numPeriods;
  let default_pv = 0;
  for (let k = 1; k &lt;= numPeriods; k++) {
    let t = Math.min(k * delta_t, tenor);
    let t_prev = (k - 1) * delta_t;
    let disc = Math.exp(-riskFree * t);
    let Q_prev = Math.exp(-hazard * t_prev);
    let contrib = Q_prev * (1 - recovery) * delta_t;
    default_pv += disc * contrib * notional;
    if (t &gt;= tenor) break;
  }

  const npv = default_pv - premium_pv;
  const par_spread_approx = hazard * (1 - recovery) * 10000;

  // Results HTML
  let html = `
    &lt;h2&gt;Pricing Results&lt;/h2&gt;
    &lt;div class=&quot;npv-display&quot;&gt;Buyer Protection NPV: &lt;strong&gt;$${npv.toLocaleString('en-US', {maximumFractionDigits: 0})}&lt;/strong&gt;&lt;/div&gt;
    &lt;div class=&quot;leg-pv&quot;&gt;
      &lt;div class=&quot;leg-item&quot;&gt;
        &lt;strong&gt;Default Leg PV&lt;/strong&gt;&lt;br&gt;
        $${default_pv.toLocaleString('en-US', {maximumFractionDigits: 0})}
      &lt;/div&gt;
      &lt;div class=&quot;leg-item&quot;&gt;
        &lt;strong&gt;Premium Leg PV&lt;/strong&gt;&lt;br&gt;
        $${premium_pv.toLocaleString('en-US', {maximumFractionDigits: 0})}
      &lt;/div&gt;
      &lt;div class=&quot;leg-item&quot;&gt;
        &lt;strong&gt;Approx Par Spread&lt;/strong&gt;&lt;br&gt;
        ${par_spread_approx.toFixed(0)} bps
      &lt;/div&gt;
    &lt;/div&gt;
    &lt;h3&gt;Survival Curve&lt;/h3&gt;
    &lt;canvas id=&quot;survivalChart&quot;&gt;&lt;/canvas&gt;
    &lt;h3&gt;Legs PV&lt;/h3&gt;
    &lt;canvas id=&quot;legsChart&quot;&gt;&lt;/canvas&gt;
  `;

  document.getElementById('cdsResults').innerHTML = html;

  // Fine grid for chart
  const fine_steps = 200;
  const dt_fine = tenor / fine_steps;
  const labels = [];
  const survival_data = [];
  for (let i = 0; i &lt;= fine_steps; i++) {
    let t = i * dt_fine;
    labels.push(t.toFixed(1));
    survival_data.push(Math.exp(-hazard * t) * 100);
  }

  // Survival chart
  const survivalCtx = document.getElementById('survivalChart').getContext('2d');
  if (chartSurvival) {
    chartSurvival.destroy();
  }
  chartSurvival = new Chart(survivalCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Survival Probability (%)',
        data: survival_data,
        borderColor: '#4299e1',
        backgroundColor: 'rgba(66, 153, 225, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });

  // Legs bar chart
  const legsCtx = document.getElementById('legsChart').getContext('2d');
  if (chartLegs) {
    chartLegs.destroy();
  }
  chartLegs = new Chart(legsCtx, {
    type: 'bar',
    data: {
      labels: ['Default Leg PV', 'Premium Leg PV'],
      datasets: [{
        data: [default_pv, premium_pv],
        backgroundColor: ['#48bb78', '#ed8936'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'PV ($)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}