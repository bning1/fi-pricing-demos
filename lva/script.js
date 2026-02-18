let fvaChartInst = null;
let integrandChartInst = null;
let cumChartInst = null;

function normalRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function calculate() {
  const notional = parseFloat(document.getElementById('notional').value) || 100000000;
  const tenor = parseFloat(document.getElementById('tenor').value) || 5;
  const sigma_pct = parseFloat(document.getElementById('vol').value) || 20;
  const mu_pct = parseFloat(document.getElementById('drift').value) || 0;
  const funding_spread_pct = parseFloat(document.getElementById('funding_spread').value) || 0.20;
  const liq_spread_pct = parseFloat(document.getElementById('liq_spread').value) || 0.50;
  const liq_horizon_days = parseFloat(document.getElementById('liq_horizon').value) || 10;
  const disc_rate_pct = parseFloat(document.getElementById('discrate').value) || 3.0;
  let nsims = parseInt(document.getElementById('nsims').value) || 5000;
  const sigma = sigma_pct / 100;
  const mu = mu_pct / 100;
  const funding_spread = funding_spread_pct / 100;
  const liq_spread = liq_spread_pct / 100;
  const H_years = liq_horizon_days / 365.25;
  const r = disc_rate_pct / 100;
  nsims = Math.max(100, Math.min(20000, nsims));
  if (tenor <= 0) {
    document.getElementById('results').innerHTML = '<p style="color:red;">Invalid tenor.</p>';
    return;
  }
  const steps_year = 252;
  const dt = 1 / steps_year;
  const num_steps = Math.floor(tenor * steps_year);
  const step_H = Math.floor(H_years * steps_year);
  const times = Array.from({ length: num_steps + 1 }, (_, i) => i * dt );
  console.log(`Simming ${nsims} paths, ${num_steps} steps, H=${liq_horizon_days}d (step ${step_H})...`);
  let all_ee_paths = [];
  for (let sim = 0; sim < nsims; sim++) {
    let X = 1.0;
    let ee_path = new Array(num_steps + 1);
    ee_path[0] = 0;
    for (let step = 1; step <= num_steps; step++) {
      const Z = normalRandom();
      const drift_term = (mu - 0.5 * sigma * sigma) * dt;
      const diffu = sigma * Math.sqrt(dt) * Z;
      X *= Math.exp(drift_term + diffu);
      const mtm = notional * (X - 1.0);
      ee_path[step] = Math.max(0, mtm);
    }
    all_ee_paths.push(ee_path);
  }
  let mean_ee_curve = new Array(num_steps + 1).fill(0);
  for (let t = 0; t <= num_steps; t++) {
    let slice = all_ee_paths.map(path => path[t]);
    mean_ee_curve[t] = slice.reduce((sum, val) => sum + val, 0) / nsims;
  }
  const df_curve = times.map(t => Math.exp(-r * t));
  // FVA full
  let fva_integrand_curve = new Array(num_steps + 1).fill(0);
  let fva_cum_curve = new Array(num_steps + 1).fill(0);
  for (let t = 1; t <= num_steps; t++) {
    const integrand_t = mean_ee_curve[t] * funding_spread * df_curve[t];
    fva_integrand_curve[t] = integrand_t;
    fva_cum_curve[t] = fva_cum_curve[t - 1] + (fva_integrand_curve[t - 1] + integrand_t) / 2 * dt;
  }
  // LVA to H
  let lva_integrand_curve = new Array(num_steps + 1).fill(0);
  let lva_cum_curve = new Array(num_steps + 1).fill(0);
  const h_steps = Math.min(step_H, num_steps);
  for (let t = 1; t <= h_steps; t++) {
    const integrand_t = mean_ee_curve[t] * liq_spread * df_curve[t];
    lva_integrand_curve[t] = integrand_t;
    lva_cum_curve[t] = lva_cum_curve[t - 1] + (lva_integrand_curve[t - 1] + integrand_t) / 2 * dt;
  }
  for (let t = h_steps + 1; t <= num_steps; t++) {
    lva_cum_curve[t] = lva_cum_curve[h_steps];
    lva_integrand_curve[t] = 0;
  }
  const total_fva_raw = fva_cum_curve[num_steps];
  const total_lva_raw = lva_cum_curve[num_steps];
  const net_raw = total_fva_raw - total_lva_raw;
  const total_fva_m = (total_fva_raw / 1e6).toFixed(1);
  const total_lva_m = (total_lva_raw / 1e6).toFixed(1);
  const net_m = (net_raw / 1e6).toFixed(1);
  const mean_ee_m = mean_ee_curve.map(v => v / 1e6);
  const fva_integrand_m = fva_integrand_curve.map(v => v / 1e6);
  const lva_integrand_m = lva_integrand_curve.map(v => v / 1e6);
  const fva_cum_m = fva_cum_curve.map(v => v / 1e6);
  const lva_cum_m = lva_cum_curve.map(v => v / 1e6);
  const max_ee_m = Math.max(...mean_ee_m).toFixed(1);
  const final_avg_ee_m = mean_ee_m[num_steps].toFixed(1);
  // Table
  let tableHTML = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.95rem;"><thead><tr><th style="background:#48bb78;color:white;padding:0.75rem;border-radius:6px 0 0 0;">Tenor (Y)</th><th style="background:#ed8936;color:white;padding:0.75rem;">FVA ($M)</th><th style="background:#10b981;color:white;padding:0.75rem;">LVA ($M)</th><th style="background:#f59e0b;color:white;padding:0.75rem;border-radius:0 6px 0 0;">Net (FVA-LVA) ($M)</th></tr></thead><tbody>';
  const key_tenors = [0.25, 0.5, 1, 2, 3, 4, tenor];
  key_tenors.forEach(ky => {
    const step = Math.round(ky * steps_year);
    const s = Math.max(0, Math.min(num_steps, step));
    const fva_val = fva_cum_m[s].toFixed(1);
    const lva_val = lva_cum_m[s].toFixed(1);
    const net_val = (fva_cum_m[s] - lva_cum_m[s]).toFixed(1);
    const net_color = parseFloat(net_val) > 0 ? '#f59e0b' : '#10b981';
    tableHTML += `<tr><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${ky.toFixed(2)}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${fva_val}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${lva_val}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;color:${net_color};">${net_val}</td></tr>`;
  });
  tableHTML += '</tbody></table>';
  const results = document.getElementById('results');
  results.innerHTML = `
    <h2>MC Results (${nsims.toLocaleString()} paths)</h2>
    <div>
      <p><strong>Total FVA:</strong> <span style="color:#ed8936;font-weight:600;">${total_fva_m}M</span></p>
      <p><strong>Total LVA:</strong> <span style="color:#10b981;font-weight:600;">${total_lva_m}M</span></p>
      <p><strong>Net (FVA - LVA):</strong> <span style="color:#f59e0b;font-weight:600;">${net_m}M</span></p>
      <p><strong>Liq Horizon:</strong> ${liq_horizon_days} days (${H_years.toFixed(3)} yrs)</p>
      <p><strong>Max Avg EE:</strong> ${max_ee_m}M</p>
      <p><strong>Final Avg EE:</strong> ${final_avg_ee_m}M</p>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="eeChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="lvaIntegrandChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="cumChart"></canvas>
    </div>
    <h3>FVA / LVA / Net by Tenor Slices</h3>
    <div id="tableDiv">${tableHTML}</div>
    <details>
      <summary>Model Notes</summary>
      <p>Uncollateralized <strong>EE(t)</strong> = E[<span style="color:blue">max(Notional × (GBM(t)-1), 0)</span>].<br>
      <strong>FVA(T)</strong> = ∫<sub>0</sub><sup>T</sup> EE(t) × <span style="color:orange">funding spread</span> × <span style="color:green">DF(t)</span> dt (trapezoidal).<br>
      <strong>LVA(H)</strong> = ∫<sub>0</sub><sup>H</sup> EE(t) × <span style="color:purple">liq premium</span> × DF(t) dt (H = liq stress horizon).<br>
      DF(t)=exp(-r t). Daily steps (252/yr). LVA flat after H.</p>
      <p><strong>XVA Family:</strong> All ∫ EE(t) × cost(t) × surv(t) dt<br>
      • <strong>CVA:</strong> cost=λ<sub>CP</sub>(1-R<sub>CP</sub>), surv=CP survival<br>
      • <strong>DVA:</strong> cost=-λ<sub>own</sub>(1-R<sub>own</sub>), surv=own survival<br>
      • <strong>FVA:</strong> cost=funding spread, surv=1 (collateralized full tenor)<br>
      • <strong>LVA:</strong> cost=liq premium (higher), surv=1 but horizon H (uncollat stress)</p>
    </details>
  `;
  // Charts
  const eeCtx = document.getElementById('eeChart')?.getContext('2d');
  if (fvaChartInst) fvaChartInst.destroy();
  fvaChartInst = new Chart(eeCtx, {
    type: 'line',
    data: {
      labels: times.map(t => t.toFixed(2)),
      datasets: [{
        label: 'Avg EE Profile',
        data: mean_ee_m,
        borderColor: '#4299e1',
        backgroundColor: 'rgba(66, 153, 225, 0.2)',
        borderWidth: 4,
        fill: true,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false },
      scales: {
        x: { title: { display: true, text: 'Time (Years)' }, min: 0, max: Math.max(tenor, H_years + 0.1) },
        y: { title: { display: true, text: 'Avg EE ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  const lvaIntCtx = document.getElementById('lvaIntegrandChart')?.getContext('2d');
  if (integrandChartInst) integrandChartInst.destroy();
  integrandChartInst = new Chart(lvaIntCtx, {
    type: 'line',
    data: {
      labels: times.map(t => t.toFixed(2)),
      datasets: [{
        label: 'LVA Integrand(t)',
        data: lva_integrand_m,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 4,
        fill: true,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Time (Years)' } },
        y: { title: { display: true, text: 'LVA Integrand ($M/yr)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  const cumCtx = document.getElementById('cumChart')?.getContext('2d');
  if (cumChartInst) cumChartInst.destroy();
  cumChartInst = new Chart(cumCtx, {
    type: 'line',
    data: {
      labels: times.map(t => t.toFixed(2)),
      datasets: [
        {
          label: 'Cum FVA (full)',
          data: fva_cum_m,
          borderColor: '#ed8936',
          backgroundColor: 'rgba(237, 137, 54, 0.1)',
          borderWidth: 4,
          fill: false,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: 'Cum LVA (H)',
          data: lva_cum_m,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderWidth: 4,
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Time (Years)' } },
        y: { title: { display: true, text: 'Cum Adj ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  console.log('LVA Demo: FVA', total_fva_m, 'LVA', total_lva_m, 'Net', net_m);
}

window.addEventListener('load', () => {
  const debouncedCalc = debounce(calculate, 500);
  document.querySelectorAll('#lvaForm input').forEach(input => {
    input.addEventListener('input', debouncedCalc);
  });
  setTimeout(calculate, 200);
});