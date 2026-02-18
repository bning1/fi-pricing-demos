let pfeChartInst = null;
let pathsChartInst = null;
let histChartInst = null;

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

function calculatePFE() {
  const notional = parseFloat(document.getElementById('notional').value) || 100000000;
  const tenor = parseFloat(document.getElementById('tenor').value) || 5;
  const sigma_pct = parseFloat(document.getElementById('vol').value) || 20;
  const mu_pct = parseFloat(document.getElementById('drift').value) || 0;
  let nsims = parseInt(document.getElementById('nsims').value) || 5000;
  const conf_pct = parseFloat(document.getElementById('conf').value) || 95;
  const sigma = sigma_pct / 100;
  const mu = mu_pct / 100;
  const conf_level = conf_pct / 100;
  nsims = Math.max(100, Math.min(20000, nsims)); // cap for perf
  if (tenor <= 0) {
    document.getElementById('results').innerHTML = '<p style="color:red;">Invalid tenor.</p>';
    return;
  }
  const steps_year = 252;
  const dt = 1 / steps_year;
  const num_steps = Math.floor(tenor * steps_year);
  const times = Array.from({ length: num_steps + 1 }, (_, i) => (i * dt).toFixed(2));
  console.log(`Simming ${nsims} paths, ${num_steps} steps...`);
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
  let pfe_curve = new Array(num_steps + 1);
  let final_ee_raw = [];
  for (let t = 0; t <= num_steps; t++) {
    let slice = all_ee_paths.map(path => path[t]);
    slice.sort((a, b) => a - b);
    const idx = Math.floor(conf_level * (nsims - 1));
    pfe_curve[t] = slice[idx];
    if (t === num_steps) final_ee_raw = slice;
  }
  const final_ee_m = final_ee_raw.map(ee => ee / 1e6);
  const pfe_curve_m = pfe_curve.map(v => v / 1e6);
  const max_pfe_m = Math.max(...pfe_curve_m).toFixed(1);
  const final_pfe_m = pfe_curve_m[num_steps].toFixed(1);
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
  let tableHTML = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.95rem;"><thead><tr><th style="background:#4299e1;color:white;padding:0.75rem;border-radius:6px 0 0 0;">Tenor (Y)</th><th style="background:#4299e1;color:white;padding:0.75rem;border-radius:0 6px 0 0;">PFE ($M)</th></tr></thead><tbody>';
  const key_tenors = [0.25, 0.5, 1, 2, 3, 4, tenor];
  key_tenors.forEach(ky => {
    const step = Math.round(ky / dt);
    const s = Math.max(0, Math.min(num_steps, step));
    const pfe_val = pfe_curve_m[s].toFixed(1);
    tableHTML += `<tr><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;">${ky.toFixed(2)}</td><td style="padding:0.5rem;border-bottom:1px solid #e2e8f0;font-weight:600;">${pfe_val}</td></tr>`;
  });
  tableHTML += '</tbody></table>';
  const results = document.getElementById('results');
  results.innerHTML = `
    <h2>MC Results (${nsims.toLocaleString()} paths, ${conf_pct}% conf)</h2>
    <div>
      <p><strong>Max PFE:</strong> ${max_pfe_m}M</p>
      <p><strong>Final PFE:</strong> ${final_pfe_m}M</p>
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
    <h3>PFE at Key Tenors</h3>
    <div id="pfeTable">${tableHTML}</div>
    <details>
      <summary>Model Notes</summary>
      <p>GBM risk factor X(0)=1, MTM(t)=Notional × (X(t)-1), EE(t)=max(0, MTM(t)). Daily steps (252/yr). No collateral/netting/thresholds. PFE rising due to volatility diffusion.</p>
    </details>
  `;
  // Charts
  // PFE Chart
  const pfeCtx = document.getElementById('pfeChart')?.getContext('2d');
  if (pfeChartInst) pfeChartInst.destroy();
  pfeChartInst = new Chart(pfeCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [{
        label: `PFE (${conf_pct}%)`,
        data: pfe_curve_m,
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
        y: { title: { display: true, text: 'PFE ($ Millions)' }, min: 0 }
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
        backgroundColor: getColor(i) + '20', // alpha
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
  console.log('PFE Demo: Max', max_pfe_m, 'Final', final_pfe_m);
}

window.addEventListener('load', () => {
  const debouncedCalc = debounce(calculatePFE, 500);
  document.querySelectorAll('#pfeForm input').forEach(input => {
    input.addEventListener('input', debouncedCalc);
  });
  setTimeout(calculatePFE, 200);
});