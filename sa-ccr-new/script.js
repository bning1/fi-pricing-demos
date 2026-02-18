const SF = {
  'IR': 0.005,
  'FX': 0.04,
  'Credit': 0.05,
  'Equity': 0.06,
  'Commodity': 0.12
};

let pieChart = null;
let barChart = null;

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function addRow() {
  const table = document.getElementById('portfolioTable');
  const tbody = table.tBodies[0];
  const newRow = tbody.rows[0].cloneNode(true);
  newRow.querySelectorAll('input').forEach(input => input.value = '');
  newRow.querySelector('select').selectedIndex = 0;
  newRow.querySelector('.addon').textContent = '-';
  tbody.appendChild(newRow);
}

function deleteRow(btn) {
  btn.closest('tr').remove();
  calculateSA();
}

function clearPortfolio() {
  const tbody = document.getElementById('portfolioTable').tBodies[0];
  tbody.innerHTML = '';
  addRow(); // add one empty
  calculateSA();
}

function calculateSA() {
  const rcEl = document.getElementById('rc');
  const thEl = document.getElementById('threshold');
  const floorEl = document.getElementById('floorPct');
  const rc = parseFloat(rcEl.value) || 0;
  const th = parseFloat(thEl.value) || 0;
  const floorPct = parseFloat(floorEl.value) / 100 || 0;

  const tbody = document.getElementById('portfolioTable').tBodies[0];
  const rows = tbody.rows;
  let totalAddon = 0;
  const classAgg = {};

  for (let row of rows) {
    const select = row.cells[0].querySelector('select');
    const cls = select.value;
    const notEl = row.cells[1].querySelector('input');
    const matEl = row.cells[2].querySelector('input');
    const delEl = row.cells[3].querySelector('input');
    const not = parseFloat(notEl.value) || 0;
    const mat = parseFloat(matEl.value) || 0;
    const del = parseFloat(delEl.value) || 0;

    if (not <= 0) {
      row.cells[4].textContent = '-';
      continue;
    }

    const sf = SF[cls] || 0;
    const mf = Math.sqrt(Math.min(mat / 5, 1));
    const addon = Math.abs(del) * mf * sf * not;
    row.cells[4].textContent = addon.toFixed(1);

    totalAddon += addon;

    if (!classAgg[cls]) {
      classAgg[cls] = { count: 0, notional: 0, addon: 0, mfs: [] };
    }
    classAgg[cls].count++;
    classAgg[cls].notional += not;
    classAgg[cls].addon += addon;
    classAgg[cls].mfs.push(mf);
  }

  const expArg = th > 0 ? -totalAddon / (1.4 * th) : (floorPct > 0 ? -Infinity : 0);
  const mul = Math.min(1, floorPct + (1 - floorPct) * Math.exp(expArg));
  const pfe = mul * totalAddon;
  const ead = 1.4 * (rc + pfe);

  // Breakdown table
  let tableHTML = '<table><thead><tr><th>Class</th><th>#Trades</th><th>Notional (M)</th><th>Avg MF</th><th>AddOn (M)</th><th>% Total</th></tr></thead><tbody>';
  const pieLabels = [];
  const pieData = [];
  const barData = [];
  const colors = ['#4299e1', '#48bb78', '#ed8936', '#f56565', '#9f7aea'];
  let colorIdx = 0;
  for (let cls in classAgg) {
    const agg = classAgg[cls];
    const avgMF = (agg.mfs.reduce((a, b) => a + b, 0) / agg.mfs.length || 0).toFixed(3);
    const pct = totalAddon > 0 ? (agg.addon / totalAddon * 100).toFixed(1) : 0;
    tableHTML += `<tr><td>${cls}</td><td>${agg.count}</td><td>${agg.notional.toFixed(0)}</td><td>${avgMF}</td><td>${agg.addon.toFixed(1)}</td><td>${pct}%</td></tr>`;
    pieLabels.push(cls);
    pieData.push(agg.addon);
    barData.push(agg.addon);
    colorIdx++;
  }
  tableHTML += '</tbody></table>';

  const results = document.getElementById('results');
  results.innerHTML = `
    <h2>SA-CCR Results</h2>
    <div class="summary-grid">
      <p><strong>Total AddOn:</strong> ${totalAddon.toFixed(1)} M</p>
      <p><strong>Multiplier:</strong> ${ (mul * 100).toFixed(1) } %</p>
      <p><strong>PFE:</strong> ${pfe.toFixed(1)} M</p>
      <p><strong>EAD:</strong> <span style="color:#4299e1;font-size:1.3rem;font-weight:700;">${ead.toFixed(1)} M</span></p>
    </div>
    <div style="position:relative;height:350px;margin:1.5rem 0;">
      <canvas id="pieChart"></canvas>
    </div>
    <div style="position:relative;height:350px;margin:1.5rem 0;">
      <canvas id="barChart"></canvas>
    </div>
    <h3>AddOn Breakdown by Asset Class</h3>
    ${tableHTML}
    <details style="margin-top:2rem;">
      <summary>📊 Full Formulas & Assumptions</summary>
      <div style="padding:1rem 0;">
        <p><strong>EAD</strong> = 1.4 × (RC + Mul × AddOn)</p>
        <p><strong>AddOn</strong> = Σ <sub>i</sub> |δ<sub>i</sub>| × MF(T<sub>i</sub>) × SF<sub>class</sub> × N<sub>i</sub></p>
        <p><strong>MF(T)</strong> = √[min(T/5, 1)] , T in years</p>
        <p><strong>Mul</strong> = min{1, Floor + (1-Floor) × exp[ − AddOn / (1.4 × Th) ]}</p>
        <p><strong>SF (%)</strong>: IR=0.5, FX=4, Credit=5, Equity=6, Commodity=12</p>
        <p><em>Simplified: Per-trade (no maturity buckets/hedging sets/correlations/adjusted notional). Units $M. RC can be negative (netting).</em></p>
      </div>
    </details>
  `;

  // Destroy old charts
  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();

  // Pie Chart
  const pieCtx = document.getElementById('pieChart')?.getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: colors.slice(0, pieLabels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)}M (${(ctx.parsed/totalAddon*100).toFixed(1)}%)` } }
      }
    }
  });

  // Bar Chart
  const barCtx = document.getElementById('barChart')?.getContext('2d');
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: pieLabels,
      datasets: [{
        label: 'AddOn ($M)',
        data: barData,
        backgroundColor: colors.slice(0, pieLabels.length).map(c => c + 'AA'),
        borderColor: colors.slice(0, pieLabels.length),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'AddOn ($M)' } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// Event listeners
window.addEventListener('load', () => {
  const debouncedCalc = debounce(calculateSA, 300);
  document.getElementById('saForm').addEventListener('input', debouncedCalc);
  document.getElementById('saForm').addEventListener('change', calculateSA);
  document.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', function() { deleteRow(this); }));
  calculateSA(); // initial
});