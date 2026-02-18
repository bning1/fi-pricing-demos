let computeTimeout;
let chartSurvival, chartComponents;
let currentResults = {};

function debounceCompute() {
  clearTimeout(computeTimeout);
  computeTimeout = setTimeout(compute, 300);
}

function toggleTheme() {
  const body = document.body;
  const isDark = body.dataset.theme === &#39;dark&#39;;
  body.dataset.theme = isDark ? &#39;light&#39; : &#39;dark&#39;;
  const btn = document.querySelector(&#39;.theme-toggle&#39;);
  btn.textContent = isDark ? &#39;🌙&#39; : &#39;☀️&#39;;
  localStorage.setItem(&#39;theme&#39;, body.dataset.theme);
}

function mcPrice(params) {
  const { notional, T, freq, S_bps, lambda, R, r, N_sims } = params;
  const S = S_bps / 10000;
  const dt = 1 / freq;
  let sum_def = 0;
  let sum_prem = 0;
  for (let i = 0; i &lt; N_sims; i++) {
    const u = Math.random();
    const tau = (u &gt; 0) ? -Math.log(u) / lambda : Infinity;
    let pv_prem = 0;
    let pay_date = dt;
    while (pay_date &lt;= T &amp;&amp; pay_date &lt; tau) {
      pv_prem += S * notional * dt * Math.exp(-r * pay_date);
      pay_date += dt;
    }
    let pv_def = 0;
    if (tau &lt; T) {
      pv_def = (1 - R) * notional * Math.exp(-r * tau);
    }
    sum_prem += pv_prem;
    sum_def += pv_def;
  }
  const pv_premium = sum_prem / N_sims;
  const pv_default = sum_def / N_sims;
  const npv = pv_default - pv_premium;
  return { npv, pv_default, pv_premium };
}

function computeParSpread(pv_default, pv_premium, S_bps) {
  const S = S_bps / 10000;
  if (S === 0 || pv_premium === 0) return 0;
  const annuity = pv_premium / S;
  return (pv_default / annuity) * 10000;
}

function compute() {
  const params = {
    notional: parseFloat(document.getElementById(&#39;notional&#39;).value) || 10000000,
    T: parseFloat(document.getElementById(&#39;T&#39;).value) || 5,
    freq: parseFloat(document.getElementById(&#39;freq&#39;).value) || 4,
    S_bps: parseFloat(document.getElementById(&#39;S_bps&#39;).value) || 100,
    lambda: parseFloat(document.getElementById(&#39;lambda&#39;).value) / 100 || 0.01,
    R: parseFloat(document.getElementById(&#39;R&#39;).value) / 100 || 0.4,
    r: parseFloat(document.getElementById(&#39;rfr&#39;).value) / 100 || 0.03,
    N_sims: Math.max(1000, parseInt(document.getElementById(&#39;N_sims&#39;).value) || 20000),
  };

  const res = mcPrice(params);
  const par_bps = computeParSpread(res.pv_default, res.pv_premium, params.S_bps);
  currentResults = { ...res, par_bps, params };

  document.getElementById(&#39;npv&#39;).textContent = currentResults.npv.toLocaleString(&#39;en-US&#39;, {maximumFractionDigits: 0});
  document.getElementById(&#39;pv_def&#39;).textContent = &#39;$&#39; + (currentResults.pv_default / 1000000).toFixed(2) + &#39;M&#39;;
  document.getElementById(&#39;pv_prem&#39;).textContent = &#39;$&#39; + (currentResults.pv_premium / 1000000).toFixed(2) + &#39;M&#39;;
  document.getElementById(&#39;par_spread&#39;).textContent = par_bps.toFixed(1) + &#39; bps&#39;;

  updateCharts(params, res);
}

function updateCharts(params, res) {
  // Survival
  const ctx1 = document.getElementById(&#39;survivalChart&#39;).getContext(&#39;2d&#39;);
  const times = [];
  const surv = [];
  const nPoints = 21;
  for (let i = 0; i &lt;= nPoints; i++) {
    const t = (params.T * i) / nPoints;
    times.push(t.toFixed(1));
    surv.push(Math.exp(-params.lambda * t));
  }
  if (chartSurvival) chartSurvival.destroy();
  chartSurvival = new Chart(ctx1, {
    type: &#39;line&#39;,
    data: {
      labels: times,
      datasets: [{
        label: &#39;Survival P(t)&#39;,
        data: surv,
        borderColor: &#39;rgb(54, 162, 235)&#39;,
        backgroundColor: &#39;rgba(54, 162, 235, 0.05)&#39;,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { min: 0, max: 1, title: { display: true, text: &#39;Probability&#39; } },
        x: { title: { display: true, text: &#39;Time (years)&#39; } }
      }
    }
  });

  // Components
  const ctx2 = document.getElementById(&#39;componentsChart&#39;).getContext(&#39;2d&#39;);
  const labels = [&#39;Default PV&#39;, &#39;Premium PV&#39;, &#39;NPV&#39;];
  const data = [res.pv_default, res.pv_premium, res.npv];
  const colors = [
    &#39;rgba(40, 167, 69, 0.8)&#39;,
    &#39;rgba(255, 99, 132, 0.8)&#39;,
    res.npv &gt; 0 ? &#39;rgba(40, 167, 69, 0.8)&#39; : &#39;rgba(255, 99, 132, 0.8)&#39;
  ];
  if (chartComponents) chartComponents.destroy();
  chartComponents = new Chart(ctx2, {
    type: &#39;bar&#39;,
    data: {
      labels,
      datasets: [{ label: &#39;PV ($M)&#39;, data: data.map(d =&gt; d / 1000000), backgroundColor: colors }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

function exportCSV() {
  if (!currentResults.npv) {
    alert(&#39;Compute first!&#39;);
    return;
  }
  let csv = &#39;Metric,Value\n&#39;;
  csv += `NPV,$${currentResults.npv.toLocaleString()}\n`;
  csv += `Default PV,$${currentResults.pv_default.toLocaleString()}\n`;
  csv += `Premium PV,$${currentResults.pv_premium.toLocaleString()}\n`;
  csv += `Par Spread,${currentResults.par_bps.toFixed(1)} bps\n\n`;
  csv += &#39;Inputs:\n&#39;;
  csv += `Notional,$${ (currentResults.params.notional / 1000000).toFixed(1) }M\n`;
  csv += `Maturity,${currentResults.params.T} yr\n`;
  csv += `Premium Freq,${currentResults.params.freq}/yr\n`;
  csv += `Quoted S,${currentResults.params.S_bps} bps\n`;
  csv += `Hazard λ,${(currentResults.params.lambda * 100).toFixed(1)}%\n`;
  csv += `Recovery R,${(currentResults.params.R * 100).toFixed(0)}%\n`;
  csv += `DF rate r,${(currentResults.params.r * 100).toFixed(1)}%\n`;
  csv += `Simulations,${currentResults.params.N_sims}\n`;

  const blob = new Blob([csv], { type: &#39;text/csv;charset=utf-8;&#39; });
  const url = URL.createObjectURL(blob);
  const a = document.createElement(&#39;a&#39;);
  a.href = url;
  a.download = `cds_results_${new Date().toISOString().slice(0,19).replace(/:/g, &#39;-&#39;)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener(&#39;DOMContentLoaded&#39;, () =&gt; {
  const inputs = document.querySelectorAll(&#39;#form input&#39;);
  inputs.forEach((input) =&gt; input.addEventListener(&#39;input&#39;, debounceCompute));

  const savedTheme = localStorage.getItem(&#39;theme&#39;);
  const toggleBtn = document.querySelector(&#39;.theme-toggle&#39;);
  if (savedTheme === &#39;dark&#39;) {
    document.body.dataset.theme = &#39;dark&#39;;
    toggleBtn.textContent = &#39;☀️&#39;;
  } else {
    toggleBtn.textContent = &#39;🌙&#39;;
  }

  compute(); // Initial
});