let eeChartInst = null;
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

function computeLVA() {
  const notional = parseFloat(document.getElementById('notional').value) || 100000000;
  const tenor = parseFloat(document.getElementById('tenor').value) || 5;
  const sigma_pct = parseFloat(document.getElementById('vol').value) || 20;
  const mu_pct = parseFloat(document.getElementById('drift').value) || 0;
  const funding_spread_pct = parseFloat(document.getElementById('fundingSpread').value) || 0.20;
  const disc_rate_pct = parseFloat(document.getElementById('discrate').value) || 3.0;
  const liq_horizon_days = parseFloat(document.getElementById('liqHorizon').value) || 10;
  const liq_spread_pct = parseFloat(document.getElementById('liqSpread').value) || 0.50;
  let nsims = parseInt(document.getElementById('nsims').value) || 5000;
  const sigma = sigma_pct / 100;
  const mu = mu_pct / 100;
  const funding_spread = funding_spread_pct / 100;
  const liq_spread = liq_spread_pct / 100;
  const r = disc_rate_pct / 100;
  nsims = Math.max(100, Math.min(20000, nsims));
  if (tenor &lt;= 0) {
    document.getElementById('results').innerHTML = '&lt;p style="color:red;"&gt;Invalid tenor.&lt;/p&gt;';
    return;
  }
  const steps_year = 252;
  const dt = 1 / steps_year;
  const num_steps = Math.floor(tenor * steps_year);
  const H_yr = liq_horizon_days / 365.25;
  const H_steps = Math.floor(H_yr * steps_year);
  const times = Array.from({ length: num_steps + 1 }, (_, i) => i * dt );
  console.log(`Simming ${nsims} paths, ${num_steps} steps, H=${liq_horizon_days}d (${H_steps} steps)...`);
  let all_ee_paths = [];
  for (let sim = 0; sim &lt; nsims; sim++) {
    let X = 1.0;
    let ee_path = new Array(num_steps + 1);
    ee_path[0] = 0;
    for (let step = 1; step &lt;= num_steps; step++) {
      const Z = normalRandom();
      const drift_term = (mu - 0.5 * sigma * sigma) * dt;
      const diffu = sigma * Math.sqrt(dt) * Z;
      X *= Math.exp(drift_term + diffu);
      const mtm = notional * (X - 1.0);
      ee_path[step] = Math.max(0, mtm);
    }
    all_ee_paths.push(ee_path);
  }
    console.log('LVA paths', all_ee_paths.length);
  let mean_ee_curve = new Array(num_steps + 1).fill(0);
  let final_ee_raw = [];
  for (let t = 0; t &lt;= num_steps; t++) {
    let slice = all_ee_paths.map(path => path[t]);
    mean_ee_curve[t] = slice.reduce((sum, val) => sum + val, 0) / nsims;
    if (t === num_steps) final_ee_raw = slice;
  }
  const df_curve = times.map(t => Math.exp(-r * t));
  // FVA full
  let integrand_fva_curve = new Array(num_steps + 1).fill(0);
  let cumulative_fva_curve = new Array(num_steps + 1).fill(0);
  for (let t = 1; t &lt;= num_steps; t++) {
    const integrand_t = mean_ee_curve[t] * funding_spread * df_curve[t];
    integrand_fva_curve[t] = integrand_t;
    const prev_integrand = integrand_fva_curve[t-1];
    cumulative_fva_curve[t] = cumulative_fva_curve[t-1] + (prev_integrand + integrand_t) / 2 * dt;
  }
  // LVA cutoff H
  let integrand_lva_curve = new Array(num_steps + 1).fill(0);
  let cumulative_lva_curve = new Array(num_steps + 1).fill(0);
  for (let t = 1; t &lt;= num_steps; t++) {
    const integrand_t = (t &lt;= H_steps) ? mean_ee_curve[t] * liq_spread * df_curve[t] : 0;
    integrand_lva_curve[t] = integrand_t;
    const prev_integrand = integrand_lva_curve[t-1];
    cumulative_lva_curve[t] = cumulative_lva_curve[t-1] + (prev_integrand + integrand_t) / 2 * dt;
  }
  const total_fva_raw = cumulative_fva_curve[num_steps];
  const total_lva_raw = cumulative_lva_curve[num_steps];
  const total_fva_m = (total_fva_raw / 1e6).toFixed(1);
  const total_lva_m = (total_lva_raw / 1e6).toFixed(1);
  const mean_ee_m = mean_ee_curve.map(v => v / 1e6);
  const integrand_lva_m = integrand_lva_curve.map(v => v / 1e6);
  const cum_fva_m = cumulative_fva_curve.map(v => v / 1e6);
  const cum_lva_m = cumulative_lva_curve.map(v => v / 1e6);
  const max_ee_m = Math.max(...mean_ee_m).toFixed(1);
  const final_avg_ee_m = mean_ee_m[num_steps].toFixed(1);
  // Table
  let tableHTML = '&lt;table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.95rem;"&gt;&lt;thead&gt;&lt;tr&gt;&lt;th style="background:#ed8936;color:white;padding:0.75rem;border-radius:6px 0 0 0;"&gt;Tenor (Y)&lt;/th&gt;&lt;th style="background:#ed8936;color:white;padding:0.75rem;"&gt;FVA | Funding Valuation Adjustment ($M)&lt;/th&gt;&lt;th style="background:#9f7aea;color:white;padding:0.75rem;border-radius:0 6px 0 0;"&gt;LVA | Liquidity Funding Adj (horizon ' + liq_horizon_days + 'd) ($M)&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;&lt;tbody&gt;';
  const key_tenors = [0.25, 0.5, 1, 2, 3, 4, tenor];
  key_tenors.forEach(ky =&gt; {
    const step = Math.floor(ky * steps_year);
    const s = Math.min(num_steps, step);
    const fva_val = cum_fva_m[s].toFixed(1);
    const h_s_ky = Math.min(s, H_steps);
    const lva_val = cum_lva_m[h_s_ky].toFixed(1);
    tableHTML += `&lt;tr&gt;&lt;td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;"&gt;${ky.toFixed(2)}&lt;/td&gt;&lt;td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;"&gt;${fva_val}&lt;/td&gt;&lt;td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;"&gt;${lva_val}&lt;/td&gt;&lt;/tr&gt;`;
  });
  tableHTML += '&lt;/tbody&gt;&lt;/table&gt;';
  const results = document.getElementById('results');
  results.innerHTML = `
    &lt;h2&gt;MC Results (${nsims.toLocaleString()} paths)&lt;/h2&gt;
    &lt;div&gt;
      &lt;p&gt;&lt;strong&gt;Total FVA:&lt;/strong&gt; ${total_fva_m}M | &lt;strong&gt;Total LVA:&lt;/strong&gt; ${total_lva_m}M (H=${liq_horizon_days}d / ${H_yr.toFixed(3)}yr)&lt;/p&gt;
      &lt;p&gt;&lt;strong&gt;Max Avg EE:&lt;/strong&gt; ${max_ee_m}M&lt;/p&gt;
      &lt;p&gt;&lt;strong&gt;Final Avg EE:&lt;/strong&gt; ${final_avg_ee_m}M&lt;/p&gt;
    &lt;/div&gt;
    &lt;div style="position:relative;height:350px;margin:1rem 0;"&gt;
      &lt;canvas id="eeChart"&gt;&lt;/canvas&gt;
    &lt;/div&gt;
    &lt;div style="position:relative;height:350px;margin:1rem 0;"&gt;
      &lt;canvas id="integrandChart"&gt;&lt;/canvas&gt;
    &lt;/div&gt;
    &lt;div style="position:relative;height:350px;margin:1rem 0;"&gt;
      &lt;canvas id="cumChart"&gt;&lt;/canvas&gt;
    &lt;/div&gt;
    &lt;h3&gt;FVA/LVA by Tenor&lt;/h3&gt;
    &lt;div id="lvaTable"&gt;${tableHTML}&lt;/div&gt;
    &lt;details&gt;
      &lt;summary&gt;Model Notes&lt;/summary&gt;
      &lt;p&gt;Uncollateralized &lt;strong&gt;EE(t)&lt;/strong&gt; = E[&lt;span style="color:blue"&gt;max(Notional × (GBM(t)-1), 0)&lt;/span&gt;].&lt;br&gt;
      &lt;strong&gt;FVA(T)&lt;/strong&gt; = ∫&lt;sub&gt;0&lt;/sub&gt;&lt;sup&gt;T&lt;/sup&gt; EE(t) × &lt;span style="color:orange"&gt;funding spread&lt;/span&gt; × &lt;span style="color:green"&gt;DF(t)&lt;/span&gt; dt (trapezoidal).&lt;br&gt;
      &lt;strong&gt;LVA(T)&lt;/strong&gt; = ∫&lt;sub&gt;0&lt;/sub&gt;&lt;sup&gt;min(T,H)&lt;/sup&gt; EE(t) × &lt;span style="color:purple"&gt;liq spread&lt;/span&gt; × DF(t) dt.&lt;br&gt;
      DF(t)=exp(-r t). H=${liq_horizon_days}d ≈ ${H_yr.toFixed(3)}yr. Daily steps (252/yr).&lt;/p&gt;
      &lt;p&gt;&lt;strong&gt;XVA Family:&lt;/strong&gt; All ∫ EE(t) × cost(t) × surv(t) dt&lt;br&gt;
      • &lt;strong&gt;CVA:&lt;/strong&gt; cost=λ&lt;sub&gt;CP&lt;/sub&gt;(1-R&lt;sub&gt;CP&lt;/sub&gt;), surv=CP survival&lt;br&gt;
      • &lt;strong&gt;DVA:&lt;/strong&gt; cost=-λ&lt;sub&gt;own&lt;/sub&gt;(1-R&lt;sub&gt;own&lt;/sub&gt;), surv=own survival&lt;br&gt;
      • &lt;strong&gt;FVA:&lt;/strong&gt; cost=funding spread, surv=1 (no default)&lt;br&gt;
      • &lt;strong&gt;LVA:&lt;/strong&gt; cost=liq spread, surv=1, cutoff H&lt;/p&gt;
    &lt;/details&gt;
  `;
  // Charts
  const eeCtx = document.getElementById('eeChart')?.getContext('2d');
  if (eeChartInst) eeChartInst.destroy();
  eeChartInst = new Chart(eeCtx, {
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
  const integrandCtx = document.getElementById('integrandChart')?.getContext('2d');
  if (integrandChartInst) integrandChartInst.destroy();
  integrandChartInst = new Chart(integrandCtx, {
    type: 'line',
    data: {
      labels: times.map(t => t.toFixed(2)),
      datasets: [{
        label: 'LVA Integrand(t)',
        data: integrand_lva_m,
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
      datasets: [{
        label: 'Full FVA(t)',
        data: cum_fva_m,
        borderColor: '#ed8936',
        backgroundColor: 'rgba(237, 137, 54, 0.1)',
        borderWidth: 4,
        fill: false,
        tension: 0.3,
        pointRadius: 0
      }, {
        label: `LVA(t) cutoff H=${liq_horizon_days}d`,
        data: cum_lva_m,
        borderColor: '#9f7aea',
        backgroundColor: 'rgba(159, 122, 234, 0.2)',
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
        y: { title: { display: true, text: 'Cum FVA/LVA ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  console.log('LVA Demo: FVA', total_fva_m, 'LVA', total_lva_m, 'H_steps', H_steps);
}

window.addEventListener('load', () => {
  const debouncedCalc = debounce(computeLVA, 500);
  document.querySelectorAll('#lvaForm input').forEach(input => {
    input.addEventListener('input', debouncedCalc);
  });
  setTimeout(computeLVA, 200);
});