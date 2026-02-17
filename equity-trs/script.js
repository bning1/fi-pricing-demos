let chartInstance = null;

function normalRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function calculateTRS() {
  const notional = parseFloat(document.getElementById('notional').value) || 0;
  const s0 = parseFloat(document.getElementById('s0').value) || 100;
  const funding_rate = parseFloat(document.getElementById('fundingRate').value) / 100 || 0;
  const q = parseFloat(document.getElementById('q').value) / 100 || 0;
  const tenor = parseFloat(document.getElementById('tenor').value) || 0;
  const freq = parseFloat(document.getElementById('freq').value) || 4;
  const rfr = parseFloat(document.getElementById('r').value) / 100 || 0;
  const sigma = parseFloat(document.getElementById('sigma').value) / 100 || 0;
  const beta = parseFloat(document.getElementById('beta').value) || 1.0;
  let nsims = parseInt(document.getElementById('nsims').value) || 0;
  if (nsims < 100 || tenor <= 0) {
    document.getElementById('results').innerHTML = '<p>Enter valid parameters.</p>';
    return;
  }
  const dt = 1.0 / freq;
  const numperiods = Math.floor(tenor / dt);
  const times = [];
  const dfs = [];
  for (let i = 1; i <= numperiods; i++) {
    const ti = i * dt;
    times.push(ti.toFixed(2));
    dfs.push(Math.exp(-rfr * ti));
  }
  let pvFund = 0;
  for (let i = 0; i < numperiods; i++) {
    pvFund += funding_rate * dt * notional * dfs[i];
  }
  let sumPvEq = 0;
  let sumSqPvEq = 0;
  const pathsData = [];
  const numViz = Math.min(100, nsims);
  for (let sim = 0; sim < nsims; sim++) {
    let S = s0;
    let pathPvEq = 0;
    let pathData = null;
    if (sim < numViz) {
      pathData = [];
    }
    for (let per = 0; per < numperiods; per++) {
      const Z = normalRandom();
      const drift = (rfr - q - 0.5 * sigma * sigma) * dt;
      const diffu = sigma * Math.sqrt(dt) * Z;
      const Snew = S * Math.exp(drift + diffu);
      const priceRet = (Snew / S) - 1;
      const divRet = q * dt;
      const totRet = priceRet + divRet;
      const eqCF = totRet * notional;
      pathPvEq += eqCF * dfs[per];
      if (pathData !== null) {
        pathData.push(Snew / s0);
      }
      S = Snew;
    }
    sumPvEq += pathPvEq;
    sumSqPvEq += pathPvEq * pathPvEq;
    if (pathData !== null) {
      pathsData.push({
        label: `Path ${sim + 1}`,
        data: pathData
      });
    }
  }
  const meanPvEq = sumPvEq / nsims;
  const meanSq = sumSqPvEq / nsims;
  const varPvEq = meanSq - meanPvEq * meanPvEq;
  const stdPvEq = Math.sqrt(varPvEq);
  const ciHalf = 1.96 * stdPvEq / Math.sqrt(nsims);
  const npv = meanPvEq - pvFund;
  let annuity = 0;
  for (let i = 0; i < numperiods; i++) {
    annuity += dt * dfs[i] * notional;
  }
  const fairFunding_rate = meanPvEq / annuity;
  const erp = 0.05;
  const physical_mu = (rfr + beta * erp) * 100;
  const results = document.getElementById('results');
  results.innerHTML = `
    <h2>MC Results (${nsims.toLocaleString()} sims)</h2>
    <div>
      <p><strong>PV Equity Leg:</strong> $${meanPvEq.toLocaleString(undefined, {maximumFractionDigits: 0})} ± $${ciHalf.toLocaleString(undefined, {maximumFractionDigits: 0})} (95% CI)</p>
      <p><strong>PV Funding Leg:</strong> $${pvFund.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
      <p><strong>NPV (Receiver):</strong> $${npv.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
      <p><strong>Fair Funding:</strong> ${(fairFunding_rate * 100).toFixed(2)}%</p>
    </div>
    <details>
      <summary>Physical μ (CAPM ERP=5%): ${physical_mu.toFixed(2)}% | Notes</summary>
      <p>RN pricing, GBM price paths, div = q Δt. Continuous discount.</p>
    </details>
    <div style="position: relative; height:400px; width:100%">
      <canvas id="pathsChart"></canvas>
    </div>
  `;
  const ctx = document.getElementById('pathsChart')?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  const getColor = (i) => {
    const hue = (i / 100) * 360;
    return `hsla(${hue}, 70%, 50%, 0.8)`;
  };
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: times,
      datasets: pathsData.map((p, i) => ({
        label: p.label,
        data: p.data,
        borderColor: getColor(i),
        backgroundColor: getColor(i),
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.1
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Years' } },
        y: { title: { display: true, text: 'S_t / S_0' } }
      },
      plugins: { legend: { display: false } }
    }
  });
  console.table({
    'PV Equity': meanPvEq.toFixed(0),
    '±CI': ciHalf.toFixed(0),
    'PV Funding': pvFund.toFixed(0),
    NPV: npv.toFixed(0),
    'Fair %': (fairFunding_rate*100).toFixed(2),
    'Physical %': physical_mu.toFixed(2)
  });
}

window.addEventListener('load', () => {
  const debouncedCalc = debounce(calculateTRS, 300);
  document.querySelectorAll('#trsForm input').forEach(input => input.addEventListener('input', debouncedCalc));
  setTimeout(calculateTRS, 100);
});