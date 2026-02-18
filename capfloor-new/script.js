const SQRT2PI = Math.sqrt(2 * Math.PI);

function normpdf(x) {
  return Math.exp(-x * x / 2) / SQRT2PI;
}

function normcdf(x) {
  if (x &gt;= 0.0) {
    const t = 1.0 / (1.0 + 0.2316419 * x);
    const poly = 0.319381530 * t - 0.356563782 * t*t + 1.781477937 * t*t*t - 1.821255978 * t*t*t*t + 1.330274429 * t*t*t*t*t;
    return 1.0 - normpdf(x) * poly;
  } else {
    return 1.0 - normcdf(-x);
  }
}

function capletPV(F, K, vol, T, r, notional, tau, isCap) {
  const sigma = vol * Math.sqrt(T);
  if (sigma &lt; 1e-10) return 0;
  const d = (F - K) / sigma;
  const Nd = normcdf(d);
  const nd = normpdf(d);
  let undisc;
  if (isCap) {
    undisc = (F - K) * Nd + sigma * nd;
  } else {
    undisc = (K - F) * normcdf(-d) + sigma * nd;
  }
  return notional * tau * Math.exp(-r * T) * undisc;
}

let chartStrike = null;
let chartVol = null;

function compute() {
  const inputs = {
    notional: parseFloat(document.getElementById('notional').value),
    maturity: parseFloat(document.getElementById('maturity').value),
    tau: parseFloat(document.getElementById('tau').value),
    vol: parseFloat(document.getElementById('vol').value) / 100,
    forward: parseFloat(document.getElementById('forward').value) / 100,
    rate: parseFloat(document.getElementById('rate').value) / 100,
    strike: parseFloat(document.getElementById('strike').value) / 100,
    isCap: document.getElementById('isCap').checked
  };

  const numPeriods = Math.floor(inputs.maturity / inputs.tau);
  let caplets = [];
  let totalNPV = 0;
  for (let i = 1; i &lt;= numPeriods; i++) {
    const T = i * inputs.tau;
    const pv = capletPV(inputs.forward, inputs.strike, inputs.vol, T, inputs.rate, inputs.notional, inputs.tau, inputs.isCap);
    caplets.push({period: i, expiry: T.toFixed(2), pv: pv.toLocaleString('en-US', {maximumFractionDigits: 0})});
    totalNPV += pv;
  }

  // Table
  let tableHtml = `&lt;table&gt;
    &lt;thead&gt;&lt;tr&gt;&lt;th&gt;Period&lt;/th&gt;&lt;th&gt;Expiry (Y)&lt;/th&gt;&lt;th&gt;Caplet PV ($)&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;
    &lt;tbody&gt;`;
  caplets.forEach(c =&gt; {
    tableHtml += `&lt;tr&gt;&lt;td&gt;${c.period}&lt;/td&gt;&lt;td&gt;${c.expiry}&lt;/td&gt;&lt;td&gt;$${c.pv}&lt;/td&gt;&lt;/tr&gt;`;
  });
  tableHtml += `&lt;tr style=&quot;background: linear-gradient(135deg, rgba(0,170,68,0.3), rgba(0,255,136,0.3));&quot;&gt;
    &lt;td colspan=&quot;2&quot;&gt;&lt;strong&gt;Total NPV&lt;/strong&gt;&lt;/td&gt;&lt;td&gt;&lt;strong&gt;$${totalNPV.toLocaleString('en-US', {maximumFractionDigits: 0})}&lt;/strong&gt;&lt;/td&gt;&lt;/tr&gt;
    &lt;/tbody&gt;&lt;/table&gt;`;
  document.getElementById('results').innerHTML = tableHtml;

  // Strike sensitivity
  if (chartStrike) chartStrike.destroy();
  const strikeMin = inputs.forward * 0.7;
  const strikeMax = inputs.forward * 1.3;
  const numSteps = 25;
  const strikeStep = (strikeMax - strikeMin) / numSteps;
  const strikeLabels = [];
  const strikeData = [];
  for (let k = strikeMin; k &lt;= strikeMax; k += strikeStep) {
    let npv = 0;
    for (let i = 1; i &lt;= numPeriods; i++) {
      const T = i * inputs.tau;
      npv += capletPV(inputs.forward, k, inputs.vol, T, inputs.rate, inputs.notional, inputs.tau, inputs.isCap);
    }
    strikeLabels.push((k * 100).toFixed(1));
    strikeData.push(npv);
  }
  const strikeCtx = document.getElementById('strikeChart').getContext('2d');
  chartStrike = new Chart(strikeCtx, {
    type: 'line',
    data: {
      labels: strikeLabels,
      datasets: [{
        label: 'Total NPV vs Strike (%)',
        data: strikeData,
        borderColor: inputs.isCap ? '#00ff88' : '#ff4444',
        backgroundColor: inputs.isCap ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Strike (%)' } },
        y: { beginAtZero: true, title: { display: true, text: 'NPV ($)' } }
      }
    }
  });

  // Vol sensitivity
  if (chartVol) chartVol.destroy();
  const volMin = Math.max(inputs.vol * 0.3, 0.001);
  const volMax = inputs.vol * 2.0;
  const volSteps = 25;
  const volStep = (volMax - volMin) / volSteps;
  const volLabels = [];
  const volData = [];
  for (let v = volMin; v &lt;= volMax; v += volStep) {
    let npv = 0;
    for (let i = 1; i &lt;= numPeriods; i++) {
      const T = i * inputs.tau;
      npv += capletPV(inputs.forward, inputs.strike, v, T, inputs.rate, inputs.notional, inputs.tau, inputs.isCap);
    }
    volLabels.push((v * 100).toFixed(1));
    volData.push(npv);
  }
  const volCtx = document.getElementById('volChart').getContext('2d');
  chartVol = new Chart(volCtx, {
    type: 'line',
    data: {
      labels: volLabels,
      datasets: [{
        label: 'Total NPV vs Vol (%)',
        data: volData,
        borderColor: '#4488ff',
        backgroundColor: 'rgba(68,136,255,0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Vol (%)' } },
        y: { beginAtZero: true, title: { display: true, text: 'NPV ($)' } }
      }
    }
  });
}