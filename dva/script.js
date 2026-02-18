let exposureChartInst = null;
let pathsChartInst = null;
let histChartInst = null;
let integrandChartInst = null;
let cumXvaChartInst = null;

function normalRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function getColor(i) {
  const hue = (i / 100) * 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function makeHistogram(data, numBins = 30) {
  if (data.length === 0) return { labels: [], data: [] };
  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  if (maxV === minV) return { labels: ['All'], data: [data.length] };
  const binSize = (maxV - minV) / numBins;
  const bins = new Array(numBins).fill(0);
  data.forEach(v => {
    let idx = Math.floor((v - minV) / binSize);
    idx = Math.min(numBins - 1, idx);
    bins[idx]++;
  });
  const labels = bins.map((_, i) => {
    const low = minV + i * binSize;
    const high = minV + (i + 1) * binSize;
    return `${low.toFixed(1)}M .. ${high.toFixed(1)}M`;
  });
  return { labels, data: bins };
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function calculateDVA() {
  const notional = parseFloat(document.getElementById('notional').value) || 100000000;
  const tenor = parseFloat(document.getElementById('tenor').value) || 5;
  const sigma_pct = parseFloat(document.getElementById('vol').value) || 20;
  const mu_pct = parseFloat(document.getElementById('drift').value) || 0;
  let nsims = parseInt(document.getElementById('nsims').value) || 5000;
  const conf_pct = parseFloat(document.getElementById('conf').value) || 95;
  const cp_recovery_pct = parseFloat(document.getElementById('cp_recovery').value) || 40;
  const cp_hazard_pct = parseFloat(document.getElementById('cp_hazard').value) || 1;
  const own_recovery_pct = parseFloat(document.getElementById('own_recovery').value) || 30;
  const own_hazard_pct = parseFloat(document.getElementById('own_hazard').value) || 2;
  const disc_r_pct = parseFloat(document.getElementById('disc_r').value) || 3;
  const sigma = sigma_pct / 100;
  const mu = mu_pct / 100;
  const conf_level = conf_pct / 100;
  const cp_recovery = cp_recovery_pct / 100;
  const cp_lambda = cp_hazard_pct / 100;
  const own_recovery = own_recovery_pct / 100;
  const own_lambda = own_hazard_pct / 100;
  const disc_r = disc_r_pct / 100;
  nsims = Math.max(100, Math.min(20000, nsims));
  if (tenor <= 0) {
    document.getElementById('results').innerHTML = '<p style="color:red;">Invalid tenor.</p>';
    return;
  }
  const steps_year = 252;
  const dt = 1 / steps_year;
  const num_steps = Math.floor(tenor * steps_year);
  const times = Array.from({ length: num_steps + 1 }, (_, i) => (i * dt).toFixed(2));
  console.log(`Simming ${nsims} paths, ${num_steps} steps for bilateral DVA...`);
  let all_cp_ee_paths = [];
  let all_own_ee_paths = [];
  const num_viz = Math.min(100, nsims);
  for (let sim = 0; sim < nsims; sim++) {
    let X = 1.0;
    let ee_cp_path = new Array(num_steps + 1).fill(0);
    let ee_own_path = new Array(num_steps + 1).fill(0);
    for (let step = 1; step <= num_steps; step++) {
      const Z = normalRandom();
      const drift_term = (mu - 0.5 * sigma * sigma) * dt;
      const diffu = sigma * Math.sqrt(dt) * Z;
      X *= Math.exp(drift_term + diffu);
      const mtm = notional * (X - 1.0);
      ee_cp_path[step] = Math.max(0, mtm);
      ee_own_path[step] = Math.max(0, -mtm);
    }
    all_cp_ee_paths.push(ee_cp_path);
    all_own_ee_paths.push(ee_own_path);
  }
  let ee_cp_curve = new Array(num_steps + 1).fill(0);
  let pfe_cp_curve = new Array(num_steps + 1).fill(0);
  let ee_own_curve = new Array(num_steps + 1).fill(0);
  let pfe_own_curve = new Array(num_steps + 1).fill(0);
  let final_ee_raw_own = [];
  for (let t = 0; t <= num_steps; t++) {
    const cp_slice = all_cp_ee_paths.map(path => path[t]);
    const own_slice = all_own_ee_paths.map(path => path[t]);
    ee_cp_curve[t] = cp_slice.reduce((a, b) => a + b, 0) / nsims;
    ee_own_curve[t] = own_slice.reduce((a, b) => a + b, 0) / nsims;
    const sorted_cp = [...cp_slice].sort((a, b) => a - b);
    pfe_cp_curve[t] = sorted_cp[Math.floor(conf_level * (nsims - 1))];
    const sorted_own = [...own_slice].sort((a, b) => a - b);
    pfe_own_curve[t] = sorted_own[Math.floor(conf_level * (nsims - 1))];
    if (t === num_steps) final_ee_raw_own = own_slice;
  }
  let cva_total = 0;
  let dva_total = 0;
  let net_total = 0;
  let integrand_dva_curve = new Array(num_steps + 1).fill(0);
  let cum_cva_curve = new Array(num_steps + 1).fill(0);
  let cum_dva_curve = new Array(num_steps + 1).fill(0);
  let cum_net_curve = new Array(num_steps + 1).fill(0);
  for (let step = 1; step <= num_steps; step++) {
    const t = step * dt;
    const df = Math.exp(-disc_r * t);
    const delta_cva = pfe_cp_curve[step] * cp_lambda * (1 - cp_recovery) * df * dt;
    const delta_dva = pfe_own_curve[step] * own_lambda * (1 - own_recovery) * df * dt;
    cva_total += delta_cva;
    dva_total += delta_dva;
    net_total += -delta_cva + delta_dva;
    integrand_dva_curve[step] = -delta_dva;
    cum_cva_curve[step] = cva_total;
    cum_dva_curve[step] = dva_total;
    cum_net_curve[step] = net_total;
  }
  const ee_own_curve_m = ee_own_curve.map(v => v / 1e6);
  const pfe_own_curve_m = pfe_own_curve.map(v => v / 1e6);
  const integrand_dva_m = integrand_dva_curve.map(v => v / 1e6);
  const cum_net_m = cum_net_curve.map(v => v / 1e6);
  const final_ee_own_m = final_ee_raw_own.map(ee => ee / 1e6);
  const max_pfe_own_m = Math.max(...pfe_own_curve_m).toFixed(1);
  const final_pfe_own_m = pfe_own_curve_m[num_steps].toFixed(1);
  const cva_m = (cva_total / 1e6).toFixed(1);
  const dva_m = (dva_total / 1e6).toFixed(1);
  const net_m = (net_total / 1e6).toFixed(1);
  const viz_paths_data = [];
  for (let sim = 0; sim < num_viz; sim++) {
    const ee_path_m = all_own_ee_paths[sim].map(ee => ee / 1e6);
    viz_paths_data.push({
      label: `Own Path ${sim + 1}`,
      data: ee_path_m
    });
  }
  const histData = makeHistogram(final_ee_own_m);
  // Own PFE Table
  let pfeTableHTML = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.95rem;"><thead><tr><th style="background:#4299e1;color:white;padding:0.75rem;border-radius:6px 0 0 0;">Tenor (Y)</th><th style="background:#4299e1;color:white;padding:0.75rem;border-radius:0 6px 0 0;">PFE Own ($M)</th></tr></thead><tbody>';
  const key_tenors = [0.25, 0.5, 1, 2, 3, 4, tenor];
  key_tenors.forEach(ky => {
    const step = Math.round(ky / dt);
    const s = Math.max(0, Math.min(num_steps, step));
    const pfe_val = pfe_own_curve_m[s].toFixed(1);
    pfeTableHTML += `<tr><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${ky.toFixed(2)}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${pfe_val}</td></tr>`;
  });
  pfeTableHTML += '</tbody></table>';
  // XVA Table
  let xvaTableHTML = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.9rem;"><thead><tr><th style="background:#ed8936;color:white;padding:0.6rem;border-radius:6px 0 0 0;">Slice (Y)</th><th style="background:#ed8936;color:white;padding:0.6rem;">ΔCVA ($M)</th><th style="background:#ed8936;color:white;padding:0.6rem;">ΔDVA ($M)</th><th style="background:#ed8936;color:white;padding:0.6rem;">ΔNet ($M)</th><th style="background:#ed8936;color:white;padding:0.6rem;">Cum CVA</th><th style="background:#ed8936;color:white;padding:0.6rem;">Cum DVA</th><th style="background:#ed8936;color:white;padding:0.6rem;border-radius:0 6px 0 0;">Cum Net</th></tr></thead><tbody>';
  let prev_cum_cva = 0;
  let prev_cum_dva = 0;
  let prev_cum_net = 0;
  key_tenors.forEach((ky, i) => {
    const step = Math.round(ky / dt);
    const s = Math.max(0, Math.min(num_steps, step));
    const slice_cva = cum_cva_curve[s] - prev_cum_cva;
    const slice_dva = cum_dva_curve[s] - prev_cum_dva;
    const slice_net = cum_net_curve[s] - prev_cum_net;
    const slice_cva_m = (slice_cva / 1e6).toFixed(1);
    const slice_dva_m = (slice_dva / 1e6).toFixed(1);
    const slice_net_m = (slice_net / 1e6).toFixed(1);
    const cum_cva_m = (cum_cva_curve[s] / 1e6).toFixed(1);
    const cum_dva_m = (cum_dva_curve[s] / 1e6).toFixed(1);
    const cum_net_m = (cum_net_curve[s] / 1e6).toFixed(1);
    const slice_label = i === 0 ? `0 → ${ky.toFixed(2)}` : `${key_tenors[i-1].toFixed(2)} → ${ky.toFixed(2)}`;
    xvaTableHTML += `<tr><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${slice_label}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${slice_cva_m}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${slice_dva_m}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${slice_net_m}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${cum_cva_m}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${cum_dva_m}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:700;color:#48bb78;">${cum_net_m}</td></tr>`;
    prev_cum_cva = cum_cva_curve[s];
    prev_cum_dva = cum_dva_curve[s];
    prev_cum_net = cum_net_curve[s];
  });
  xvaTableHTML += '</tbody></table>';
  const results = document.getElementById('results');
  results.innerHTML = `
    <h2>MC Results (${nsims.toLocaleString()} paths, ${conf_pct}% conf)</h2>
    <div>
      <p><strong>Total CVA:</strong> ${cva_m}M <span style="color:#ed8936;">(charge)</span></p>
      <p><strong>Total DVA:</strong> ${dva_m}M <span style="color:#9f7aea;">(benefit)</span></p>
      <p><strong>Net Adj:</strong> <span style="color:#48bb78;font-weight:700;font-size:1.2em;">${net_m}M</span></p>
      <p><strong>Max PFE (own):</strong> ${max_pfe_own_m}M</p>
      <p><strong>Final PFE (own):</strong> ${final_pfe_own_m}M</p>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="exposureChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="pathsChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="histChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="integrandChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1rem 0;">
      <canvas id="cumCvaChart"></canvas>
    </div>
    <h3>Own PFE Profile</h3>
    <div id="pfeTable">${pfeTableHTML}</div>
    <h3>XVA by Tenor Slice (CVA/DVA/Net)</h3>
    <div id="xvaTable">${xvaTableHTML}</div>
    <details>
      <summary>Model Notes</summary>
      <p>GBM X(0)=1, MTM(t)=Notional × (X(t)-1).<br>
      EE_CP(t)=max(0, MTM(t)), EE_own(t)=max(0, -MTM(t)) per path.<br>
      EE(t)=mean(EE(t)), PFE(t)=${conf_pct}% quantile (unilateral).<br>
      CVA/DVA = ∑ PFE × λ × LGD × exp(-r t) × Δt (daily 252/yr).<br>
      Net Adj >0 if own default risk high (higher funding). Drift breaks symmetry.</p>
    </details>
  `;
  // Own Exposure Chart (EE/PFE own)
  const exposureCtx = document.getElementById('exposureChart')?.getContext('2d');
  if (exposureChartInst) exposureChartInst.destroy();
  exposureChartInst = new Chart(exposureCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [
        {
          label: 'EE_own (mean)',
          data: ee_own_curve_m,
          borderColor: '#48bb78',
          backgroundColor: 'rgba(72, 187, 120, 0.2)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: `PFE_own (${conf_pct}%)`,
          data: pfe_own_curve_m,
          borderColor: '#4299e1',
          backgroundColor: 'rgba(66, 153, 225, 0.1)',
          borderWidth: 4,
          fill: false,
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false },
      scales: {
        x: { title: { display: true, text: 'Time (Years)' } },
        y: { title: { display: true, text: 'Own Exposure ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  // Own Paths Chart
  const pathsCtx = document.getElementById('pathsChart')?.getContext('2d');
  if (pathsChartInst) pathsChartInst.destroy();
  pathsChartInst = new Chart(pathsCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: viz_paths_data.map((p, i) => ({
        label: p.label,
        data: p.data,
        borderColor: getColor(i),
        backgroundColor: getColor(i) + '20',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.2,
        fill: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Time (Years)' } },
        y: { title: { display: true, text: 'Own EE ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: num_viz < 20 } }
    }
  });
  // Own Hist Chart
  const histCtx = document.getElementById('histChart')?.getContext('2d');
  if (histChartInst) histChartInst.destroy();
  histChartInst = new Chart(histCtx, {
    type: 'bar',
    data: {
      labels: histData.labels,
      datasets: [{
        label: 'Final Own EE Histogram',
        data: histData.data,
        backgroundColor: 'rgba(66, 153, 225, 0.7)',
        borderColor: '#4299e1',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Final Own EE ($ Millions)' } },
        y: { title: { display: true, text: 'Count' }, beginAtZero: true }
      },
      plugins: { legend: { display: false } }
    }
  });
  // DVA Integrand Chart (negative)
  const integrandCtx = document.getElementById('integrandChart')?.getContext('2d');
  if (integrandChartInst) integrandChartInst.destroy();
  integrandChartInst = new Chart(integrandCtx, {
    type: 'line',
    data: {
      labels: times.slice(1),
      datasets: [{
        label: 'DVA Integrand (negative)',
        data: integrand_dva_m.slice(1),
        borderColor: '#9f7aea',
        backgroundColor: 'rgba(159, 122, 234, 0.2)',
        borderWidth: 3,
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
        y: { title: { display: true, text: 'ΔDVA / day ($M)' } }
      },
      plugins: { legend: { display: true } }
    }
  });
  // Net Cum XVA Chart
  const cumXvaCtx = document.getElementById('cumCvaChart')?.getContext('2d');
  if (cumXvaChartInst) cumXvaChartInst.destroy();
  cumXvaChartInst = new Chart(cumXvaCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [{
        label: 'Net CVA - DVA (Cum)',
        data: cum_net_m,
        borderColor: '#48bb78',
        backgroundColor: 'rgba(72, 187, 120, 0.3)',
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
        y: { title: { display: true, text: 'Net Adjustment ($ Millions)' }, min: Math.min(0, Math.min(...cum_net_m)) }
      },
      plugins: { legend: { display: true } }
    }
  });
  console.log('DVA Demo: CVA', cva_m, 'DVA', dva_m, 'Net', net_m);
}

window.addEventListener('load', () => {
  const debouncedCalc = debounce(calculateDVA, 500);
  document.querySelectorAll('#dvaForm input').forEach(input => {
    input.addEventListener('input', debouncedCalc);
  });
  setTimeout(calculateDVA, 200);
});