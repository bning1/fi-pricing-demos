// Black '76 Cap/Floor Pricer (Multi-Caplet)
// Pure JS, client-side. Uses approximation for normCDF.
// Outputs NPV in $ (notional in $mm).

var DAY_MS = 86400000;

// Cumulative normal distribution (Abramowitz & Stegun)
function normCdf(x) {
  var t = 1 / (1 + 0.2316419 * Math.abs(x));
  var d = 0.39894228 * Math.exp(-x * x / 2);
  var prob = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

// Black '76 caplet/floorlet NPV ($)
// F, K in % (e.g. 4.5), vol in % (e.g. 20), T in years, tau in years,
// DF = discount factor, notionalMM in $mm, isCap = true for cap
function black76Caplet(F, K, vol, T, tau, DF, notionalMM, isCap) {
  if (T <= 0) {
    // Expired caplet — intrinsic value only
    var intrinsic = isCap ? Math.max(F - K, 0) : Math.max(K - F, 0);
    return DF * tau * (notionalMM * 1e6) * (intrinsic / 100);
  }
  var sigSqrtT = (vol / 100) * Math.sqrt(T);
  if (sigSqrtT <= 0) return 0;
  var d1 = (Math.log(F / K) + 0.5 * sigSqrtT * sigSqrtT) / sigSqrtT;
  var d2 = d1 - sigSqrtT;
  var Fabs = F / 100;  // convert % to decimal
  var Kabs = K / 100;
  var price;
  if (isCap) {
    price = DF * tau * (notionalMM * 1e6) * (Fabs * normCdf(d1) - Kabs * normCdf(d2));
  } else {
    price = DF * tau * (notionalMM * 1e6) * (Kabs * normCdf(-d2) - Fabs * normCdf(-d1));
  }
  return price;
}

// Simple DF approximation (flat curve, continuous compounding)
function discountFactor(start, end, libor) {
  var T = (end - start) / DAY_MS / 365.25;
  return Math.exp(-(libor / 100) * T);
}

// Generate payment periods
function generatePeriods(startDate, endDate, freqMonths, lagDays) {
  var periods = [];
  var current = new Date(startDate);
  current.setDate(current.getDate() + lagDays);
  var final = new Date(endDate);
  while (current < final) {
    var periodEnd = new Date(current);
    periodEnd.setMonth(periodEnd.getMonth() + freqMonths);
    if (periodEnd > final) periodEnd = new Date(final);
    periods.push({ start: new Date(current), end: periodEnd });
    current = periodEnd;
  }
  return periods;
}

// Format number as $ with commas
function fmtDollar(v) {
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

document.getElementById('capfloorForm').addEventListener('submit', function (e) {
  e.preventDefault();

  function safeParse(id, fallback) {
    var v = parseFloat(document.getElementById(id).value);
    return Number.isFinite(v) ? v : fallback;
  }

  var notional  = safeParse('notional', 100);   // $mm
  var startDate = new Date(document.getElementById('startDate').value || '2026-03-01');
  var endDate   = new Date(document.getElementById('endDate').value || '2027-03-01');
  var lag       = safeParse('lag', 2);
  var freq      = safeParse('freq', 6);
  var strike    = safeParse('strike', 5.0);      // %
  var vol       = safeParse('vol', 20.0);        // %
  var libor     = safeParse('libor', 4.5);       // %
  var isCap     = document.getElementById('type').value === 'cap';

  var periods = generatePeriods(startDate, endDate, freq, lag);
  var caplets = [];
  var totalNPV = 0;

  periods.forEach(function (p, i) {
    var T_fix = (p.start - startDate) / DAY_MS / 365.25;
    var tau   = (p.end - p.start) / DAY_MS / 365.25;
    var DF    = discountFactor(p.start, p.end, libor);
    var F     = libor; // flat forward assumption
    var npv   = black76Caplet(F, strike, vol, T_fix, tau, DF, notional, isCap);
    caplets.push({
      period:  i + 1,
      start:   p.start.toISOString().split('T')[0],
      end:     p.end.toISOString().split('T')[0],
      df:      DF.toFixed(6),
      forward: F.toFixed(2),
      npv:     npv
    });
    totalNPV += npv;
  });

  // Table
  var tbody = document.querySelector('#capletTable tbody');
  tbody.innerHTML = caplets.map(function (c) {
    return '<tr>' +
      '<td>' + c.period + '</td>' +
      '<td>' + c.start + '</td>' +
      '<td>' + c.end + '</td>' +
      '<td>' + c.df + '</td>' +
      '<td>' + c.forward + '%</td>' +
      '<td>' + fmtDollar(c.npv) + '</td>' +
    '</tr>';
  }).join('');

  // Total
  document.getElementById('totalPrice').innerHTML =
    '<strong>Total ' + (isCap ? 'Cap' : 'Floor') + ' NPV: ' + fmtDollar(totalNPV) + '</strong>';

  // Show results
  document.getElementById('results').style.display = 'block';

  // Chart: NPV vs Strike sensitivity
  var ctx = document.getElementById('chart').getContext('2d');
  var strikes = [];
  for (var s = 1; s <= 10; s += 0.5) strikes.push(s);
  var npvs = strikes.map(function (K) {
    var sum = 0;
    periods.forEach(function (p) {
      var T_fix = (p.start - startDate) / DAY_MS / 365.25;
      var tau   = (p.end - p.start) / DAY_MS / 365.25;
      var DF    = discountFactor(p.start, p.end, libor);
      sum += black76Caplet(libor, K, vol, T_fix, tau, DF, notional, isCap);
    });
    return sum;
  });

  if (window._capfloorChart) window._capfloorChart.destroy();
  window._capfloorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: strikes.map(function (s) { return s.toFixed(1) + '%'; }),
      datasets: [{
        label: (isCap ? 'Cap' : 'Floor') + ' NPV ($)',
        data: npvs,
        borderColor: '#4299e1',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: function (v) { return '$' + v.toLocaleString(); } }
        }
      }
    }
  });
});
