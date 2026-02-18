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

function computeFVA() {
  const notional = parseFloat(document.getElementById('notional').value) || 100000000;
  const tenor = parseFloat(document.getElementById('tenor').value) || 5;
  const sigma_pct = parseFloat(document.getElementById('vol').value) || 20;
  const mu_pct = parseFloat(document.getElementById('drift').value) || 0;
  const funding_spread_pct = parseFloat(document.getElementById('spread').value) || 0.20;
  const disc_rate_pct = parseFloat(document.getElementById('discrate').value) || 3.0;
  let nsims = parseInt(document.getElementById('nsims').value) || 5000;
  const sigma = sigma_pct / 100;
  const mu = mu_pct / 100;
  const spread = funding_spread_pct / 100;
  const r = disc_rate_pct / 100;
  nsims = Math.max(100, Math.min(20000, nsims));
  if (tenor <= 0) {
    document.getElementById('results').innerHTML = '<p style="color:red;">Invalid tenor.</p>';
    return;
  }
  const steps_year = 252;
  const dt = 1 / steps_year;
  const num_steps = Math.floor(tenor * steps_year);
  const times = Array.from({ length: num_steps + 1 }, (_, i) => i * dt );
  console.log(`Simming ${nsims} paths, ${num_steps} steps...`);
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
  console.log('FVA calc', all_ee_paths.length);\nlet mean_ee_curve = new Array(num_steps + 1).fill(0);
  let final_ee_raw = [];
  for (let t = 0; t <= num_steps; t++) {
    let slice = all_ee_paths.map(path => path[t]);
    mean_ee_curve[t] = slice.reduce((sum, val) => sum + val, 0) / nsims;
    if (t === num_steps) final_ee_raw = slice;
  }
  const df_curve = times.map(t => Math.exp(-r * t));
  let integrand_curve = new Array(num_steps + 1).fill(0);
  let cumulative_fva_curve = new Array(num_steps + 1).fill(0);
  for (let t = 1; t <= num_steps; t++) {
    const integrand_t = mean_ee_curve[t] * spread * df_curve[t];
    integrand_curve[t] = integrand_t;
    const prev_integrand = integrand_curve[t-1];
    cumulative_fva_curve[t] = cumulative_fva_curve[t-1] + (prev_integrand + integrand_t) / 2 * dt;
  }
  const total_fva_raw = cumulative_fva_curve[num_steps];
  const total_fva_m = (total_fva_raw / 1e6).toFixed(1);
  const mean_ee_m = mean_ee_curve.map(v => v / 1e6);
  const integrand_m = integrand_curve.map(v => v / 1e6);
  const cum_fva_m = cumulative_fva_curve.map(v => v / 1e6);
  const max_ee_m = Math.max(...mean_ee_m).toFixed(1);
  const final_avg_ee_m = mean_ee_m[num_steps].toFixed(1);
  // Table
  let tableHTML = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.95rem;"><thead><tr><th style="background:#48bb78;color:white;padding:0.75rem;border-radius:6px 0 0 0;">Tenor (Y)</th><th style="background:#48bb78;color:white;padding:0.75rem;border-radius:0 6px 0 0;">FVA | Funding Valuation Adjustment (own funding cost) ($M)</th></tr></thead><tbody>';
  const key_tenors = [0.25, 0.5, 1, 2, 3, 4, tenor];
  key_tenors.forEach(ky => {
    const step = Math.round(ky / dt);
    const s = Math.max(0, Math.min(num_steps, step));
    const fva_val = cum_fva_m[s].toFixed(1);
    tableHTML += `<tr><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${ky.toFixed(2)}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${fva_val}</td></tr>`;
  });
  tableHTML += '</tbody></table>';
  const results = document.getElementById('results');
  results.innerHTML = `
    <h2>MC Results (${nsims.toLocaleString()} paths)</h2>
    <div>
      <p><strong>Total FVA:</strong> ${total_fva_m}M</p>
      <p><strong>Max Avg EE:</strong> ${max_ee_m}M</p>
      <p><strong>Final Avg EE:</strong> ${final_avg_ee_m}M</p>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="pfeChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="pathsChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="histChart"></canvas>
    </div>
    <h3>FVA by Tenor</h3>
    <div id="fvaTable">${tableHTML}</div>
    <details>
      <summary>Model Notes</summary>
      <p>Uncollateralized <strong>EE(t)</strong> = E[<span style="color:blue">max(Notional × (GBM(t)-1), 0)</span>].<br>
      <strong>FVA(T)</strong> = ∫<sub>0</sub><sup>T</sup> EE(t) × <span style="color:orange">spread</span> × <span style="color:green">DF(t)</span> dt (trapezoidal).<br>
      DF(t)=exp(-r t). Daily steps (252/yr).</p>
      <p><strong>XVA Family:</strong> All ∫ EE(t) × cost(t) × surv(t) dt<br>
      • <strong>CVA:</strong> cost=λ<sub>CP</sub>(1-R<sub>CP</sub>), surv=CP survival<br>
      • <strong>DVA:</strong> cost=-λ<sub>own</sub>(1-R<sub>own</sub>), surv=own survival<br>
      • <strong>FVA:</strong> cost=funding spread (LIBOR-OIS?), surv=1 (no default)</p>
    </details>
  `;
  // Charts
  const pfeCtx = document.getElementById('pfeChart')?.getContext('2d');
  if (fvaChartInst) fvaChartInst.destroy();
  fvaChartInst = new Chart(pfeCtx, {
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
        x: { title: { display: true, text: 'Time (Years)' } },
        y: { title: { display: true, text: 'Avg EE ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  const pathsCtx = document.getElementById('pathsChart')?.getContext('2d');
  if (integrandChartInst) integrandChartInst.destroy();
  integrandChartInst = new Chart(pathsCtx, {
    type: 'line',
    data: {
      labels: times.map(t => t.toFixed(2)),
      datasets: [{
        label: 'FVA Integrand(t)',
        data: integrand_m,
        borderColor: '#48bb78',
        backgroundColor: 'rgba(72, 187, 120, 0.2)',
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
        y: { title: { display: true, text: 'Integrand ($M/yr)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  const histCtx = document.getElementById('histChart')?.getContext('2d');
  if (cumChartInst) cumChartInst.destroy();
  cumChartInst = new Chart(histCtx, {
    type: 'line',
    data: {
      labels: times.map(t => t.toFixed(2)),
      datasets: [{
        label: 'Net FVA(t)',
        data: cum_fva_m,
        borderColor: '#ed8936',
        backgroundColor: 'rgba(237, 137, 54, 0.2)',
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
        y: { title: { display: true, text: 'Cum FVA ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  console.log('FVA Demo: Total', total_fva_m, 'Max EE', max_ee_m);
}

window.addEventListener('load', () => {
  const debouncedCalc = debounce(computeFVA, 500);
  document.querySelectorAll('#fvaForm input').forEach(input => {
    input.addEventListener('input', debouncedCalc);
  });
  setTimeout(computeFVA, 200);
});