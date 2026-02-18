let exposureChartInst = null;
let pathsChartInst = null;
let histChartInst = null;
let integrandChartInst = null;
let cumCvaChartInst = null;

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

function calculateCVA() {
  const notional = parseFloat(document.getElementById('notional').value) || 100000000;
  const tenor = parseFloat(document.getElementById('tenor').value) || 5;
  const sigma_pct = parseFloat(document.getElementById('vol').value) || 20;
  const mu_pct = parseFloat(document.getElementById('drift').value) || 0;
  let nsims = parseInt(document.getElementById('nsims').value) || 5000;
  const conf_pct = parseFloat(document.getElementById('conf').value) || 95;
  const recovery_pct = parseFloat(document.getElementById('recovery')?.value) || 40;
  const lambda_pct = parseFloat(document.getElementById('hazard')?.value) || 1;
  const disc_r_pct = parseFloat(document.getElementById('disc_r')?.value) || 3;
  const sigma = sigma_pct / 100;
  const mu = mu_pct / 100;
  const conf_level = conf_pct / 100;
  const recovery = recovery_pct / 100;
  const lambda = lambda_pct / 100;
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
  console.log(`Simming ${nsims} paths, ${num_steps} steps for CVA...`);
  let all_ee_paths = [];
  const num_viz = Math.min(100, nsims);
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
  let ee_curve = new Array(num_steps + 1).fill(0);
  let pfe_curve = new Array(num_steps + 1).fill(0);
  let final_ee_raw = [];
  for (let t = 0; t <= num_steps; t++) {
    let slice = all_ee_paths.map(path => path[t]);
    const sum_ee = slice.reduce((a, b) => a + b, 0);
    ee_curve[t] = sum_ee / nsims;
    slice.sort((a, b) => a - b);
    const idx = Math.floor(conf_level * (nsims - 1));
    pfe_curve[t] = slice[idx];
    if (t === num_steps) final_ee_raw = slice;
  }
  let cva_total = 0;
  let integrand_curve = new Array(num_steps + 1).fill(0);
  let cum_cva_curve = new Array(num_steps + 1).fill(0);
  for (let step = 1; step <= num_steps; step++) {
    const t = step * dt;
    const df = Math.exp(-disc_r * t);
    const delta_cva = pfe_curve[step] * lambda * (1 - recovery) * df * dt;
    integrand_curve[step] = delta_cva;
    cva_total += delta_cva;
    cum_cva_curve[step] = cva_total;
  }
  const ee_curve_m = ee_curve.map(v => v / 1e6);
  const pfe_curve_m = pfe_curve.map(v => v / 1e6);
  const integrand_m = integrand_curve.map(v => v / 1e6);
  const cum_cva_m = cum_cva_curve.map(v => v / 1e6);
  const final_ee_m = final_ee_raw.map(ee => ee / 1e6);
  const max_pfe_m = Math.max(...pfe_curve_m).toFixed(1);
  const final_pfe_m = pfe_curve_m[num_steps].toFixed(1);
  const cva_m = (cva_total / 1e6).toFixed(1);
  const viz_paths_data = [];
  for (let sim = 0; sim < num_viz; sim++) {
    const ee_path_m = all_ee_paths[sim].map(ee => ee / 1e6);
    viz_paths_data.push({
      label: `Path ${sim + 1}`,
      data: ee_path_m
    });
  }
  const histData = makeHistogram(final_ee_m);
  // PFE Table
  let pfeTableHTML = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.95rem;"><thead><tr><th style="background:#4299e1;color:white;padding:0.75rem;border-radius:6px 0 0 0;">Tenor (Y)</th><th style="background:#4299e1;color:white;padding:0.75rem;border-radius:0 6px 0 0;">PFE ($M)</th></tr></thead><tbody>';
  const key_tenors = [0.25, 0.5, 1, 2, 3, 4, tenor];
  key_tenors.forEach(ky => {
    const step = Math.round(ky * steps_year);
    const s = Math.max(0, Math.min(num_steps, step));
    const pfe_val = pfe_curve_m[s].toFixed(1);
    pfeTableHTML += `<tr><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${ky.toFixed(2)}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${pfe_val}</td></tr>`;
  });
  pfeTableHTML += '</tbody></table>';
  // CVA Table
  let cvaTableHTML = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.95rem;"><thead><tr><th style="background:#ed8936;color:white;padding:0.75rem;border-radius:6px 0 0 0;">Slice (Y)</th><th style="background:#ed8936;color:white;padding:0.75rem;border-radius:0 0 0 6px;">ΔCVA ($M)</th><th style="background:#ed8936;color:white;padding:0.75rem;border-radius:0 6px 0 0;">Cum CVA ($M)</th></tr></thead><tbody>';
  let prev_cum = 0;
  key_tenors.forEach((ky, i) => {
    const step = Math.round(ky * steps_year);
    const s = Math.max(0, Math.min(num_steps, step));
    const slice_cva = cum_cva_curve[s] - prev_cum;
    const slice_m = (slice_cva / 1e6).toFixed(1);
    const cum_m = (cum_cva_curve[s] / 1e6).toFixed(1);
    const slice_label = i === 0 ? `0 → ${ky.toFixed(2)}` : `${key_tenors[i-1].toFixed(2)} → ${ky.toFixed(2)}`;
    cvaTableHTML += `<tr><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${slice_label}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${slice_m}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${cum_m}</td></tr>`;
    prev_cum = cum_cva_curve[s];
  });
  cvaTableHTML += '</tbody></table>';
  const results = document.getElementById('results');
  results.innerHTML = `
    <h2>MC Results (${nsims.toLocaleString()} paths, ${conf_pct}% conf)</h2>
    <div>
      <p><strong>Total CVA:</strong> ${cva_m}M</p>
      <p><strong>Max PFE:</strong> ${max_pfe_m}M</p>
      <p><strong>Final PFE:</strong> ${final_pfe_m}M</p>
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
    <h3>PFE / EE Profile</h3>
    <div id="pfeTable">${pfeTableHTML}</div>
    <h3>CVA by Tenor Slice</h3>
    <div id="cvaTable">${cvaTableHTML}</div>
    <details>
      <summary>Model Notes</summary>
      <p>GBM X(0)=1, MTM(t)=Notional × (X(t)-1), EE(t)=max(0, MTM(t)) per path. EE(t)=mean(EE(t)), PFE(t)=${conf_pct}% quantile. CVA = ∑ PFE(t) × λ × (1-R) × exp(-r t) × Δt. Daily steps (252/yr). CVA rises with vol, tenor (diffusion).</p>
    </details>
  `;
  // Exposure Chart (EE/PFE)
  const exposureCtx = document.getElementById('exposureChart')?.getContext('2d');
  if (exposureChartInst) exposureChartInst.destroy();
  exposureChartInst = new Chart(exposureCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [
        {
          label: 'EE (mean)',
          data: ee_curve_m,
          borderColor: '#48bb78',
          backgroundColor: 'rgba(72, 187, 120, 0.2)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: `PFE (${conf_pct}%)`,
          data: pfe_curve_m,
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
        y: { title: { display: true, text: 'Exposure ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  // Paths Chart
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
        y: { title: { display: true, text: 'EE ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: num_viz < 20 } }
    }
  });
  // Hist Chart
  const histCtx = document.getElementById('histChart')?.getContext('2d');
  if (histChartInst) histChartInst.destroy();
  histChartInst = new Chart(histCtx, {
    type: 'bar',
    data: {
      labels: histData.labels,
      datasets: [{
        label: 'Final EE Histogram',
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
        x: { title: { display: true, text: 'Final EE ($ Millions)' } },
        y: { title: { display: true, text: 'Count' }, beginAtZero: true }
      },
      plugins: { legend: { display: false } }
    }
  });
  // Integrand Chart (CVA density)
  const integrandCtx = document.getElementById('integrandChart')?.getContext('2d');
  if (integrandChartInst) integrandChartInst.destroy();
  integrandChartInst = new Chart(integrandCtx, {
    type: 'line',
    data: {
      labels: times.slice(1),
      datasets: [{
        label: 'CVA Integrand',
        data: integrand_m.slice(1),
        borderColor: '#ed8936',
        backgroundColor: 'rgba(237, 137, 54, 0.2)',
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
        y: { title: { display: true, text: 'ΔCVA / day ($M)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  // Cum CVA Chart
  const cumCvaCtx = document.getElementById('cumCvaChart')?.getContext('2d');
  if (cumCvaChartInst) cumCvaChartInst.destroy();
  cumCvaChartInst = new Chart(cumCvaCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [{
        label: 'Incremental CVA',
        data: cum_cva_m,
        borderColor: '#9f7aea',
        backgroundColor: 'rgba(159, 122, 234, 0.3)',
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
        y: { title: { display: true, text: 'Cumulative CVA ($ Millions)' }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
  console.log('CVA Demo: Total CVA', cva_m + 'M');
}

window.addEventListener('load', () => {
  const debouncedCalc = debounce(calculateCVA, 500);
  document.querySelectorAll('#cvaForm input').forEach(input => {
    input.addEventListener('input', debouncedCalc);
  });
  setTimeout(calculateCVA, 200);
});